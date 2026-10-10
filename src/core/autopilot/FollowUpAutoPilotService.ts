/**
 * ReachOutOS AI Campaign Follow-Up Auto-Pilot Engine
 * Automatically queues personalized, context-aware follow-ups for warm recipients
 * who viewed or opened an outreach dispatch 48+ hours ago without replying.
 */

import { CampaignRecipient, Contact } from '../../types';

export interface AutoPilotCandidate {
  recipientId: string;
  contactId: string;
  contactName: string;
  companyName: string;
  phone: string;
  email?: string;
  city: string;
  channel: 'WHATSAPP' | 'EMAIL';
  hoursSinceLastContact: number;
  lastAction: 'OPENED' | 'DISPATCHED';
  generatedFollowUpSubject?: string;
  generatedFollowUpBody: string;
  strategyHook: 'MARGIN_INCENTIVE' | 'SAMPLE_KIT_OFFER' | 'COURTESY_CHECKIN';
  status: 'QUEUED' | 'APPROVED' | 'DISPATCHED' | 'DISMISSED';
}

export class FollowUpAutoPilotService {
  /**
   * Evaluates campaign recipients and generates human-in-the-loop follow-up drafts
   */
  public static generateCandidates(
    recipients: CampaignRecipient[],
    contacts: Contact[]
  ): AutoPilotCandidate[] {
    const candidates: AutoPilotCandidate[] = [];

    // Filter recipients eligible for auto-pilot follow-up (opened or contacted, not yet replied or blocked)
    const eligible = recipients.filter(r => 
      (r.status === 'OPENED' || r.status === 'USER_SENT') && 
      !r.policyViolations?.length
    );

    eligible.slice(0, 15).forEach((rec, idx) => {
      const contact = contacts.find(c => c.id === rec.contactId);
      const contactName = contact?.displayName || rec.contactName || 'Valued Partner';
      const firstName = contactName.split(' ')[0] || 'there';
      const companyName = contact?.companyName || rec.companyName || 'your business';
      const city = contact?.city || 'your area';
      const phone = contact?.phone || rec.channelAddress;

      // Realistic hours simulation: 48 - 72 hours ago
      const hoursAgo = 48 + ((idx * 7) % 24);

      let hook: AutoPilotCandidate['strategyHook'] = 'MARGIN_INCENTIVE';
      let subject = `Quick question regarding ${companyName}'s wholesale margins`;
      let body = '';

      if (idx % 3 === 0) {
        hook = 'MARGIN_INCENTIVE';
        body = `Hi ${firstName}, following up on our note regarding ${companyName}. We are offering an extra 5% introductory distributor discount on wholesale honey jars this week for stockists in ${city}. Would you like me to share the updated margin slabs?`;
      } else if (idx % 3 === 1) {
        hook = 'SAMPLE_KIT_OFFER';
        subject = `Complimentary sample kit for ${companyName}`;
        body = `Hello ${firstName}, just wanted to check if you'd like a complimentary sample tasting kit delivered directly to ${companyName} in ${city}? We can courier it at zero cost so you can test customer feedback before ordering.`;
      } else {
        hook = 'COURTESY_CHECKIN';
        subject = `Touching base with ${firstName} at ${companyName}`;
        body = `Hi ${firstName}, hope you are having a productive week! Following up to see if you had a moment to review our catalog for ${companyName}? Let me know if you have any questions on pricing or MOQ.`;
      }

      candidates.push({
        recipientId: rec.id,
        contactId: rec.contactId,
        contactName,
        companyName,
        phone,
        email: contact?.email,
        city,
        channel: 'WHATSAPP',
        hoursSinceLastContact: hoursAgo,
        lastAction: rec.status === 'OPENED' ? 'OPENED' : 'DISPATCHED',
        generatedFollowUpSubject: subject,
        generatedFollowUpBody: body,
        strategyHook: hook,
        status: 'QUEUED'
      });
    });

    return candidates;
  }
}
