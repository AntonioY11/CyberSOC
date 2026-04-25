export type UserRole = 'ADMIN' | 'ANALYST';
export type SystemType = 'Server' | 'Database' | 'Application' | 'Network';
export type ThreatLevel = 'Low' | 'Medium' | 'High' | 'Critical';
export type IncidentStatus = 'NEW' | 'ASSIGNED' | 'INVESTIGATING' | 'MITIGATED' | 'RESOLVED';
export type IncidentSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

export interface SocUser {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface SystemAsset {
  id: string;
  name: string;
  type: SystemType;
  description: string;
  ipAddress: string;
  criticality: number;
}

export interface ThreatActor {
  id: string;
  name: string;
  originCountry: string;
  tactics: string;
  threatLevel: ThreatLevel;
}

export interface IncidentLog {
  id: string;
  timestamp: string;
  actorName: string;
  action: string;
  notes: string;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  discoveryDate: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  isTruePositive: boolean;
  evidenceImage: string | null;
  forensicReport: string | null;
  system: SystemAsset;
  assignedTo: SocUser | null;
  actors: ThreatActor[];
  logs: IncidentLog[];
}

export interface IncidentDraft {
  title: string;
  description: string;
  systemId: string;
  severity: IncidentSeverity;
  actorIds: string[];
  evidenceImage: File | null;
  forensicReport: File | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  user: SocUser;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  event: string;
  target: string;
  level: 'info' | 'warning' | 'critical';
}
