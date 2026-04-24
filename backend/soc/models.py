from __future__ import annotations

from django.contrib.auth.models import AbstractUser
from django.core.validators import FileExtensionValidator, MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        ANALYST = "ANALYST", "Analyst"

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.ANALYST)
    name = models.CharField(max_length=150)

    def save(self, *args, **kwargs):
        if not self.name:
            self.name = self.get_full_name() or self.username
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.name} ({self.role})"


class System(models.Model):
    class SystemType(models.TextChoices):
        SERVER = "Server", "Server"
        DATABASE = "Database", "Database"
        APPLICATION = "Application", "Application"
        NETWORK = "Network", "Network"

    name = models.CharField(max_length=120)
    type = models.CharField(max_length=20, choices=SystemType.choices)
    description = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(protocol="both", unpack_ipv4=True)
    criticality = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])

    def __str__(self) -> str:
        return f"{self.name} ({self.type})"


class ThreatActor(models.Model):
    class ThreatLevel(models.TextChoices):
        LOW = "Low", "Low"
        MEDIUM = "Medium", "Medium"
        HIGH = "High", "High"
        CRITICAL = "Critical", "Critical"

    name = models.CharField(max_length=120)
    origin_country = models.CharField(max_length=100)
    tactics = models.TextField()
    threat_level = models.CharField(max_length=20, choices=ThreatLevel.choices)

    def __str__(self) -> str:
        return f"{self.name} ({self.threat_level})"


class Incident(models.Model):
    class Status(models.TextChoices):
        NEW = "NEW", "New"
        ASSIGNED = "ASSIGNED", "Assigned"
        INVESTIGATING = "INVESTIGATING", "Investigating"
        MITIGATED = "MITIGATED", "Mitigated"
        RESOLVED = "RESOLVED", "Resolved"

    class Severity(models.TextChoices):
        LOW = "Low", "Low"
        MEDIUM = "Medium", "Medium"
        HIGH = "High", "High"
        CRITICAL = "Critical", "Critical"

    title = models.CharField(max_length=200)
    description = models.TextField()
    discovery_date = models.DateField(default=timezone.now)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW)
    severity = models.CharField(max_length=20, choices=Severity.choices)
    is_true_positive = models.BooleanField(default=False)
    evidence_image = models.ImageField(upload_to="incidents/images/", null=True, blank=True)
    forensic_report = models.FileField(
        upload_to="incidents/reports/",
        null=True,
        blank=True,
        validators=[FileExtensionValidator(allowed_extensions=["pdf"])],
    )
    system = models.ForeignKey(System, on_delete=models.CASCADE, related_name="incidents")
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_incidents",
    )
    actors = models.ManyToManyField(ThreatActor, related_name="incidents", blank=True)

    def __str__(self) -> str:
        return f"{self.title} [{self.status}]"


class IncidentLog(models.Model):
    action = models.CharField(max_length=100)
    message = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    performed_by = models.CharField(max_length=150)
    incident = models.ForeignKey(Incident, on_delete=models.CASCADE, related_name="logs")

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self) -> str:
        return f"{self.action} - {self.incident.title}"
