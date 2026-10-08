/**
 * ReachOut OS Core Type Definitions
 */

export type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  isKillSwitchActive: boolean;
  killSwitchReason?: string;
  killSwitchTriggeredAt?: string;
  killSwitchTriggeredBy?: string;
  createdAt: string;
}

export type ContactStatus = 'ACTIVE' | 'BLOCKED' | 'OPTED_OUT' | 'ARCHIVED' | 'INVALID';

export type ChannelType = 'WHATSAPP' | 'EMAIL' | 'SMS';

export interface ChannelAddress {
  id: string;
  channelType: ChannelType;
  address: string;
  isPrimary: boolean;
  isVerified: boolean;
  isDeliverable?: boolean;
}

export interface CommunicationPreference {
  channel: ChannelType;
  marketingAllowed: boolean;
  transactionalAllowed: boolean;
  optedOutAt?: string;
  optOutReason?: string;
}

export interface TimelineEvent {
  id: string;
  contactId: string;
  tenantId?: string;
  eventType: 
    | 'CONTACT_CREATED' 
    | 'CONTACT_IMPORTED' 
    | 'CONTACT_UPDATED' 
    | 'CAMPAIGN_ADDED' 
    | 'MESSAGE_PREPARED' 
    | 'WHATSAPP_OPENED' 
    | 'EMAIL_OPENED' 
    | 'USER_MARKED_SENT' 
    | 'OPTED_OUT' 
    | 'BLOCKED' 
    | 'NOTE_ADDED' 
    | 'TAG_ADDED'
    | 'INBOUND_MESSAGE_RECEIVED'
    | 'OPT_OUT_RECEIVED';
  actor: string;
  actorId?: string;
  actorName?: string;
  description: string;
  campaignName?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface Contact {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  companyName: string;
  jobTitle?: string;
  phone: string; // canonical normalized phone e.g. +91XXXXXXXXXX
  email: string;
  city: string;
  state: string;
  country: string;
  status: ContactStatus;
  source: string;
  leadStatus: 'LEAD' | 'PROSPECT' | 'RETAILER' | 'DISTRIBUTOR' | 'WHOLESALE' | 'VIP';
  notes: string;
  tags: string[];
  customFields: Record<string, string>;
  channelAddresses: ChannelAddress[];
  preferences: Record<ChannelType, CommunicationPreference>;
  isGloballyBlocked: boolean;
  blockedReason?: string;
  lastInteractionAt?: string;
  lastMessageSentAt?: string;
  lastInboundMessageAt?: string;
  customerServiceWindowExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InboundMessage {
  id: string;
  tenantId: string;
  contactId?: string;
  channel: ChannelType;
  senderAddress: string;
  senderName?: string;
  messageType: string;
  messageBody: string;
  rawPayload?: any;
  isOptOutTrigger: boolean;
  windowOpenedUntil?: string;
  receivedAt: string;
  createdAt: string;
}

export interface ContactList {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  type: 'STATIC' | 'DYNAMIC';
  rules?: {
    city?: string;
    leadStatus?: string;
    tag?: string;
    hasWhatsApp?: boolean;
    marketingAllowed?: boolean;
  };
  contactIds: string[];
  createdAt: string;
}

export interface MessageTemplate {
  id: string;
  tenantId: string;
  name: string;
  channel: ChannelType;
  subject?: string;
  body: string;
  version: number;
  availableVariables: string[];
  attachmentName?: string;
  attachmentSize?: string;
  attachmentType?: string;
  category: 'INTRODUCTION' | 'FOLLOW_UP' | 'PRICING' | 'CATALOG' | 'FESTIVE';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type CampaignStatus = 
  | 'DRAFT' 
  | 'REVIEW' 
  | 'APPROVED' 
  | 'ACTIVE' 
  | 'PAUSED' 
  | 'COMPLETED';

export type RecipientStatus = 
  | 'QUEUED' 
  | 'READY' 
  | 'OPENED' 
  | 'USER_SENT' 
  | 'SKIPPED' 
  | 'BLOCKED' 
  | 'OPTED_OUT';

export interface CampaignRecipient {
  id: string;
  tenantId?: string;
  campaignId: string;
  contactId: string;
  contactName: string;
  companyName: string;
  channel: ChannelType;
  channelAddress: string;
  resolvedMessage: string;
  resolvedSubject?: string;
  attachmentName?: string;
  status: RecipientStatus;
  claimedByOperator?: string;
  claimedAt?: string;
  openedAt?: string;
  userSentAt?: string;
  skippedAt?: string;
  skipReason?: string;
  policyNotes?: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  channel: ChannelType;
  status: CampaignStatus;
  targetListId?: string;
  targetListName: string;
  templateId?: string;
  templateVersion: number;
  templateSnapshot: {
    name: string;
    subject?: string;
    body: string;
    attachmentName?: string;
  };
  isDryRun: boolean;
  isABTest?: boolean;
  abVariants?: ABVariant[];
  winningVariantId?: string;
  assignedOperator?: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  startedAt?: string;
  completedAt?: string;
  recipientsCount: number;
  sentCount: number;
  openedCount: number;
  skippedCount: number;
  blockedCount: number;
  createdAt: string;
}

export interface ABVariant {
  id: string;
  name: string;
  templateId?: string;
  templateSnapshot: {
    name: string;
    subject?: string;
    body: string;
    attachmentName?: string;
  };
  allocationPct: number;
  sentCount: number;
  openedCount: number;
  repliedCount: number;
}

// ================= CADENCE & FOLLOW-UP SEQUENCES =================
export interface CadenceStep {
  stepNumber: number;
  delayDays: number;
  templateId?: string;
  templateSnapshot?: {
    name: string;
    subject?: string;
    body: string;
    attachmentName?: string;
  };
  title: string;
}

export interface CadenceSequence {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  channel: ChannelType;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  steps: CadenceStep[];
  autoExitOnReply: boolean;
  enrolledCount?: number;
  completedCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CadenceEnrollment {
  id: string;
  tenantId: string;
  cadenceId: string;
  contactId: string;
  contactName?: string;
  companyName?: string;
  channelAddress?: string;
  currentStep: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED_REPLIED' | 'OPTED_OUT' | 'SKIPPED';
  nextDueAt: string;
  stepHistory: Array<{
    stepNumber: number;
    dispatchedAt?: string;
    operatorName?: string;
    status: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

// ================= SMART INBOX & 2-WAY MESSAGING =================
export interface CannedResponse {
  id: string;
  tenantId: string;
  title: string;
  shortcut: string;
  category: 'SALES' | 'SUPPORT' | 'PAYMENTS' | 'SAMPLES' | 'GENERAL';
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  contactId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  channel: ChannelType;
  body: string;
  status: 'DELIVERED' | 'READ' | 'FAILED' | 'RECEIVED';
  senderAddress: string;
  senderName?: string;
  receivedAt: string;
  createdAt: string;
}

export interface ConversationThread {
  contactId: string;
  contactName: string;
  companyName: string;
  phone: string;
  email: string;
  leadStatus: string;
  isGloballyBlocked: boolean;
  lastMessageAt: string;
  lastMessageDirection: 'INBOUND' | 'OUTBOUND';
  lastMessageSnippet: string;
  unreadInboundCount: number;
  serviceWindowExpiresAt?: string;
  messages: ConversationMessage[];
}

// ================= DEDUPLICATION & MERGE =================
export interface DuplicateCandidate {
  primaryContact: Contact;
  duplicateContact: Contact;
  matchReason: string;
  matchScore: number; // 0 to 100
  conflictingFields: Array<{
    fieldName: string;
    primaryValue: any;
    duplicateValue: any;
  }>;
}

export interface PolicyCheckResult {
  canSend: boolean;
  reasons: {
    passed: boolean;
    code: string;
    message: string;
  }[];
  primaryBlockReason?: string;
}

export interface DataQualityReport {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  warningRows: number;
  issues: {
    rowNumber: number;
    field: string;
    value: string;
    error: string;
    severity: 'ERROR' | 'WARNING' | 'INFO';
  }[];
}

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  action: string;
  entityType: 'CONTACT' | 'CAMPAIGN' | 'TEMPLATE' | 'POLICY' | 'WORKSPACE' | 'IMPORT' | 'ADMIN';
  entityId: string;
  metadata: Record<string, any>;
  ipAddress: string;
  previousHash?: string;
  entryHash?: string;
  createdAt: string;
}

export interface TenantMemberDetail {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
  joinedAt: string;
  status: 'ACTIVE' | 'SUSPENDED';
}

export interface ComplianceReviewItem {
  id: string;
  tenantId: string;
  createdAt: string;
  action: string;
  actorName: string;
  actorRole: string;
  entityId: string;
  decision: 'HUMAN_REVIEW' | 'BLOCK' | 'ALLOW';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  violations: Array<{ ruleId: string; reason: string }>;
  contactPhone?: string;
  metadata: any;
  isOverridden?: boolean;
  overrideReason?: string;
}

export interface GlobalBlockItem {
  id: string;
  displayName: string;
  phone: string;
  email?: string;
  companyName?: string;
  isGloballyBlocked: boolean;
  blockedReason?: string;
  updatedAt: string;
  status: string;
}

export interface SystemHealthStats {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  dbLatencyMs: number;
  policyEngineVersion: string;
  tableCounts: {
    contacts: number;
    campaigns: number;
    recipients: number;
    auditLogs: number;
    lists: number;
    templates: number;
    members: number;
  };
  killSwitch: {
    isActive: boolean;
    reason?: string;
    triggeredAt?: string;
    triggeredBy?: string;
  };
  serverUptimeSeconds: number;
  timestamp: string;
}

