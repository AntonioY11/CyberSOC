from __future__ import annotations

from django.db.models.signals import m2m_changed, post_save, pre_save
from django.dispatch import receiver

from soc.middleware import get_current_user
from soc.models import Incident, IncidentLog

TRACKED_FIELDS = ["title", "description", "discovery_date", "status", "severity", "is_true_positive", "system_id", "assigned_to_id"]


def resolve_performed_by(instance: Incident) -> str:
    acting_user = get_current_user()
    if acting_user and getattr(acting_user, "is_authenticated", False):
        return acting_user.name or acting_user.username
    if instance.assigned_to:
        return instance.assigned_to.name or instance.assigned_to.username
    return "System"


@receiver(pre_save, sender=Incident)
def cache_previous_incident_state(sender, instance: Incident, **kwargs):
    if not instance.pk:
        instance._old_values = None
        return
    try:
        old_instance = Incident.objects.get(pk=instance.pk)
    except Incident.DoesNotExist:
        instance._old_values = None
        return
    instance._old_values = {field: getattr(old_instance, field) for field in TRACKED_FIELDS}


@receiver(post_save, sender=Incident)
def create_incident_audit_log(sender, instance: Incident, created: bool, **kwargs):
    performed_by = resolve_performed_by(instance)

    if created:
        action = "Incident Created"
        message = (
            f"Incident created with status={instance.status}, severity={instance.severity}, "
            f"true_positive={instance.is_true_positive}."
        )
    else:
        changes = []
        old_values = getattr(instance, "_old_values", None) or {}
        for field in TRACKED_FIELDS:
            old_value = old_values.get(field)
            new_value = getattr(instance, field)
            if old_value != new_value:
                changes.append(f"{field.replace('_id', '')}: {old_value} -> {new_value}")

        action = "Incident Updated"
        message = "No tracked fields changed during save."
        if changes:
            message = "; ".join(changes)

    IncidentLog.objects.create(
        incident=instance,
        action=action,
        message=message,
        performed_by=performed_by,
    )


@receiver(m2m_changed, sender=Incident.actors.through)
def create_incident_actor_audit_log(sender, instance: Incident, action: str, pk_set, **kwargs):
    if action not in {"post_add", "post_remove", "post_clear"}:
        return

    if action == "post_add":
        message = f"Threat actor links added: {sorted(pk_set)}"
        log_action = "Threat Actor Linked"
    elif action == "post_remove":
        message = f"Threat actor links removed: {sorted(pk_set)}"
        log_action = "Threat Actor Unlinked"
    else:
        message = "All threat actor links cleared."
        log_action = "Threat Actor Cleared"

    IncidentLog.objects.create(
        incident=instance,
        action=log_action,
        message=message,
        performed_by=resolve_performed_by(instance),
    )
