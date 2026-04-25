import {
  BackendAuthSession,
  BackendIncident,
  BackendIncidentLog,
  BackendSystemAsset,
  BackendThreatActor,
  BackendUser
} from '../models/backend.models';
import {
  AuthSession,
  AuditLogEntry,
  Incident,
  IncidentLog,
  SocUser,
  SystemAsset,
  ThreatActor
} from '../models/soc.models';

export function mapUser(user: BackendUser): SocUser {
  return {
    id: String(user.id),
    email: user.email,
    role: user.role,
    name: user.name
  };
}

export function mapSystem(system: BackendSystemAsset): SystemAsset {
  return {
    id: String(system.id),
    name: system.name,
    type: system.type,
    description: system.description,
    ipAddress: system.ip_address,
    criticality: system.criticality
  };
}

export function mapThreatActor(actor: BackendThreatActor): ThreatActor {
  return {
    id: String(actor.id),
    name: actor.name,
    originCountry: actor.origin_country,
    tactics: actor.tactics,
    threatLevel: actor.threat_level
  };
}

export function mapIncidentLog(log: BackendIncidentLog): IncidentLog {
  return {
    id: String(log.id),
    timestamp: log.timestamp,
    actorName: log.actor_name ?? log.actorName ?? log.performed_by ?? 'SOC Automation',
    action: log.action,
    notes: log.notes ?? log.message ?? ''
  };
}

export function mapAuditLog(log: BackendIncidentLog): AuditLogEntry {
  return {
    id: String(log.id),
    timestamp: log.timestamp,
    actorName: log.actor_name ?? log.actorName ?? log.performed_by ?? 'SOC Automation',
    event: log.action,
    target: `Incident ${log.incident}`,
    level: 'info'
  };
}

export function mapIncident(incident: BackendIncident): Incident {
  const system = typeof incident.system === 'object' ? incident.system : incident.system_detail;
  const assignedTo =
    incident.assigned_to && typeof incident.assigned_to === 'object'
      ? incident.assigned_to
      : incident.assigned_to_detail;
  const actors = incident.actors_detail ?? incident.actors.filter((actor) => typeof actor === 'object');

  if (!system) {
    throw new Error(`Incident ${incident.id} is missing system detail data.`);
  }

  return {
    id: String(incident.id),
    title: incident.title,
    description: incident.description,
    discoveryDate: incident.discovery_date,
    status: incident.status,
    severity: incident.severity,
    isTruePositive: incident.is_true_positive,
    evidenceImage: incident.evidence_image_url ?? incident.evidence_image,
    forensicReport: incident.forensic_report_url ?? incident.forensic_report,
    system: mapSystem(system),
    assignedTo: assignedTo ? mapUser(assignedTo) : null,
    actors: actors.map(mapThreatActor),
    logs: (incident.logs ?? []).map(mapIncidentLog)
  };
}

export function mapAuthSession(session: BackendAuthSession): AuthSession {
  return {
    accessToken: session.access,
    refreshToken: session.refresh,
    user: mapUser(session.user)
  };
}
