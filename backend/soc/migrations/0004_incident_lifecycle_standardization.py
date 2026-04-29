from django.db import migrations, models


def standardize_incident_choices(apps, schema_editor):
    Incident = apps.get_model("soc", "Incident")

    for incident in Incident.objects.all():
        changed = False

        if incident.status == "INVESTIGATING":
            incident.status = "ASSIGNED"
            changed = True

        severity_map = {
            "Low": "LOW",
            "Medium": "MEDIUM",
            "High": "HIGH",
            "Critical": "CRITICAL",
        }
        if incident.severity in severity_map:
            incident.severity = severity_map[incident.severity]
            changed = True

        if changed:
            incident.save(update_fields=["status", "severity"])


class Migration(migrations.Migration):

    dependencies = [
        ("soc", "0003_threat_actor_status_created_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="incident",
            name="resolution_summary",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AlterField(
            model_name="incident",
            name="status",
            field=models.CharField(
                choices=[
                    ("NEW", "New"),
                    ("ASSIGNED", "Assigned"),
                    ("MITIGATED", "Mitigated"),
                    ("RESOLVED", "Resolved"),
                ],
                default="NEW",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="incident",
            name="severity",
            field=models.CharField(
                choices=[
                    ("LOW", "Low"),
                    ("MEDIUM", "Medium"),
                    ("HIGH", "High"),
                    ("CRITICAL", "Critical"),
                ],
                default="LOW",
                max_length=20,
            ),
        ),
        migrations.RunPython(standardize_incident_choices, migrations.RunPython.noop),
    ]