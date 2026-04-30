from django.db import migrations, models


def backfill_resolved_at(apps, schema_editor):
    Incident = apps.get_model("soc", "Incident")
    from django.utils import timezone

    now = timezone.now()
    for incident in Incident.objects.filter(status="RESOLVED", resolved_at__isnull=True):
        incident.resolved_at = now
        incident.save(update_fields=["resolved_at"])


class Migration(migrations.Migration):
    dependencies = [
        ("soc", "0005_incident_validation_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="incident",
            name="resolved_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(backfill_resolved_at, migrations.RunPython.noop),
    ]
