from django.db import migrations, models


def backfill_is_deleted(apps, schema_editor):
    Incident = apps.get_model("soc", "Incident")
    for incident in Incident.objects.all():
        if getattr(incident, "is_deleted", None) is not False:
            incident.is_deleted = False
            incident.save(update_fields=["is_deleted"])


class Migration(migrations.Migration):
    dependencies = [
        ("soc", "0006_incident_resolved_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="incident",
            name="is_deleted",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(backfill_is_deleted, migrations.RunPython.noop),
    ]