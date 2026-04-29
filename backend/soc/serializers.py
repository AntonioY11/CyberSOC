## to convert django object to json for angular
from __future__ import annotations

import logging
import re

from django.contrib.auth.password_validation import validate_password
from django.utils.html import strip_tags
from rest_framework import serializers

from soc.models import AuditLog, Incident, IncidentLog, System, ThreatActor, User


logger = logging.getLogger(__name__)

THREAT_ACTOR_NAME_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9\s.'()/_&,-]*$")


def severity_for_criticality(criticality: int) -> str:
    if criticality <= 2:
        return Incident.Severity.LOW
    if criticality == 3:
        return Incident.Severity.MEDIUM
    if criticality == 4:
        return Incident.Severity.HIGH
    return Incident.Severity.CRITICAL


def normalize_threat_actor_name(value: str) -> str:
    normalized = " ".join(value.split()).strip()
    if not normalized:
        raise serializers.ValidationError("Threat actor name is required.")
    if "<" in normalized or ">" in normalized or strip_tags(normalized) != normalized:
        raise serializers.ValidationError("Threat actor name contains invalid characters.")
    if not THREAT_ACTOR_NAME_PATTERN.fullmatch(normalized):
        raise serializers.ValidationError("Threat actor name may only include letters, numbers, spaces, and basic punctuation.")
    return normalized


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "name", "role"]


class InviteUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["email", "name", "role"]

    def validate_role(self, value):
        if value not in {User.Role.ADMIN, User.Role.ANALYST}:
            raise serializers.ValidationError("Role must be ADMIN or ANALYST.")
        return value

    def create(self, validated_data):
        temporary_password = self.context["temporary_password"]
        email = validated_data["email"].lower()
        user = User(
            username=email,
            email=email,
            name=validated_data["name"],
            role=validated_data["role"],
            is_staff=validated_data["role"] == User.Role.ADMIN,
        )
        user.set_password(temporary_password)
        user.save()
        return user


class InviteUserResponseSerializer(serializers.Serializer):
    user = UserSerializer()
    temporary_password = serializers.CharField()


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate_new_password(self, value):
        validate_password(value, self.context["request"].user)
        return value


class SystemSerializer(serializers.ModelSerializer):
    class Meta:
        model = System
        fields = ["id", "name", "type", "description", "ip_address", "criticality"]


class ThreatActorSerializer(serializers.ModelSerializer):
    created_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = ThreatActor
        fields = ["id", "name", "status", "origin_country", "tactics", "threat_level", "created_at"]

    def validate_name(self, value):
        return normalize_threat_actor_name(value)

    def create(self, validated_data):
        validated_data.setdefault("status", ThreatActor.Status.UNVERIFIED)
        validated_data.setdefault("origin_country", "Unknown")
        validated_data.setdefault("tactics", "")
        validated_data.setdefault("threat_level", ThreatActor.ThreatLevel.MEDIUM)
        return super().create(validated_data)


class IncidentLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = IncidentLog
        fields = ["id", "incident", "action", "message", "timestamp", "performed_by"]


class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = ["id", "actor_id", "actor_name", "action_type", "target_identifier", "timestamp"]

    def get_actor_name(self, obj):
        if obj.actor:
            return obj.actor.name or obj.actor.username
        return "System"


