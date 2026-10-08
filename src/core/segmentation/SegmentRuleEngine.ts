import { Contact } from '../../types';

export type RuleField = 
  | 'leadStatus'
  | 'state'
  | 'city'
  | 'companyName'
  | 'tags'
  | 'isGloballyBlocked'
  | 'lastInteractionDaysAgo'
  | 'createdDaysAgo'
  | 'whatsappMarketingAllowed'
  | 'emailMarketingAllowed';

export type RuleOperator = 
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'in_list'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty';

export interface SegmentRule {
  id: string;
  field: RuleField;
  operator: RuleOperator;
  value: string | string[] | number | boolean;
}

export interface SegmentRuleGroup {
  combinator: 'AND' | 'OR';
  rules: SegmentRule[];
}

export class SegmentRuleEngine {
  /**
   * Evaluates whether a single contact matches a specific rule.
   */
  public static evaluateRule(contact: Contact, rule: SegmentRule): boolean {
    const { field, operator, value } = rule;

    switch (field) {
      case 'leadStatus': {
        const contactVal = (contact.leadStatus || 'LEAD').toUpperCase();
        const targetVal = String(value).toUpperCase();
        if (operator === 'equals') return contactVal === targetVal;
        if (operator === 'not_equals') return contactVal !== targetVal;
        return true;
      }

      case 'state': {
        const contactVal = (contact.state || '').trim().toLowerCase();
        const targetVal = String(value).trim().toLowerCase();
        if (operator === 'equals') return contactVal === targetVal;
        if (operator === 'not_equals') return contactVal !== targetVal;
        if (operator === 'contains') return contactVal.includes(targetVal);
        return true;
      }

      case 'city': {
        const contactVal = (contact.city || '').trim().toLowerCase();
        const targetVal = String(value).trim().toLowerCase();
        if (operator === 'equals') return contactVal === targetVal;
        if (operator === 'not_equals') return contactVal !== targetVal;
        if (operator === 'contains') return contactVal.includes(targetVal);
        return true;
      }

      case 'companyName': {
        const contactVal = (contact.companyName || '').trim().toLowerCase();
        const targetVal = String(value).trim().toLowerCase();
        if (operator === 'equals') return contactVal === targetVal;
        if (operator === 'not_equals') return contactVal !== targetVal;
        if (operator === 'contains') return contactVal.includes(targetVal);
        if (operator === 'is_empty') return !contactVal;
        if (operator === 'is_not_empty') return Boolean(contactVal);
        return true;
      }

      case 'tags': {
        const contactTags = (contact.tags || []).map(t => t.trim().toLowerCase());
        const targetTag = String(value).trim().toLowerCase();
        if (operator === 'contains') return contactTags.includes(targetTag);
        if (operator === 'not_contains') return !contactTags.includes(targetTag);
        if (operator === 'is_empty') return contactTags.length === 0;
        if (operator === 'is_not_empty') return contactTags.length > 0;
        return true;
      }

      case 'isGloballyBlocked': {
        const isBlocked = Boolean(contact.isGloballyBlocked);
        const targetBlocked = Boolean(value);
        if (operator === 'equals') return isBlocked === targetBlocked;
        return true;
      }

      case 'lastInteractionDaysAgo': {
        if (!contact.lastInteractionAt) {
          if (operator === 'is_empty') return true;
          if (operator === 'greater_than') return true; // Never contacted = infinite days ago
          return false;
        }
        const diffDays = Math.floor((Date.now() - new Date(contact.lastInteractionAt).getTime()) / (1000 * 60 * 60 * 24));
        const numVal = Number(value) || 0;
        if (operator === 'greater_than') return diffDays >= numVal;
        if (operator === 'less_than') return diffDays <= numVal;
        return true;
      }

      case 'createdDaysAgo': {
        const diffDays = Math.floor((Date.now() - new Date(contact.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        const numVal = Number(value) || 0;
        if (operator === 'greater_than') return diffDays >= numVal;
        if (operator === 'less_than') return diffDays <= numVal;
        return true;
      }

      case 'whatsappMarketingAllowed': {
        const allowed = Boolean(contact.preferences?.WHATSAPP?.marketingAllowed !== false);
        return allowed === Boolean(value);
      }

      case 'emailMarketingAllowed': {
        const allowed = Boolean(contact.preferences?.EMAIL?.marketingAllowed !== false);
        return allowed === Boolean(value);
      }

      default:
        return true;
    }
  }

  /**
   * Evaluates a full rule group against a single contact.
   */
  public static evaluateGroup(contact: Contact, group: SegmentRuleGroup): boolean {
    if (!group || !Array.isArray(group.rules) || group.rules.length === 0) {
      return true;
    }

    if (group.combinator === 'OR') {
      return group.rules.some(rule => this.evaluateRule(contact, rule));
    }

    // Default: 'AND'
    return group.rules.every(rule => this.evaluateRule(contact, rule));
  }

  /**
   * Filters an entire contact list against a rule group.
   */
  public static filterContacts(contacts: Contact[], group: SegmentRuleGroup): Contact[] {
    return contacts.filter(c => this.evaluateGroup(c, group));
  }
}
