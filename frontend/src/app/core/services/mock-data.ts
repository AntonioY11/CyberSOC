import { AuditLogEntry, Incident, SocUser, SystemAsset, ThreatActor } from '../models/soc.models';

export const mockUsers: SocUser[] = [
  { id: '1', name: 'Amina Raad', email: 'admin@cybersoc.local', role: 'ADMIN' },
  { id: '2', name: 'Karim Haddad', email: 'analyst@cybersoc.local', role: 'ANALYST' },
  { id: '3', name: 'Maya Chen', email: 'mchen@cybersoc.local', role: 'ANALYST' }
];

export const mockSystems: SystemAsset[] = [
  {
    id: 'srv-01',
    name: 'Identity Gateway',
    type: 'Server',
    description: 'Primary SSO and privileged access gateway.',
    ipAddress: '10.40.12.8',
    criticality: 5
  },
  {
    id: 'db-07',
    name: 'Customer Ledger DB',
    type: 'Database',
    description: 'MongoDB cluster for customer transaction ledgers.',
    ipAddress: '10.40.22.14',
    criticality: 5
  },
  {
    id: 'app-13',
    name: 'Claims Portal',
    type: 'Application',
    description: 'Public-facing claims submission application.',
    ipAddress: '172.16.8.91',
    criticality: 4
  },
  {
    id: 'net-02',
    name: 'Core Firewall',
    type: 'Network',
    description: 'Edge inspection and east-west segmentation policy.',
    ipAddress: '10.0.0.1',
    criticality: 5
  }
];

export const mockThreatActors: ThreatActor[] = [
  {
    id: 'ta-29',
    name: 'APT-29',
    originCountry: 'Russia',
    tactics: 'Credential harvesting, cloud persistence, stealthy command-and-control.',
    threatLevel: 'Critical'
  },
  {
    id: 'ta-41',
    name: 'Lazarus Group',
    originCountry: 'North Korea',
    tactics: 'Supply-chain compromise, destructive malware, financial theft.',
    threatLevel: 'High'
  },
  {
    id: 'ta-73',
    name: 'Scattered Spider',
    originCountry: 'Unknown',
    tactics: 'Social engineering, MFA fatigue, help desk impersonation.',
    threatLevel: 'High'
  }
];

export const mockIncidents: Incident[] = [
  {
    id: 'inc-1007',
    title: 'Privileged Token Replay Against Identity Gateway',
    description: 'Suspicious OAuth refresh token reuse from impossible travel locations and anomalous device fingerprints.',
    discoveryDate: '2026-04-24',
    status: 'INVESTIGATING',
    severity: 'Critical',
    isTruePositive: true,
    evidenceImage: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=900&q=80',
    forensicReport: '/api/incidents/inc-1007/report/',
    system: mockSystems[0],
    assignedTo: mockUsers[1],
    actors: [mockThreatActors[0], mockThreatActors[2]],
    logs: [
      {
        id: 'log-1',
        timestamp: '2026-04-24T19:42:00Z',
        actorName: 'Django Signal',
        action: 'Incident created',
        notes: 'Detection rule SOC-IDP-445 generated a new case file.'
      },
      {
        id: 'log-2',
        timestamp: '2026-04-24T20:08:00Z',
        actorName: 'Karim Haddad',
        action: 'Ticket claimed',
        notes: 'Initial triage confirms token reuse after MFA challenge.'
      },
      {
        id: 'log-3',
        timestamp: '2026-04-25T08:15:00Z',
        actorName: 'Karim Haddad',
        action: 'Actor linked',
        notes: 'TTP overlap with APT-29 cloud persistence campaign.'
      }
    ]
  },
  {
    id: 'inc-1011',
    title: 'MongoDB Export Volume Spike',
    description: 'Unexpected data export pattern from the customer ledger cluster with new service account usage.',
    discoveryDate: '2026-04-25',
    status: 'NEW',
    severity: 'High',
    isTruePositive: false,
    evidenceImage: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80',
    forensicReport: '/api/incidents/inc-1011/report/',
    system: mockSystems[1],
    assignedTo: null,
    actors: [mockThreatActors[1]],
    logs: [
      {
        id: 'log-4',
        timestamp: '2026-04-25T03:11:00Z',
        actorName: 'Django Signal',
        action: 'Incident created',
        notes: 'Database anomaly rule escalated export volume above threshold.'
      }
    ]
  },
  {
    id: 'inc-1013',
    title: 'Firewall Policy Tamper Attempt',
    description: 'Blocked attempt to stage an unauthorized egress rule targeting a command-and-control IP range.',
    discoveryDate: '2026-04-23',
    status: 'MITIGATED',
    severity: 'Medium',
    isTruePositive: true,
    evidenceImage: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
    forensicReport: '/api/incidents/inc-1013/report/',
    system: mockSystems[3],
    assignedTo: mockUsers[2],
    actors: [],
    logs: [
      {
        id: 'log-5',
        timestamp: '2026-04-23T11:51:00Z',
        actorName: 'Django Signal',
        action: 'Incident created',
        notes: 'Network control-plane write attempt detected.'
      },
      {
        id: 'log-6',
        timestamp: '2026-04-23T12:04:00Z',
        actorName: 'Maya Chen',
        action: 'Mitigation applied',
        notes: 'Rule staging token revoked and source subnet isolated.'
      }
    ]
  }
];

export const mockAuditLogs: AuditLogEntry[] = [
  {
    id: 'audit-1',
    timestamp: '2026-04-25T09:12:00Z',
    actorName: 'Amina Raad',
    event: 'System criticality updated',
    target: 'Identity Gateway',
    level: 'warning'
  },
  {
    id: 'audit-2',
    timestamp: '2026-04-25T08:15:00Z',
    actorName: 'Karim Haddad',
    event: 'Threat actor linked',
    target: 'inc-1007',
    level: 'critical'
  },
  {
    id: 'audit-3',
    timestamp: '2026-04-24T21:32:00Z',
    actorName: 'SOC Automation',
    event: 'JWT session rotated',
    target: 'mchen@cybersoc.local',
    level: 'info'
  }
];