class IncidentSerializer(serializers.ModelSerializer):
    actors = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=ThreatActor.objects.all(),
        required=False,
    )
    threat_actor = serializers.CharField(write_only=True, required=False, allow_blank=False, max_length=120)
    actors_detail = ThreatActorSerializer(source="actors", many=True, read_only=True)
    system_detail = SystemSerializer(source="system", read_only=True)
    assigned_to_detail = UserSerializer(source="assigned_to", read_only=True)
    logs = IncidentLogSerializer(many=True, read_only=True)
    resolution_summary = serializers.CharField(required=False, allow_blank=True)
    evidence_image_url = serializers.SerializerMethodField()
    forensic_report_url = serializers.SerializerMethodField()

    class Meta:
        model = Incident
        fields = [
            "id",
            "title",
            "description",
            "discovery_date",
            "status",
            "severity",
            "is_true_positive",
            "resolution_summary",
            "evidence_image",
            "forensic_report",
            "evidence_image_url",
            "forensic_report_url",
            "system",
            "system_detail",
            "assigned_to",
            "assigned_to_detail",
            "actors",
            "actors_detail",
            "threat_actor",
            "logs",
        ]

    def validate_threat_actor(self, value):
        return normalize_threat_actor_name(value)

    def validate_resolution_summary(self, value):
        return value.strip()

    def _link_or_create_threat_actor(self, incident: Incident, threat_actor_name: str) -> None:
        actor = ThreatActor.objects.filter(name__iexact=threat_actor_name).first()
        created = False

        if actor is None:
            actor, created = ThreatActor.objects.get_or_create(
                name=threat_actor_name,
                defaults={
                    "status": ThreatActor.Status.UNVERIFIED,
                    "origin_country": "Unknown",
                    "tactics": "",
                    "threat_level": ThreatActor.ThreatLevel.MEDIUM,
                },
            )

        incident.actors.add(actor)

        if created:
            request = self.context.get("request")
            user = getattr(request, "user", None)
            if user and getattr(user, "is_authenticated", False) and getattr(user, "role", None) == User.Role.ANALYST:
                try:
                    AuditLog.objects.create(
                        actor=user,
                        action_type="THREAT_ACTOR_CREATED",
                        target_identifier=actor.name,
                    )
                except Exception:
                    logger.exception("Failed to write audit log for threat actor %s", actor.name)

    def create(self, validated_data):
        actors = validated_data.pop("actors", [])
        threat_actor_name = validated_data.pop("threat_actor", None)
        system = validated_data["system"]
        validated_data["status"] = Incident.Status.NEW
        validated_data["severity"] = severity_for_criticality(system.criticality)
        incident = Incident.objects.create(**validated_data)

        if actors:
            incident.actors.add(*actors)

        if threat_actor_name:
            self._link_or_create_threat_actor(incident, threat_actor_name)

        return incident

    def get_evidence_image_url(self, obj):
        request = self.context.get("request")
        if not obj.evidence_image:
            return None
        if request:
            return request.build_absolute_uri(obj.evidence_image.url)
        return obj.evidence_image.url

    def get_forensic_report_url(self, obj):
        request = self.context.get("request")
        if not obj.forensic_report:
            return None
        if request:
            return request.build_absolute_uri(obj.forensic_report.url)
        return obj.forensic_report.url

    def validate_forensic_report(self, value):
        if value and not value.name.lower().endswith(".pdf"):
            raise serializers.ValidationError("Forensic report must be a PDF file.")
        return value


class IncidentStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Incident.Status.choices, required=False)
    severity = serializers.ChoiceField(choices=Incident.Severity.choices, required=False)
    resolution_summary = serializers.CharField(required=False, allow_blank=True)

    def validate_resolution_summary(self, value):
        return value.strip()

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("Provide a status or severity change.")

        incident = self.instance
        summary = attrs.get("resolution_summary", getattr(incident, "resolution_summary", ""))

        if attrs.get("status") in {Incident.Status.ASSIGNED, Incident.Status.MITIGATED, Incident.Status.RESOLVED} and not incident.assigned_to_id:
            raise serializers.ValidationError({"status": "Assign the incident before moving it to this status."})

        if attrs.get("status") == Incident.Status.RESOLVED and not summary:
            raise serializers.ValidationError({"resolution_summary": "Resolution summary is required when resolving an incident."})

        return attrs


class IncidentAssignmentSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()

    def validate(self, attrs):
        try:
            user = User.objects.get(pk=attrs["user_id"])
        except User.DoesNotExist as exc:
            raise serializers.ValidationError({"user_id": "Selected analyst does not exist."}) from exc

        if user.role != User.Role.ANALYST:
            raise serializers.ValidationError({"user_id": "Incident ownership can only be assigned to an analyst."})

        if not user.is_active:
            raise serializers.ValidationError({"user_id": "Selected analyst is not active."})

        attrs["user"] = user
        return attrs
