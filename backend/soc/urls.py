from django.urls import include, path
from rest_framework.routers import DefaultRouter

from soc.views import IncidentLogViewSet, IncidentViewSet, SystemViewSet, ThreatActorViewSet, UserViewSet

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")
router.register("systems", SystemViewSet, basename="system")
router.register("threat-actors", ThreatActorViewSet, basename="threat-actor")
router.register("incidents", IncidentViewSet, basename="incident")
router.register("incident-logs", IncidentLogViewSet, basename="incident-log")

urlpatterns = [
    path("", include(router.urls)),
]
