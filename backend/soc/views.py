from __future__ import annotations

import secrets
import string

from django.contrib.auth import authenticate
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet
from rest_framework_simplejwt.tokens import RefreshToken

from soc.models import AuditLog, Incident, IncidentLog, System, ThreatActor, User
from soc.permissions import IncidentAccessPermission, IsAdminForSystemWrite
from soc.serializers import (
    AuditLogSerializer,
    ChangePasswordSerializer,
    InviteUserResponseSerializer,
    InviteUserSerializer,
    IncidentLogSerializer,
    IncidentSerializer,
    SystemSerializer,
    ThreatActorSerializer,
    UserSerializer,
)


TEMPORARY_PASSWORD_ALPHABET = string.ascii_letters + string.digits + "!@#$%^&*()-_=+"


def generate_temporary_password(length: int = 12) -> str:
    return "".join(secrets.choice(TEMPORARY_PASSWORD_ALPHABET) for _ in range(length))


def create_audit_log(actor: User, action_type: str, target_identifier: str) -> None:
    AuditLog.objects.create(
        actor=actor if actor and actor.is_authenticated else None,
        action_type=action_type,
        target_identifier=target_identifier,
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

        if user.role == User.Role.ADMIN and not user.is_staff:
            user.is_staff = True
            user.save(update_fields=["is_staff"])

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user).data,
            }
        )


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response({"detail": "Password changed successfully."})


class InviteUserView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        temporary_password = generate_temporary_password()
        serializer = InviteUserSerializer(
            data=request.data,
            context={"temporary_password": temporary_password},
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        create_audit_log(request.user, "USER_INVITED", user.email)

        response_serializer = InviteUserResponseSerializer(
            {
                "user": UserSerializer(user).data,
                "temporary_password": temporary_password,
            }
        )
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class AddAssetView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        serializer = SystemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        system = serializer.save()

        create_audit_log(request.user, "ASSET_CREATED", f"{system.name} ({system.ip_address})")
        return Response(SystemSerializer(system).data, status=status.HTTP_201_CREATED)


class UserViewSet(ModelViewSet):
    queryset = User.objects.all().order_by("id")
    serializer_class = UserSerializer
    permission_classes = [IsAdminUser]
    filterset_fields = ["role", "is_staff", "is_active"]

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user.id == request.user.id:
            return Response(
                {"detail": "You cannot delete your own admin account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        target_identifier = instance.email
        instance.delete()
        create_audit_log(self.request.user, "USER_DELETED", target_identifier)


class SystemViewSet(ModelViewSet):
    queryset = System.objects.all().order_by("id")
    serializer_class = SystemSerializer
    permission_classes = [IsAuthenticated, IsAdminForSystemWrite]
    filterset_fields = ["type", "criticality"]

    def perform_create(self, serializer):
        system = serializer.save()
        create_audit_log(self.request.user, "ASSET_CREATED", f"{system.name} ({system.ip_address})")

    def perform_update(self, serializer):
        system = serializer.save()
        create_audit_log(self.request.user, "ASSET_UPDATED", f"{system.name} ({system.ip_address})")

    def perform_destroy(self, instance):
        target_identifier = f"{instance.name} ({instance.ip_address})"
        instance.delete()
        create_audit_log(self.request.user, "ASSET_DELETED", target_identifier)


class ThreatActorViewSet(ModelViewSet):
    queryset = ThreatActor.objects.all().order_by("id")
    serializer_class = ThreatActorSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["origin_country", "threat_level"]


class IncidentViewSet(ModelViewSet):
    queryset = Incident.objects.all().order_by("-id")
    serializer_class = IncidentSerializer
    permission_classes = [IsAuthenticated, IncidentAccessPermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
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


class AuditLogViewSet(ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related("actor").all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminUser]
    filterset_fields = ["actor", "action_type", "target_identifier"]
