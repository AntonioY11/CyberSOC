from django.db import migrations, models


def backfill_validation_status(apps, schema_editor):
    Incident = apps.get_model("soc", "Incident")
    for incident in Incident.objects.all():
        if incident.is_true_positive:
            incident.validation_status = "TRUE_POSITIVE"
        else:
            incident.validation_status = "PENDING"
        incident.save(update_fields=["validation_status"])


class Migration(migrations.Migration):
    dependencies = [
        ("soc", "0004_incident_lifecycle_standardization"),
    ]

    operations = [
        migrations.AddField(
            model_name="incident",
            name="validation_status",
            field=models.CharField(
                choices=[
                    ("PENDING", "Pending"),
                    ("TRUE_POSITIVE", "True Positive"),
                    ("FALSE_POSITIVE", "False Positive"),
                    ("BENIGN_POSITIVE", "Benign Positive"),
                ],
                default="PENDING",
                max_length=30,
            ),
        ),
        migrations.RunPython(backfill_validation_status, migrations.RunPython.noop),
    ]
