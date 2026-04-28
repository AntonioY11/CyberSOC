## to convert django object to json for angular
from __future__ import annotations

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from soc.models import AuditLog, Incident, IncidentLog, System, ThreatActor, User


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
    class Meta:
        model = ThreatActor
        fields = ["id", "name", "origin_country", "tactics", "threat_level"]


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
    actors_detail = ThreatActorSerializer(source="actors", many=True, read_only=True)
    system_detail = SystemSerializer(source="system", read_only=True)
    assigned_to_detail = UserSerializer(source="assigned_to", read_only=True)
    logs = IncidentLogSerializer(many=True, read_only=True)
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
            "logs",
        ]

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
