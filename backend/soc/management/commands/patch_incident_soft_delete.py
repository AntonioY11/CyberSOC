from django.core.management.base import BaseCommand

from soc.models import Incident


class Command(BaseCommand):
    help = "Patch existing incidents so is_deleted is set to False when missing or null."

    def handle(self, *args, **options):
        patched = 0
        for incident in Incident.objects.all():
            if getattr(incident, "is_deleted", None) is not False:
                incident.is_deleted = False
                incident.save(update_fields=["is_deleted"])
                patched += 1

        self.stdout.write(self.style.SUCCESS(f"Patched {patched} incidents."))