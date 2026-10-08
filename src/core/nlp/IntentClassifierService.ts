/**
 * ReachOutOS AI Lead Intent & Sentiment Classifier
 * Zero-shot NLP rules & heuristic classification for inbound B2B outreach messages.
 */

export type LeadIntent = 
  | 'INTERESTED'
  | 'OBJECTION_PRICING'
  | 'NOT_NOW'
  | 'WRONG_PERSON'
  | 'OPTOUT_REQUEST'
  | 'GENERAL_QUERY';

export type LeadSentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

export interface IntentAnalysisResult {
  intent: LeadIntent;
  intentConfidence: number; // 0.0 to 1.0
  sentiment: LeadSentiment;
  sentimentScore: number; // -1.0 to 1.0
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendedAction: string;
  suggestedTags: string[];
  leadScoreAdjustment: number; // e.g. +30 for interested, -50 for opt-out
  suggestedCannedReplyId?: string;
  matchedKeywords: string[];
}

export class IntentClassifierService {
  private static OPT_OUT_PATTERNS = [
    /\b(stop|unsubscribe|remove\s+me|don't\s+message|opt\s*out|leave\s+me\s+alone|block)\b/i,
    /\b(band\s+karo|message\s+mat\s+karo|hatao)\b/i
  ];

  private static INTERESTED_PATTERNS = [
    /\b(interested|quote|price|pricing|catalog|brochure|sample|call\s+me|send\s+details|demo|meeting|let's\s+talk|rate\s+list|cost)\b/i,
    /\b(bhejo|baat\s+karein|sample\s+bhejiye|rate\s+kya\s+hai)\b/i
  ];

  private static OBJECTION_PRICING_PATTERNS = [
    /\b(too\s+expensive|high\s+price|costly|cheaper|discount|negotiate|budget|lower\s+price|margin)\b/i,
    /\b(bohot\s+mehenga|kam\s+karo|discount\s+milega)\b/i
  ];

  private static NOT_NOW_PATTERNS = [
    /\b(not\s+now|next\s+month|later|busy|next\s+week|after\s+diwali|after\s+holidays|revisit|contact\s+later)\b/i,
    /\b(baad\s+mein|abhi\s+nahi|agle\s+mahine)\b/i
  ];

  private static WRONG_PERSON_PATTERNS = [
    /\b(wrong\s+number|wrong\s+person|left\s+company|not\s+working\s+here|speak\s+to|reach\s+out\s+to|no\s+longer)\b/i,
    /\b(galat\s+number|yeh\s+mera\s+nahi)\b/i
  ];

  /**
   * Classifies inbound message text and extracts actionable intent and tags
   */
  public static classifyMessage(text: string): IntentAnalysisResult {
    const cleanText = (text || '').trim();
    if (!cleanText) {
      return {
        intent: 'GENERAL_QUERY',
        intentConfidence: 0.5,
        sentiment: 'NEUTRAL',
        sentimentScore: 0,
        urgency: 'LOW',
        recommendedAction: 'Send general polite follow-up',
        suggestedTags: ['unclassified'],
        leadScoreAdjustment: 0,
        matchedKeywords: []
      };
    }

    // 1. Opt-out check (Highest Priority)
    for (const pattern of this.OPT_OUT_PATTERNS) {
      const match = cleanText.match(pattern);
      if (match) {
        return {
          intent: 'OPTOUT_REQUEST',
          intentConfidence: 0.98,
          sentiment: 'NEGATIVE',
          sentimentScore: -0.9,
          urgency: 'HIGH',
          recommendedAction: 'Trigger immediate opt-out & cease marketing broadcasts',
          suggestedTags: ['opt-out-requested', 'do-not-contact'],
          leadScoreAdjustment: -100,
          matchedKeywords: [match[0]]
        };
      }
    }

    // 2. High Intent / Ready to Buy
    for (const pattern of this.INTERESTED_PATTERNS) {
      const match = cleanText.match(pattern);
      if (match) {
        const keywords = cleanText.match(new RegExp(pattern, 'gi')) || [match[0]];
        return {
          intent: 'INTERESTED',
          intentConfidence: 0.92,
          sentiment: 'POSITIVE',
          sentimentScore: 0.8,
          urgency: 'HIGH',
          recommendedAction: 'Assign to sales representative and send sample/pricing catalog immediately',
          suggestedTags: ['hot-lead', 'sample-requested', 'high-intent'],
          leadScoreAdjustment: 35,
          suggestedCannedReplyId: 'cr-catalog',
          matchedKeywords: keywords
        };
      }
    }

    // 3. Pricing Objection
    for (const pattern of this.OBJECTION_PRICING_PATTERNS) {
      const match = cleanText.match(pattern);
      if (match) {
        return {
          intent: 'OBJECTION_PRICING',
          intentConfidence: 0.88,
          sentiment: 'NEUTRAL',
          sentimentScore: -0.2,
          urgency: 'MEDIUM',
          recommendedAction: 'Share bulk volume tier discount matrix & margin calculator',
          suggestedTags: ['pricing-objection', 'tier-discount-eligible'],
          leadScoreAdjustment: 10,
          suggestedCannedReplyId: 'cr-pricing',
          matchedKeywords: [match[0]]
        };
      }
    }

    // 4. Not Now / Postponed
    for (const pattern of this.NOT_NOW_PATTERNS) {
      const match = cleanText.match(pattern);
      if (match) {
        return {
          intent: 'NOT_NOW',
          intentConfidence: 0.85,
          sentiment: 'NEUTRAL',
          sentimentScore: 0.0,
          urgency: 'LOW',
          recommendedAction: 'Schedule automated 30-day gentle check-in cadence',
          suggestedTags: ['follow-up-later', 'nurture'],
          leadScoreAdjustment: 5,
          matchedKeywords: [match[0]]
        };
      }
    }

    // 5. Wrong Person / Referral
    for (const pattern of this.WRONG_PERSON_PATTERNS) {
      const match = cleanText.match(pattern);
      if (match) {
        return {
          intent: 'WRONG_PERSON',
          intentConfidence: 0.87,
          sentiment: 'NEUTRAL',
          sentimentScore: -0.1,
          urgency: 'MEDIUM',
          recommendedAction: 'Ask for procurement or category manager referral contact',
          suggestedTags: ['wrong-contact', 'referral-needed'],
          leadScoreAdjustment: -10,
          matchedKeywords: [match[0]]
        };
      }
    }

    // 6. Default General Query
    return {
      intent: 'GENERAL_QUERY',
      intentConfidence: 0.70,
      sentiment: 'NEUTRAL',
      sentimentScore: 0.1,
      urgency: 'LOW',
      recommendedAction: 'Send friendly inquiry acknowledgment',
      suggestedTags: ['inquiry'],
      leadScoreAdjustment: 5,
      suggestedCannedReplyId: 'cr-catalog',
      matchedKeywords: []
    };
  }

  /**
   * Generates badge styling config for the UI
   */
  public static getIntentBadge(intent: LeadIntent): { label: string; bg: string; text: string; border: string } {
    switch (intent) {
      case 'INTERESTED':
        return { label: '🔥 HOT LEAD (INTERESTED)', bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-300 dark:border-emerald-700' };
      case 'OBJECTION_PRICING':
        return { label: '💰 PRICING OBJECTION', bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-700' };
      case 'NOT_NOW':
        return { label: '⏳ FOLLOW UP LATER', bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-700' };
      case 'WRONG_PERSON':
        return { label: '🔄 REFERRAL NEEDED', bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-700' };
      case 'OPTOUT_REQUEST':
        return { label: '⛔ OPTOUT REQUEST', bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-300 dark:border-rose-700' };
      case 'GENERAL_QUERY':
      default:
        return { label: '💬 GENERAL QUERY', bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-700 dark:text-neutral-300', border: 'border-neutral-300 dark:border-neutral-600' };
    }
  }
}
