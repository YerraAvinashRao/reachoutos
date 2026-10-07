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
}

export interface ICampaignRepository {
  findAll(tenantId: string): Promise<Campaign[]>;
  findById(id: string, tenantId?: string): Promise<Campaign | null>;
  create(campaign: Omit<Campaign, 'id' | 'createdAt' | 'recipientsCount' | 'sentCount' | 'openedCount' | 'skippedCount' | 'blockedCount'>): Promise<Campaign>;
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
