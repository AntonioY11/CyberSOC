from __future__ import annotations

from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from soc.models import Incident, IncidentLog, System, ThreatActor, User
from soc.permissions import IncidentAccessPermission, IsAdminForSystemWrite
from soc.serializers import (
    IncidentLogSerializer,
    IncidentSerializer,
    SystemSerializer,
    ThreatActorSerializer,
    UserSerializer,
)


class UserViewSet(ModelViewSet):
    queryset = User.objects.all().order_by("id")
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["role", "is_staff", "is_active"]


class SystemViewSet(ModelViewSet):
    queryset = System.objects.all().order_by("id")
    serializer_class = SystemSerializer
    permission_classes = [IsAuthenticated, IsAdminForSystemWrite]
    filterset_fields = ["type", "criticality"]


class ThreatActorViewSet(ModelViewSet):
    queryset = ThreatActor.objects.all().order_by("id")
    serializer_class = ThreatActorSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["origin_country", "threat_level"]


class IncidentViewSet(ModelViewSet):
    queryset = Incident.objects.all().order_by("-id")
    serializer_class = IncidentSerializer
    permission_classes = [IsAuthenticated, IncidentAccessPermission]
    filterset_fields = ["status", "severity", "is_true_positive", "system", "assigned_to", "discovery_date"]


class IncidentLogViewSet(ReadOnlyModelViewSet):
    queryset = IncidentLog.objects.select_related("incident").all()
    serializer_class = IncidentLogSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["incident", "action", "performed_by"]
