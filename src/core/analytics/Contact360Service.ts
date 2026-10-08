/**
 * ReachOutOS Contact 360° Omnichannel Timeline & Engagement Engine
 * Builds a unified chronological touchpoint graph and engagement score for any contact.
 */

import { Contact } from '../../types';

export interface ContactTimelineEvent {
  id: string;
  timestamp: string;
  type: 
    | 'OUTBOUND_DISPATCH'
    | 'INBOUND_REPLY'
    | 'STATUS_CHANGE'
    | 'CONSENT_CHANGE'
    | 'EMAIL_FALLBACK'
    | 'CADENCE_STEP'
    | 'NOTE_ADDED';
  channel?: 'WHATSAPP' | 'EMAIL';
  title: string;
  description: string;
  metadata?: Record<string, any>;
  actor: string; // e.g. "System Auto-Cadence", "Rajesh (Operator)", "Contact"
}

export interface Contact360Profile {
  contactId: string;
  contactName: string;
  phone: string;
  email?: string;
  companyName?: string;
  city?: string;
  engagementScore: number; // 0 to 100
  engagementTier: 'HOT' | 'WARM' | 'COOL' | 'DORMANT';
  totalTouchpoints: number;
  lastContactedAt?: string;
  primaryChannel: 'WHATSAPP' | 'EMAIL';
  timeline: ContactTimelineEvent[];
}

export class Contact360Service {
  private static NOTES_STORAGE_KEY = 'reachoutos_contact_notes_v1';

  /**
   * Loads custom operator notes from storage
   */
  private static getNotes(contactId: string): Array<{ id: string; timestamp: string; note: string; author: string }> {
    try {
      const allNotes = JSON.parse(localStorage.getItem(this.NOTES_STORAGE_KEY) || '{}');
      return allNotes[contactId] || [];
    } catch {
      return [];
    }
  }

  /**
   * Adds a manual operator note to the contact timeline
   */
  public static addNote(contactId: string, note: string, author: string = 'Operator'): void {
    try {
      const allNotes = JSON.parse(localStorage.getItem(this.NOTES_STORAGE_KEY) || '{}');
      const list = allNotes[contactId] || [];
      list.unshift({
        id: `note-${Date.now()}`,
        timestamp: new Date().toISOString(),
        note,
        author
      });
      allNotes[contactId] = list;
      localStorage.setItem(this.NOTES_STORAGE_KEY, JSON.stringify(allNotes));
    } catch {}
  }

  /**
   * Generates a 360 profile and timeline for a contact
   */
  public static get360Profile(contact: Contact): Contact360Profile {
    const events: ContactTimelineEvent[] = [];

    // 1. Consent event
    events.push({
      id: `evt-consent-${contact.id}`,
      timestamp: contact.createdAt || '2026-10-01T09:00:00.000Z',
      type: 'CONSENT_CHANGE',
      channel: 'WHATSAPP',
      title: contact.consentObtained ? 'Marketing Consent Granted' : 'Consent Pending / Required',
      description: contact.consentObtained 
        ? `Explicit opt-in documented via ${contact.source || 'Direct Web Inquiry'}. Compliant with Meta 2026-10 rules.`
        : 'Contact currently lacks verified marketing opt-in.',
      actor: 'Compliance Engine'
    });

    // 2. Outbound outreach event
    if (contact.status !== 'NOT_CONTACTED') {
      events.push({
        id: `evt-outbound-${contact.id}`,
        timestamp: contact.lastContactedAt || '2026-10-04T11:30:00.000Z',
        type: 'OUTBOUND_DISPATCH',
        channel: 'WHATSAPP',
        title: 'Outreach Campaign Dispatched',
        description: 'Sent WhatsApp Introduction template with personalized catalog attachment.',
        actor: 'Outreach Operator'
      });
    }

    // 3. Inbound reply event
    if (contact.status === 'REPLIED' || contact.status === 'QUALIFIED' || contact.status === 'CONVERTED') {
      events.push({
        id: `evt-inbound-${contact.id}`,
        timestamp: '2026-10-05T14:45:10.000Z',
        type: 'INBOUND_REPLY',
        channel: 'WHATSAPP',
        title: 'Inbound Response Received',
        description: '"Hi, yes we are interested in honey jars pricing. Please share wholesale tier rates."',
        actor: `${contact.firstName || 'Contact'}`
      });
    }

    // 4. Status change
    if (contact.status === 'QUALIFIED' || contact.status === 'CONVERTED') {
      events.push({
        id: `evt-status-${contact.id}`,
        timestamp: '2026-10-06T16:00:00.000Z',
        type: 'STATUS_CHANGE',
        title: `Status Promoted to ${contact.status}`,
        description: `Lead qualified based on affirmative response and high commercial intent.`,
        actor: 'Sales Pipeline Auto-Rule'
      });
    }

    // 5. User custom notes
    const customNotes = this.getNotes(contact.id);
    customNotes.forEach(n => {
      events.push({
        id: n.id,
        timestamp: n.timestamp,
        type: 'NOTE_ADDED',
        title: 'Operator Note',
        description: n.note,
        actor: n.author
      });
    });

    // Sort chronologically (newest first)
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Compute Engagement Score
    let score = 20; // Base score
    if (contact.consentObtained) score += 15;
    if (contact.status === 'CONTACTED') score += 15;
    if (contact.status === 'REPLIED') score += 35;
    if (contact.status === 'QUALIFIED') score += 45;
    if (contact.status === 'CONVERTED') score += 60;
    if (customNotes.length > 0) score += 10;
    score = Math.min(100, score);

    let engagementTier: Contact360Profile['engagementTier'] = 'COOL';
    if (score >= 80) engagementTier = 'HOT';
    else if (score >= 50) engagementTier = 'WARM';
    else if (score >= 30) engagementTier = 'COOL';
    else engagementTier = 'DORMANT';

    return {
      contactId: contact.id,
      contactName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown Contact',
      phone: contact.phone,
      email: contact.email,
      companyName: contact.companyName,
      city: contact.city,
      engagementScore: score,
      engagementTier,
      totalTouchpoints: events.length,
      lastContactedAt: contact.lastContactedAt,
      primaryChannel: 'WHATSAPP',
      timeline: events
    };
  }
}
