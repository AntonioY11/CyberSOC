export type UserRole = 'ADMIN' | 'ANALYST';
export type SystemType = 'Network' | 'Application' | 'Database' | 'Server' | 'Endpoint' | 'IoT';
export type ThreatLevel = 'Low' | 'Medium' | 'High' | 'Critical';
export type ThreatActorStatus = 'UNVERIFIED' | 'VERIFIED';
export type IncidentStatus = 'NEW' | 'ASSIGNED' | 'MITIGATED' | 'RESOLVED';
export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentValidationStatus = 'PENDING' | 'TRUE_POSITIVE' | 'FALSE_POSITIVE' | 'BENIGN_POSITIVE';

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

export interface InviteUserDraft {
  email: string;
  name: string;
  role: UserRole;
}

export interface InviteUserResult {
  user: SocUser;
  temporaryPassword: string;
}

export interface AssetDraft {
  name: string;
  type: SystemType;
  ipAddress: string;
  criticality: number;
  description: string;
}

export interface ChangePasswordDraft {
  currentPassword: string;
  newPassword: string;
}

export interface ThreatActor {
  id: string;
  name: string;
  status: ThreatActorStatus;
  originCountry: string;
  tactics: string;
  threatLevel: ThreatLevel;
  createdAt: string;
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
  validationStatus: IncidentValidationStatus;
  resolvedAt: string | null;
  isDeleted?: boolean;
  isTruePositive: boolean;
  resolutionSummary: string;
  evidenceImage: string | null;
  forensicReport: string | null;
  system: SystemAsset;
  assignedTo: SocUser | null;
  actors: ThreatActor[];
  logs: IncidentLog[];
}

export interface IncidentStatusUpdateDraft {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  validationStatus?: IncidentValidationStatus;
  resolutionSummary?: string;
}

export interface IncidentDraft {
  title: string;
  description: string;
  systemId: string;
  severity: IncidentSeverity;
  actorIds: string[];
  threatActorName: string;
  evidenceImage: File | null;
  forensicReport: File | null;
}

export interface ThreatActorDraft {
  name: string;
  status: ThreatActorStatus;
  originCountry: string;
  tactics: string;
  threatLevel: ThreatLevel;
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
