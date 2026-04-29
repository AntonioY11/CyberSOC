import {
  IncidentSeverity,
  IncidentStatus,
  SystemType,
  ThreatLevel,
  ThreatActorStatus,
  UserRole
} from './soc.models';

export interface BackendUser {
  id: number | string;
  email: string;
  role: UserRole;
  name: string;
}

export interface BackendSystemAsset {
  id: number | string;
  name: string;
  type: SystemType;
  description: string;
  ip_address: string;
  criticality: number;
}

export interface BackendThreatActor {
  id: number | string;
  name: string;
  status: ThreatActorStatus;
  origin_country: string;
  tactics: string;
  threat_level: ThreatLevel;
  created_at: string;
}

export interface BackendIncidentLog {
  id: number | string;
  incident: number | string;
  timestamp: string;
  actor_name?: string;
  actorName?: string;
  performed_by?: string;
  action: string;
  notes?: string;
  message?: string;
}

export interface BackendIncident {
  id: number | string;
  title: string;
  description: string;
  discovery_date: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  is_true_positive: boolean;
  resolution_summary: string;
  evidence_image: string | null;
  forensic_report: string | null;
  evidence_image_url?: string | null;
  forensic_report_url?: string | null;
  system: BackendSystemAsset | number | string;
  system_detail?: BackendSystemAsset;
  assigned_to: BackendUser | number | string | null;
  assigned_to_detail?: BackendUser | null;
  actors: BackendThreatActor[] | Array<number | string>;
  actors_detail?: BackendThreatActor[];
  logs?: BackendIncidentLog[];
}

export interface BackendAuthSession {
  access: string;
  refresh?: string;
  user: BackendUser;
}

export interface BackendInviteUserResponse {
  user: BackendUser;
  temporary_password: string;
}

export interface BackendAuditLog {
  id: number | string;
  actor_id: number | string | null;
  actor_name?: string;
  action_type: string;
  target_identifier: string;
  timestamp: string;
}
