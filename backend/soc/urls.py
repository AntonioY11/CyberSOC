from django.urls import include, path
from rest_framework.routers import DefaultRouter

from soc.views import (
    AddAssetView,
    AuditLogViewSet,
    ChangePasswordView,
    IncidentLogViewSet,
    IncidentViewSet,
    InviteUserView,
    LoginView,
    SystemViewSet,
    ThreatActorViewSet,
    UserViewSet,
)

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")
router.register("systems", SystemViewSet, basename="system")
router.register("threat-actors", ThreatActorViewSet, basename="threat-actor")
router.register("incidents", IncidentViewSet, basename="incident")
router.register("incident-logs", IncidentLogViewSet, basename="incident-log")
router.register("audit-logs", AuditLogViewSet, basename="audit-log")

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="auth-change-password"),
    path("admin/invite-user/", InviteUserView.as_view(), name="admin-invite-user"),
    path("admin/add-asset/", AddAssetView.as_view(), name="admin-add-asset"),
    path("", include(router.urls)),
]
