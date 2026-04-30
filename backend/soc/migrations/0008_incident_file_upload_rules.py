from django.db import migrations, models
import django.core.validators
import soc.models


class Migration(migrations.Migration):
    dependencies = [
        ("soc", "0007_incident_is_deleted"),
    ]

    operations = [
        migrations.AlterField(
            model_name="incident",
            name="evidence_image",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to=soc.models.incident_evidence_upload_to,
                validators=[django.core.validators.FileExtensionValidator(allowed_extensions=["jpg", "png"])],
            ),
        ),
        migrations.AlterField(
            model_name="incident",
            name="forensic_report",
            field=models.FileField(
                blank=True,
                null=True,
                upload_to=soc.models.incident_report_upload_to,
                validators=[django.core.validators.FileExtensionValidator(allowed_extensions=["pdf"])],
            ),
        ),
    ]
