from __future__ import annotations

from rest_framework.permissions import BasePermission


class IsAdminForSystemWrite(BasePermission):
    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False

        if view.action in {"create", "update", "partial_update", "destroy"}:
            return request.user.role == "ADMIN"
        return True


class IncidentAccessPermission(BasePermission):
    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False

        if view.action == "create":
            return request.user.role in {"ADMIN", "ANALYST"}

        if view.action == "destroy":
            return request.user.role == "ADMIN"

        return request.user.role in {"ADMIN", "ANALYST"}

    def has_object_permission(self, request, view, obj) -> bool:
        if view.action in {"update", "partial_update", "update_status"}:
            return obj.assigned_to_id == request.user.id

        if view.action in {"upload_artifacts", "remove_artifact"}:
            return request.user.role == "ADMIN" or obj.assigned_to_id == request.user.id

        return True
