from __future__ import annotations

import logging
import secrets
import string

from django.contrib.auth import authenticate
from django.utils import timezone
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
    IncidentArtifactClearSerializer,
    IncidentArtifactUploadSerializer,
    InviteUserResponseSerializer,
    InviteUserSerializer,
    IncidentLogSerializer,
    IncidentAssignmentSerializer,
    IncidentSerializer,
    IncidentStatusUpdateSerializer,
    SystemSerializer,
    ThreatActorSerializer,
    UserSerializer,
)


logger = logging.getLogger(__name__)

TEMPORARY_PASSWORD_ALPHABET = string.ascii_letters + string.digits + "!@#$%^&*()-_=+"


def generate_temporary_password(length: int = 12) -> str:
    return "".join(secrets.choice(TEMPORARY_PASSWORD_ALPHABET) for _ in range(length))


def create_audit_log(actor: User, action_type: str, target_identifier: str) -> None:
    AuditLog.objects.create(
        actor=actor if actor and actor.is_authenticated else None,
        action_type=action_type,
        target_identifier=target_identifier,
    )


def log_incident_field_change(actor: User, incident: Incident, field_name: str, old_value, new_value) -> None:
    create_audit_log(
        actor,
        f"INCIDENT_{field_name.upper()}_CHANGED",
        f"Incident #{incident.id} ({incident.title}): {field_name} changed from {old_value} to {new_value}",
    )


def format_resolution_message(incident: Incident, user: User, validation_status: str, resolution_note: str) -> str:
    resolved_at = incident.resolved_at or timezone.now()
    timestamp = timezone.localtime(resolved_at).strftime("%d/%b/%Y %H:%M:%S")
    actor_name = incident_actor_name(user)
    return f"[{timestamp}] {actor_name} RESOLVED Incident #{incident.id} as {validation_status}. Resolution: {resolution_note}."


def incident_actor_name(user: User) -> str:
    return user.name or user.username


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


class AdminUserViewSet(UserViewSet):
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .filter(role=User.Role.ANALYST, is_active=True)
            .exclude(pk=self.request.user.pk)
            .order_by("name")
        )


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

    def perform_create(self, serializer):
        threat_actor = serializer.save()
        if self.request.user.role == User.Role.ANALYST:
            try:
                create_audit_log(self.request.user, "THREAT_ACTOR_CREATED", threat_actor.name)
            except Exception:
                logger.exception("Failed to write audit log for threat actor %s", threat_actor.name)


class AdminThreatActorViewSet(ModelViewSet):
    queryset = ThreatActor.objects.all().order_by("name")
    serializer_class = ThreatActorSerializer
    permission_classes = [IsAdminUser]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def perform_create(self, serializer):
        threat_actor = serializer.save()
        try:
            create_audit_log(self.request.user, "THREAT_ACTOR_CREATED", threat_actor.name)
        except Exception:
            logger.exception("Failed to write audit log for threat actor %s", threat_actor.name)

    def perform_update(self, serializer):
        threat_actor = serializer.save()
        try:
            create_audit_log(self.request.user, "THREAT_ACTOR_EDITED", threat_actor.name)
        except Exception:
            logger.exception("Failed to write audit log for threat actor %s", threat_actor.name)


