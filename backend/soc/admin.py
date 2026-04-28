from django.contrib import admin

from soc.models import AuditLog, Incident, IncidentLog, System, ThreatActor, User

admin.site.register(User)
admin.site.register(System)
admin.site.register(ThreatActor)
admin.site.register(Incident)
admin.site.register(IncidentLog)
admin.site.register(AuditLog)
