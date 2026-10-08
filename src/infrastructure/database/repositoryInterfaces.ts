import {
  Contact,
  ContactList,
  Campaign,
  CampaignRecipient,
  MessageTemplate,
  AuditLogEntry,
  Tenant,
  User,
  TimelineEvent,
  Role
} from '../../types';

export interface IContactRepository {
  findAll(tenantId: string, search?: string, tag?: string, listId?: string, status?: string): Promise<Contact[]>;
  findById(id: string, tenantId?: string): Promise<Contact | null>;
  create(contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contact>;
  update(id: string, updates: Partial<Contact>, tenantId?: string): Promise<Contact>;
  delete(id: string, tenantId?: string): Promise<void>;
  bulkCreate(contacts: Array<Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>>): Promise<{ created: number; updated: number; skipped: number }>;
  addTimelineEvent(event: Omit<TimelineEvent, 'id' | 'createdAt'>): Promise<TimelineEvent>;
  getTimeline(contactId: string): Promise<TimelineEvent[]>;
  mergeContacts?(primaryId: string, duplicateId: string, overrides: Partial<Contact>, tenantId: string): Promise<Contact>;
  findDuplicateCandidates?(tenantId: string): Promise<any[]>;
}

export interface ICampaignRepository {
  findAll(tenantId: string): Promise<Campaign[]>;
  findById(id: string, tenantId?: string): Promise<Campaign | null>;
  create(campaign: Omit<Campaign, 'id' | 'createdAt' | 'recipientsCount' | 'sentCount' | 'openedCount' | 'skippedCount' | 'blockedCount'> & { recipientsCount?: number }): Promise<Campaign>;
  update(id: string, updates: Partial<Campaign>, tenantId?: string): Promise<Campaign>;
  updateStatus?(id: string, tenantId: string, status: any): Promise<Campaign>;
  getRecipients(campaignId: string): Promise<CampaignRecipient[]>;
  getRecipientById(recipientId: string): Promise<CampaignRecipient | null>;
  updateRecipient(recipientId: string, updates: Partial<CampaignRecipient>): Promise<CampaignRecipient>;
  addRecipients(recipients: Array<Omit<CampaignRecipient, 'id' | 'createdAt'>>, tenantId?: string): Promise<number>;
  delete(id: string, tenantId?: string): Promise<void>;
}

export interface ITemplateRepository {
  findAll(tenantId: string): Promise<MessageTemplate[]>;
  findById(id: string, tenantId?: string): Promise<MessageTemplate | null>;
  create(template: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<MessageTemplate>;
  update(id: string, updates: Partial<MessageTemplate>, tenantId?: string): Promise<MessageTemplate>;
  delete(id: string, tenantId?: string): Promise<void>;
}

export interface IContactListRepository {
  findAll(tenantId: string): Promise<ContactList[]>;
  findById(id: string, tenantId?: string): Promise<ContactList | null>;
  create(list: Omit<ContactList, 'id' | 'createdAt'>): Promise<ContactList>;
  update(id: string, updates: Partial<ContactList>, tenantId?: string): Promise<ContactList>;
  delete(id: string, tenantId?: string): Promise<void>;
}

export interface IAuditRepository {
  log(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>): Promise<AuditLogEntry>;
  findAll(tenantId: string, limit?: number): Promise<AuditLogEntry[]>;
}

export interface ITenantRepository {
  getTenant(id: string): Promise<Tenant | null>;
  updateKillSwitch(id: string, isActive: boolean, reason?: string, by?: string): Promise<Tenant>;
  toggleKillSwitch?(id: string, isActive: boolean, reason?: string, by?: string): Promise<Tenant>;
  getCurrentUser(): Promise<User>;
  switchUserRole?(role: Role): Promise<User>;
}

export interface IAdminRepository {
  listMembers(tenantId: string): Promise<any[]>;
  updateMemberRole(tenantId: string, memberId: string, newRole: Role, actor: User): Promise<any>;
  removeMember(tenantId: string, memberId: string, actor: User): Promise<void>;
  inviteMember(tenantId: string, email: string, name: string, role: Role, actor: User): Promise<any>;
  getComplianceReviews(tenantId: string, limit?: number): Promise<any[]>;
  resolveComplianceReview(tenantId: string, reviewId: string, decision: 'ALLOW' | 'BLOCK', reason: string, actor: User): Promise<any>;
  getGlobalBlocklist(tenantId: string): Promise<any[]>;
  addGlobalBlock(tenantId: string, identifier: string, reason: string, actor: User): Promise<any>;
  removeGlobalBlock(tenantId: string, contactId: string, actor: User): Promise<void>;
  getSystemHealth(tenantId: string): Promise<any>;
}

export interface ICadenceRepository {
  findAll(tenantId: string): Promise<any[]>;
  findById(id: string, tenantId: string): Promise<any | null>;
  create(data: any): Promise<any>;
  update(id: string, updates: any, tenantId: string): Promise<any>;
  delete(id: string, tenantId: string): Promise<void>;
  enrollContacts(cadenceId: string, contactIds: string[], tenantId: string): Promise<number>;
  getDueToday(tenantId: string): Promise<any[]>;
  advanceStep(enrollmentId: string, operatorName: string, tenantId: string): Promise<any>;
  autoExitOnReply(contactPhone: string, tenantId?: string): Promise<number>;
}

export interface ICannedResponseRepository {
  findAll(tenantId: string): Promise<any[]>;
  create(data: any): Promise<any>;
  delete(id: string, tenantId: string): Promise<void>;
}

export interface IInboxRepository {
  getThreads(tenantId: string): Promise<any[]>;
  getThreadMessages(contactId: string, tenantId: string): Promise<any[]>;
  recordOutbound(data: { tenantId: string; contactId: string; channel: string; body: string; operatorName: string }): Promise<any>;
}

