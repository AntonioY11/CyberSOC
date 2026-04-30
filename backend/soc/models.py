from __future__ import annotations

from django.contrib.auth.models import AbstractUser
from django.core.validators import FileExtensionValidator, MaxValueValidator, MinValueValidator, RegexValidator
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
        if self.role == self.Role.ADMIN:
            self.is_staff = True
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.name} ({self.role})"


class System(models.Model):
    class SystemType(models.TextChoices):
        NETWORK = "Network", "Network"
        APPLICATION = "Application", "Application"
        DATABASE = "Database", "Database"
        SERVER = "Server", "Server"
        ENDPOINT = "Endpoint", "Endpoint"
        IOT = "IoT", "IoT"

    name = models.CharField(max_length=120)
    type = models.CharField(max_length=20, choices=SystemType.choices)
    description = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(
        protocol="IPv4",
        validators=[
            RegexValidator(
                regex=r"^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$",
                message="Enter a valid IPv4 address.",
            )
        ],
    )
    criticality = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])

    def __str__(self) -> str:
        return f"{self.name} ({self.type})"


class ThreatActor(models.Model):
    class Status(models.TextChoices):
        UNVERIFIED = "UNVERIFIED", "Unverified"
        VERIFIED = "VERIFIED", "Verified"

    class ThreatLevel(models.TextChoices):
        LOW = "Low", "Low"
        MEDIUM = "Medium", "Medium"
        HIGH = "High", "High"
        CRITICAL = "Critical", "Critical"

    name = models.CharField(
        max_length=120,
        validators=[
            RegexValidator(
                regex=r"^[A-Za-z0-9][A-Za-z0-9\s.'()/_&,-]*$",
                message="Enter a valid threat actor name.",
            )
        ],
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UNVERIFIED)
    origin_country = models.CharField(max_length=100, blank=True, default="")
    tactics = models.TextField(blank=True, default="")
    threat_level = models.CharField(max_length=20, choices=ThreatLevel.choices, default=ThreatLevel.LOW)
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self) -> str:
        return f"{self.name} ({self.threat_level})"


class Incident(models.Model):
    class STATUS(models.TextChoices):
        NEW = "NEW", "New"
        ASSIGNED = "ASSIGNED", "Assigned"
        MITIGATED = "MITIGATED", "Mitigated"
        RESOLVED = "RESOLVED", "Resolved"

    class SEVERITY(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"
        CRITICAL = "CRITICAL", "Critical"

    class VALIDATION_STATUS(models.TextChoices):
        PENDING = "PENDING", "Pending"
        TRUE_POSITIVE = "TRUE_POSITIVE", "True Positive"
        FALSE_POSITIVE = "FALSE_POSITIVE", "False Positive"
        BENIGN_POSITIVE = "BENIGN_POSITIVE", "Benign Positive"

    Status = STATUS
    Severity = SEVERITY
    ValidationStatus = VALIDATION_STATUS

    title = models.CharField(max_length=200)
    description = models.TextField()
    discovery_date = models.DateField(default=timezone.now)
    status = models.CharField(max_length=20, choices=STATUS.choices, default=STATUS.NEW)
    severity = models.CharField(max_length=20, choices=SEVERITY.choices, default=SEVERITY.LOW)
    validation_status = models.CharField(
        max_length=30,
        choices=VALIDATION_STATUS.choices,
        default=VALIDATION_STATUS.PENDING,
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)
    is_true_positive = models.BooleanField(default=False)
    resolution_summary = models.TextField(blank=True, default="")
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


class AuditLog(models.Model):
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs")
    action_type = models.CharField(max_length=100)
    target_identifier = models.CharField(max_length=200)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self) -> str:
        actor_id = self.actor_id if self.actor_id is not None else "system"
        return f"{self.action_type} by {actor_id} on {self.target_identifier}"
