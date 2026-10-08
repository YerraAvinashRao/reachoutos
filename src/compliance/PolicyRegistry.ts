/**
 * ReachOut OS - Policy Registry
 * In-memory versioned policy registry for Meta WhatsApp compliance rules
 */

import { ACTIVE_META_POLICY_VERSION, PolicyMetadata } from './PolicyVersion';
import policyMetadataJson from '../../database/policies/whatsapp/whatsapp-policy.json';
import rulesJson from '../../database/policies/whatsapp/whatsapp-rules.json';
import prohibitedJson from '../../database/policies/whatsapp/whatsapp-prohibited.json';
import consentJson from '../../database/policies/whatsapp/whatsapp-consent.json';
import templatesJson from '../../database/policies/whatsapp/whatsapp-templates.json';
import commerceJson from '../../database/policies/whatsapp/whatsapp-commerce.json';
import dataProtectionJson from '../../database/policies/whatsapp/whatsapp-data-protection.json';
import enforcementJson from '../../database/policies/whatsapp/whatsapp-enforcement.json';

export interface PolicyRuleDefinition {
  id: string;
  category: string;
  name: string;
  severity: 'BLOCKING' | 'REVIEW' | 'WARNING';
  applies_to: string[];
  rule: {
    condition: string;
    evaluation_type: string;
  };
  failure_action: string;
  explanation: string;
  source: {
    authority: string;
    document: string;
    section?: string;
    url: string;
  };
  effective_from: string;
  review_required: boolean;
}

export class PolicyRegistry {
  private static metadata: PolicyMetadata = (policyMetadataJson as any) || ACTIVE_META_POLICY_VERSION;
  private static rules: PolicyRuleDefinition[] = (rulesJson as any) || [];
  private static prohibited = prohibitedJson;
  private static consent = consentJson;
  private static templates = templatesJson;
  private static commerce = commerceJson;
  private static dataProtection = dataProtectionJson;
  private static enforcement = enforcementJson;

  public static getMetadata(): PolicyMetadata {
    return this.metadata;
  }

  public static getAllRules(): PolicyRuleDefinition[] {
    return this.rules;
  }

  public static getRuleById(id: string): PolicyRuleDefinition | undefined {
    return this.rules.find(r => r.id === id);
  }

  public static getRulesByCategory(category: string): PolicyRuleDefinition[] {
    return this.rules.filter(r => r.category === category);
  }

  public static getProhibitedCategories() {
    return this.prohibited.prohibited_product_categories;
  }

  public static getConsentRules() {
    return this.consent.consent_requirements;
  }

  public static getTemplateSpecs() {
    return this.templates.template_specifications;
  }

  public static getCommerceRules() {
    return this.commerce.commerce_rules;
  }

  public static getDataProtectionRules() {
    return this.dataProtection.data_protection_rules;
  }

  public static getEnforcementTiers() {
    return this.enforcement.decision_tiers;
  }
}
