from __future__ import annotations

from rest_framework import serializers

from soc.models import Incident, IncidentLog, System, ThreatActor, User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "name", "role"]


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
