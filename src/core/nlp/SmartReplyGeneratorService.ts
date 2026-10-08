/**
 * ReachOutOS AI Multi-Option Smart Reply Generator & Objection Buster
 * Generates 3 contextual, high-converting B2B reply options per inbound message.
 */

import { LeadIntent, LeadSentiment } from './IntentClassifierService';

export interface SmartReplyDraft {
  id: string;
  type: 'PRICING_QUOTE' | 'SAMPLE_OFFER' | 'MEETING_BOOKING' | 'POLITE_FOLLOWUP' | 'OBJECTION_BUSTER' | 'OPTOUT_ACK';
  title: string;
  description: string;
  body: string;
  tone: 'CONCISE' | 'PERSUASIVE' | 'FORMAL' | 'COMPLIANT';
}

export class SmartReplyGeneratorService {
  /**
   * Generates 3 contextual reply drafts based on contact context and detected intent
   */
  public static generateDrafts(
    contactName: string,
    companyName: string,
    inboundText: string,
    intent: LeadIntent,
    sentiment: LeadSentiment
  ): SmartReplyDraft[] {
    const firstName = contactName ? contactName.split(' ')[0] : 'there';
    const company = companyName ? ` for ${companyName}` : '';

    if (intent === 'OPTOUT_REQUEST') {
      return [
        {
          id: 'draft-optout-1',
          type: 'OPTOUT_ACK',
          title: 'Immediate Opt-Out Confirmation',
          description: 'Compliant acknowledgment confirming removal from future broadcasts.',
          body: `Hello ${firstName}, we have immediately unsubscribed you and removed your number from our outreach list. You will not receive any further messages from us. Thank you.`,
          tone: 'COMPLIANT'
        },
        {
          id: 'draft-optout-2',
          type: 'OPTOUT_ACK',
          title: 'Polite Formal Unsubscribe',
          description: 'Formal confirmation with reference ticket ID.',
          body: `Dear ${firstName}, your opt-out request has been processed. Your contact information is now suppressed across all our communication channels. Have a great day.`,
          tone: 'FORMAL'
        }
      ];
    }

    if (intent === 'OBJECTION_PRICING') {
      return [
        {
          id: 'draft-pricing-1',
          type: 'OBJECTION_BUSTER',
          title: 'Volume Slabs & Tier Discounts',
          description: 'Address price pushback with bulk tiered discounts and higher dealer margins.',
          body: `Hi ${firstName}, completely understand your budget considerations! For retail partners${company}, we offer tiered wholesale slabs: orders above 50 units get 15% discount + free shipping, yielding a 32% margin for your counter. Would you like me to share our exact tier price sheet?`,
          tone: 'PERSUASIVE'
        },
        {
          id: 'draft-pricing-2',
          type: 'SAMPLE_OFFER',
          title: 'Complimentary Sample Test Pack',
          description: 'De-risk the purchase by offering test inventory before full commitment.',
          body: `Hello ${firstName}, we can ship a complimentary sample tasting kit to ${companyName || 'your store'} so you can test customer reception before committing to a wholesale order. What address should we ship to?`,
          tone: 'CONCISE'
        },
        {
          id: 'draft-pricing-3',
          type: 'MEETING_BOOKING',
          title: 'Custom Terms 5-Min Phone Call',
          description: 'Offer a quick direct discussion to customize payment & credit terms.',
          body: `Hi ${firstName}, we can structure flexible payment terms (15-day credit) for repeat orders. Can we do a quick 5-minute call today at 3:30 PM to discuss a custom arrangement?`,
          tone: 'FORMAL'
        }
      ];
    }

    if (intent === 'NOT_NOW') {
      return [
        {
          id: 'draft-notnow-1',
          type: 'POLITE_FOLLOWUP',
          title: 'Gentle Calendar Postpone',
          description: 'Respect their timing while keeping the door open.',
          body: `Thanks for letting me know, ${firstName}! I will set a reminder to check back with you next month. In the meantime, feel free to review our catalog at reachoutos.com/catalog.pdf whenever convenient.`,
          tone: 'FORMAL'
        },
        {
          id: 'draft-notnow-2',
          type: 'SAMPLE_OFFER',
          title: 'Pre-Ship Sample for Review Later',
          description: 'Send passive materials they can inspect at their leisure.',
          body: `Understood, ${firstName}! Would it be helpful if I dispatch a physical sample kit to ${companyName || 'your office'} now so you have it ready on your desk when you revisit this next month?`,
          tone: 'PERSUASIVE'
        }
      ];
    }

    // Default: High Intent / Inquiry
    return [
      {
        id: 'draft-interested-1',
        type: 'PRICING_QUOTE',
        title: 'Direct Wholesale Pricing & MOQ',
        description: 'Shares direct pricing breakdown, minimum order quantities, and dealer margins.',
        body: `Hi ${firstName}, thank you for your interest! Our direct wholesale rate for 500g pure honey jars is ₹185/unit (MRP ₹280, giving you 34% counter margin). Minimum order is just 24 units. Would you like me to share the complete rate list?`,
        tone: 'PERSUASIVE'
      },
      {
        id: 'draft-interested-2',
        type: 'SAMPLE_OFFER',
        title: 'Free Sample Kit Dispatch',
        description: 'Offers free product testing pack with expedited courier delivery.',
        body: `Hello ${firstName}, we would love to send a complimentary sample box directly to ${companyName || 'your store'} this week. Could you confirm your full delivery address and pincode?`,
        tone: 'CONCISE'
      },
      {
        id: 'draft-interested-3',
        type: 'MEETING_BOOKING',
        title: 'Wholesale Onboarding Call',
        description: 'Invite to brief onboarding discussion with regional sales manager.',
        body: `Hi ${firstName}, are you available for a brief 5-minute call today or tomorrow morning? We can walk you through our distributor onboarding discounts and delivery timeline.`,
        tone: 'FORMAL'
      }
    ];
  }
}
