from __future__ import annotations

from django.contrib.auth import authenticate
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet
from rest_framework_simplejwt.tokens import RefreshToken

from soc.models import Incident, IncidentLog, System, ThreatActor, User
from soc.permissions import IncidentAccessPermission, IsAdminForSystemWrite
from soc.serializers import (
    IncidentLogSerializer,
    IncidentSerializer,
    SystemSerializer,
    ThreatActorSerializer,
    UserSerializer,
)


class LoginView(APIView):
    permission_classes = []

    def post(self, request):
        email = request.data.get("email", "")
        password = request.data.get("password", "")

        try:
            user_record = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"detail": "Invalid email or password."}, status=status.HTTP_401_UNAUTHORIZED)

        user = authenticate(request, username=user_record.username, password=password)
        if user is None:
            return Response({"detail": "Invalid email or password."}, status=status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user).data,
            }
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

    @action(detail=True, methods=["patch"])
    def claim(self, request, pk=None):
        incident = self.get_object()
        if incident.assigned_to_id:
            return Response({"detail": "Incident is already assigned."}, status=status.HTTP_400_BAD_REQUEST)

        incident.assigned_to = request.user
        if incident.status == Incident.Status.NEW:
            incident.status = Incident.Status.ASSIGNED
        incident.save()

        serializer = self.get_serializer(incident)
        return Response(serializer.data)


class IncidentLogViewSet(ReadOnlyModelViewSet):
    queryset = IncidentLog.objects.select_related("incident").all()
    serializer_class = IncidentLogSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["incident", "action", "performed_by"]