class IncidentViewSet(ModelViewSet):
    queryset = Incident.objects.all().order_by("-id")
    serializer_class = IncidentSerializer
    permission_classes = [IsAuthenticated, IncidentAccessPermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_fields = ["status", "severity", "validation_status", "is_true_positive", "system", "assigned_to", "discovery_date"]

    def get_queryset(self):
        return super().get_queryset()

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        incidents = [incident for incident in queryset if not getattr(incident, "is_deleted", False)]
        serializer = self.get_serializer(incidents, many=True)
        return Response(serializer.data)

    def build_incident_payload(self, incident: Incident, request) -> dict:
        system_data = SystemSerializer(incident.system, context={"request": request}).data
        assigned_to_data = None
        if incident.assigned_to:
            assigned_to_data = UserSerializer(incident.assigned_to, context={"request": request}).data

        actors_data = ThreatActorSerializer(incident.actors.all(), many=True, context={"request": request}).data
        logs_data = IncidentLogSerializer(incident.logs.all(), many=True, context={"request": request}).data

        evidence_image_url = None
        if incident.evidence_image:
            evidence_image_url = request.build_absolute_uri(incident.evidence_image.url) if request else incident.evidence_image.url

        forensic_report_url = None
        if incident.forensic_report:
            forensic_report_url = request.build_absolute_uri(incident.forensic_report.url) if request else incident.forensic_report.url

        return {
            "id": incident.id,
            "title": incident.title,
            "description": incident.description,
            "discovery_date": incident.discovery_date.isoformat(),
            "status": incident.status,
            "severity": incident.severity,
            "validation_status": incident.validation_status,
            "resolved_at": incident.resolved_at.isoformat() if incident.resolved_at else None,
            "resolution_summary": incident.resolution_summary,
            "is_true_positive": incident.is_true_positive,
            "evidence_image": incident.evidence_image.name if incident.evidence_image else None,
            "forensic_report": incident.forensic_report.name if incident.forensic_report else None,
            "evidence_image_url": evidence_image_url,
            "forensic_report_url": forensic_report_url,
            "system": system_data,
            "system_detail": system_data,
            "assigned_to": assigned_to_data,
            "assigned_to_detail": assigned_to_data,
            "actors": actors_data,
            "actors_detail": actors_data,
            "logs": logs_data,
        }

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            self.perform_create(serializer)
        except Exception:
            if serializer.instance is None:
                raise

            return Response(self.build_incident_payload(serializer.instance, request), status=status.HTTP_201_CREATED)

        return Response(self.build_incident_payload(serializer.instance, request), status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        incident = self.get_object()
        if incident.is_deleted:
            return Response(status=status.HTTP_204_NO_CONTENT)

        incident.is_deleted = True
        incident.save(update_fields=["is_deleted"])
        create_audit_log(
            request.user,
            "INCIDENT_DELETED",
            f"Incident #{incident.id} was soft-deleted by Admin {incident_actor_name(request.user)}",
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _reject_if_frozen(self, incident: Incident):
        if incident.status == Incident.Status.RESOLVED:
            return Response(
                {"detail": "This incident is closed. Use the admin reopen action before making changes."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    def update(self, request, *args, **kwargs):
        incident = self.get_object()
        frozen_response = self._reject_if_frozen(incident)
        if frozen_response:
            return frozen_response
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        incident = self.get_object()
        frozen_response = self._reject_if_frozen(incident)
        if frozen_response:
            return frozen_response
        return super().partial_update(request, *args, **kwargs)

    @action(detail=True, methods=["patch"], url_path="update-status")
    def update_status(self, request, pk=None):
        incident = self.get_object()
        frozen_response = self._reject_if_frozen(incident)
        if frozen_response:
            return frozen_response

        serializer = IncidentStatusUpdateSerializer(instance=incident, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        updated_fields = []
        old_status = incident.status
        old_severity = incident.severity
        old_validation_status = incident.validation_status
        old_is_true_positive = incident.is_true_positive
        old_resolved_at = incident.resolved_at

        if "status" in data:
            new_status = data["status"]
            incident.status = new_status
            if old_status != new_status:
                updated_fields.append(("status", old_status, new_status))
            if new_status == Incident.Status.RESOLVED and old_status != Incident.Status.RESOLVED:
                incident.resolved_at = timezone.now()
            elif new_status != Incident.Status.RESOLVED:
                incident.resolved_at = None

        if "severity" in data:
            new_severity = data["severity"]
            incident.severity = new_severity
            if old_severity != new_severity:
                updated_fields.append(("severity", old_severity, new_severity))

        if "validation_status" in data:
            new_validation_status = data["validation_status"]
            incident.validation_status = new_validation_status
            incident.is_true_positive = new_validation_status == Incident.ValidationStatus.TRUE_POSITIVE
            if old_validation_status != new_validation_status:
                updated_fields.append(("validation_status", old_validation_status, new_validation_status))
            if old_is_true_positive != incident.is_true_positive:
                updated_fields.append(("is_true_positive", old_is_true_positive, incident.is_true_positive))

        if "resolution_summary" in data:
            incident.resolution_summary = data["resolution_summary"]
        if "resolution_note" in data:
            incident.resolution_summary = data["resolution_note"]

        if old_resolved_at != incident.resolved_at:
            updated_fields.append(("resolved_at", old_resolved_at, incident.resolved_at))

        incident.save()

        if incident.status == Incident.Status.RESOLVED:
            resolution_message = format_resolution_message(
                incident,
                request.user,
                incident.validation_status,
                incident.resolution_summary,
            )
            IncidentLog.objects.create(
                incident=incident,
                action="Incident Resolved",
                message=resolution_message,
                performed_by=incident_actor_name(request.user),
            )
            create_audit_log(request.user, "INCIDENT_RESOLVED", resolution_message)

        for field_name, old_value, new_value in updated_fields:
            log_incident_field_change(request.user, incident, field_name, old_value, new_value)

        return Response(self.build_incident_payload(incident, request))

    @action(detail=True, methods=["post"], url_path="upload-artifacts", parser_classes=[MultiPartParser, FormParser, JSONParser])
    def upload_artifacts(self, request, pk=None):
        incident = self.get_object()
        frozen_response = self._reject_if_frozen(incident)
        if frozen_response:
            return frozen_response

        if request.user.role != User.Role.ADMIN and incident.assigned_to_id != request.user.id:
            return Response(
                {"detail": "Only the assigned analyst or an admin can upload incident files."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = IncidentArtifactUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        old_evidence_name = incident.evidence_image.name if incident.evidence_image else None
        old_report_name = incident.forensic_report.name if incident.forensic_report else None

        if "evidence_image" in serializer.validated_data:
            incident.evidence_image = serializer.validated_data["evidence_image"]
        if "forensic_report" in serializer.validated_data:
            incident.forensic_report = serializer.validated_data["forensic_report"]

        incident.save()

        if old_evidence_name and old_evidence_name != incident.evidence_image.name:
            try:
                incident.evidence_image.storage.delete(old_evidence_name)
            except Exception:
                logger.exception("Failed to remove previous evidence image for incident %s", incident.id)

        if old_report_name and old_report_name != incident.forensic_report.name:
            try:
                incident.forensic_report.storage.delete(old_report_name)
            except Exception:
                logger.exception("Failed to remove previous forensic report for incident %s", incident.id)

        create_audit_log(
            request.user,
            "INCIDENT_ARTIFACTS_UPDATED",
            f"Incident #{incident.id} artifacts updated: {', '.join(serializer.validated_data.keys())}",
        )

        return Response(self.build_incident_payload(incident, request))

    @action(detail=True, methods=["post"], url_path="remove-artifact", parser_classes=[MultiPartParser, FormParser, JSONParser])
    def remove_artifact(self, request, pk=None):
        incident = self.get_object()
        frozen_response = self._reject_if_frozen(incident)
        if frozen_response:
            return frozen_response

        if request.user.role != User.Role.ADMIN and incident.assigned_to_id != request.user.id:
            return Response(
                {"detail": "Only the assigned analyst or an admin can remove incident files."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = IncidentArtifactClearSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        artifact_type = serializer.validated_data["artifact_type"]
        old_name = None

        if artifact_type == "evidence_image":
            if not incident.evidence_image:
                return Response({"detail": "No evidence image is attached."}, status=status.HTTP_400_BAD_REQUEST)
            old_name = incident.evidence_image.name
            storage = incident.evidence_image.storage
            incident.evidence_image = None
        else:
            if not incident.forensic_report:
                return Response({"detail": "No forensic report is attached."}, status=status.HTTP_400_BAD_REQUEST)
            old_name = incident.forensic_report.name
            storage = incident.forensic_report.storage
            incident.forensic_report = None

        incident.save()

        try:
            storage.delete(old_name)
        except Exception:
            logger.exception("Failed to remove %s for incident %s", artifact_type, incident.id)

        create_audit_log(
            request.user,
            "INCIDENT_ARTIFACT_REMOVED",
            f"Incident #{incident.id} removed {artifact_type}",
        )

        return Response(self.build_incident_payload(incident, request))

    @action(detail=True, methods=["post"], url_path="reopen", permission_classes=[IsAdminUser])
    def reopen(self, request, pk=None):
        incident = self.get_object()

        if incident.status != Incident.Status.RESOLVED:
            return Response({"detail": "Only closed incidents can be reopened."}, status=status.HTTP_400_BAD_REQUEST)

        old_status = incident.status
        old_validation_status = incident.validation_status
        old_resolved_at = incident.resolved_at

        incident.status = Incident.Status.ASSIGNED if incident.assigned_to_id else Incident.Status.NEW
        incident.validation_status = Incident.ValidationStatus.PENDING
        incident.is_true_positive = False
        incident.resolved_at = None
        incident.save()

        log_incident_field_change(request.user, incident, "status", old_status, incident.status)
        log_incident_field_change(request.user, incident, "validation_status", old_validation_status, incident.validation_status)
        log_incident_field_change(request.user, incident, "resolved_at", old_resolved_at, incident.resolved_at)
        create_audit_log(request.user, "INCIDENT_REOPENED", f"Incident #{incident.id} reopened by admin {incident_actor_name(request.user)}")

        return Response(self.build_incident_payload(incident, request))

    @action(detail=True, methods=["post"])
    def claim(self, request, pk=None):
        incident = self.get_object()

        if request.user.role not in {User.Role.ADMIN, User.Role.ANALYST}:
            return Response({"detail": "Only admins and analysts can claim incidents."}, status=status.HTTP_403_FORBIDDEN)

        if incident.assigned_to_id:
            return Response({"detail": "Incident is already assigned."}, status=status.HTTP_400_BAD_REQUEST)

        if incident.status != Incident.Status.NEW:
            return Response({"detail": "Only new incidents can be claimed."}, status=status.HTTP_400_BAD_REQUEST)

        old_assigned_to = incident.assigned_to
        old_status = incident.status
        incident.assigned_to = request.user
        incident.status = Incident.Status.ASSIGNED
        incident.validation_status = Incident.ValidationStatus.PENDING
        incident.is_true_positive = False
        incident.save()

        if old_assigned_to != incident.assigned_to:
            log_incident_field_change(request.user, incident, "assigned_to", old_assigned_to, incident.assigned_to)
        if old_status != incident.status:
            log_incident_field_change(request.user, incident, "status", old_status, incident.status)

        return Response(self.build_incident_payload(incident, request))

    @action(detail=True, methods=["post"], url_path="assign-to-analyst", permission_classes=[IsAdminUser])
    def assign_to_analyst(self, request, pk=None):
        incident = self.get_object()
        if request.user.role != User.Role.ADMIN:
            return Response({"detail": "Only admins can dispatch incidents."}, status=status.HTTP_403_FORBIDDEN)

        if incident.assigned_to_id:
            return Response({"detail": "Assigned incidents can no longer be dispatched."}, status=status.HTTP_400_BAD_REQUEST)

        if incident.status != Incident.Status.NEW:
            return Response({"detail": "Only new incidents can be dispatched."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = IncidentAssignmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        old_assigned_to = incident.assigned_to
        old_status = incident.status
        analyst = serializer.validated_data["user"]
        incident.assigned_to = analyst
        incident.status = Incident.Status.ASSIGNED
        incident.validation_status = Incident.ValidationStatus.PENDING
        incident.is_true_positive = False
        incident.save()

        if old_assigned_to != incident.assigned_to:
            log_incident_field_change(request.user, incident, "assigned_to", old_assigned_to, incident.assigned_to)
        if old_status != incident.status:
            log_incident_field_change(request.user, incident, "status", old_status, incident.status)

        return Response(self.build_incident_payload(incident, request))


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
