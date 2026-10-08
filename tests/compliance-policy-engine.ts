/**
 * ReachOut OS - Compliance Policy Engine Verification Test Suite
 * Tests authoritative Meta WhatsApp Business Policies against all rule domains.
 */

import { PolicyEngine } from '../src/compliance/PolicyEngine';
import { ComplianceDecision } from '../src/compliance/ComplianceDecision';

function assert(condition: boolean, testName: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${testName}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${testName}`);
  }
}

async function runComplianceTests() {
  console.log('=====================================================');
  console.log('🧪 META WHATSAPP BUSINESS POLICY ENGINE TEST SUITE');
  console.log('=====================================================\n');

  // Test 1: Active Policy Metadata Resolution
  const meta = PolicyEngine.getActivePolicyMetadata();
  assert(meta.version === '2026-10', 'Metadata version matches 2026-10');
  assert(meta.authority === 'Meta Platforms, Inc.', 'Authority is Meta Platforms, Inc.');
  assert(meta.official_sources.length >= 3, 'Includes official Meta policy URLs');

  // Test 2: Clean Compliant Message (🟢 ALLOW)
  const cleanDecision = PolicyEngine.evaluate({
    tenantId: 'tenant-test-1',
    contactPhone: '+919876543210',
    contactName: 'Rohan Sharma',
    channel: 'WHATSAPP',
    isMarketing: true,
    messageBody: 'Hello Rohan, thank you for connecting with us regarding ReachOut OS. We would be delighted to share our catalog.',
    templateId: 'tpl-1',
    templateName: 'Catalog Introduction',
    templateCategory: 'MARKETING',
    templateStatus: 'APPROVED',
    consentStatus: 'GRANTED',
    consentCategory: 'marketing'
  });

  assert(cleanDecision.decision === 'ALLOW', 'Clean compliant message evaluates to ALLOW');
  assert(cleanDecision.riskLevel === 'LOW', 'Clean compliant message has LOW risk level');
  assert(cleanDecision.violations.length === 0, 'Clean compliant message has 0 violations');

  // Test 3: Missing Consent / Opt-in Violation (🔴 BLOCK on WA-CONSENT-001)
  const noConsentDecision = PolicyEngine.evaluate({
    tenantId: 'tenant-test-1',
    contactPhone: '+919876543210',
    channel: 'WHATSAPP',
    isMarketing: true,
    messageBody: 'Hey check out this new deal!',
    templateId: 'tpl-1',
    templateStatus: 'APPROVED',
    consentStatus: 'UNKNOWN' // No recorded opt-in
  });

  assert(noConsentDecision.decision === 'BLOCK', 'Missing opt-in results in BLOCK decision');
  assert(noConsentDecision.violations.some(v => v.ruleId === 'WA-CONSENT-001'), 'Violates rule WA-CONSENT-001');
  assert(!noConsentDecision.canHumanOverride, 'Blocking violation cannot be overridden');

  // Test 4: Hard Opt-Out & Global Suppression (🔴 BLOCK on WA-OPTOUT-001)
  const optOutDecision = PolicyEngine.evaluate({
    tenantId: 'tenant-test-1',
    contactPhone: '+919876543210',
    channel: 'WHATSAPP',
    isMarketing: true,
    messageBody: 'Special VIP offer for you!',
    templateId: 'tpl-1',
    templateStatus: 'APPROVED',
    consentStatus: 'REVOKED', // Contact opted out
    isGloballyBlocked: true
  });

  assert(optOutDecision.decision === 'BLOCK', 'Opted-out contact results in immediate BLOCK');
  assert(optOutDecision.violations.some(v => v.ruleId === 'WA-OPTOUT-001'), 'Violates rule WA-OPTOUT-001');

  // Test 5: 24-Hour Customer Service Window (🔴 BLOCK on WA-WINDOW-001 outside window without template)
  const outsideWindowDecision = PolicyEngine.evaluate({
    tenantId: 'tenant-test-1',
    contactPhone: '+919876543210',
    channel: 'WHATSAPP',
    isMarketing: false,
    messageBody: 'Here is your account statement.',
    // Outside 24h: last inbound was 3 days ago, and NO approved template is designated
    lastInboundMessageAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
    consentStatus: 'GRANTED'
  });

  assert(outsideWindowDecision.decision === 'BLOCK', 'Outside 24h window without approved template results in BLOCK');
  assert(outsideWindowDecision.violations.some(v => v.ruleId === 'WA-WINDOW-001'), 'Violates rule WA-WINDOW-001');

  // Test 6: 24-Hour Customer Service Window (🟢 ALLOW inside window for freeform support reply)
  const insideWindowDecision = PolicyEngine.evaluate({
    tenantId: 'tenant-test-1',
    contactPhone: '+919876543210',
    channel: 'WHATSAPP',
    isMarketing: false,
    messageBody: 'Sure! I would be glad to help resolve your billing question.',
    // Inside 24h: last inbound was 1 hour ago
    lastInboundMessageAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    consentStatus: 'GRANTED'
  });

  assert(insideWindowDecision.decision === 'ALLOW', 'Inside 24h window free-form service reply evaluates to ALLOW');

  // Test 7: Template Purpose Mismatch (🔴 BLOCK on WA-TEMPLATE-002)
  const templateMismatchDecision = PolicyEngine.evaluate({
    tenantId: 'tenant-test-1',
    contactPhone: '+919876543210',
    channel: 'WHATSAPP',
    isMarketing: true,
    messageBody: 'Your order is ready. Use promo code FLASH50 for 50% discount sale today!',
    templateId: 'tpl-utility-1',
    templateCategory: 'UTILITY', // Claimed as UTILITY
    templateStatus: 'APPROVED',
    consentStatus: 'GRANTED'
  });

  assert(templateMismatchDecision.decision === 'BLOCK', 'Promotional offer inside UTILITY template results in BLOCK');
  assert(templateMismatchDecision.violations.some(v => v.ruleId === 'WA-TEMPLATE-002'), 'Violates rule WA-TEMPLATE-002');

  // Test 8: Prohibited Goods (🔴 BLOCK on WA-PROHIBITED-001)
  const prohibitedGoodsDecision = PolicyEngine.evaluate({
    tenantId: 'tenant-test-1',
    contactPhone: '+919876543210',
    channel: 'WHATSAPP',
    isMarketing: true,
    messageBody: 'Best prices on premium tobacco cigarettes and cigars delivered to your doorstep.',
    templateId: 'tpl-1',
    templateCategory: 'MARKETING',
    templateStatus: 'APPROVED',
    consentStatus: 'GRANTED'
  });

  assert(prohibitedGoodsDecision.decision === 'BLOCK', 'Tobacco promotion results in BLOCK');
  assert(prohibitedGoodsDecision.violations.some(v => v.ruleId === 'WA-PROHIBITED-001'), 'Violates rule WA-PROHIBITED-001');

  // Test 9: Sensitive Payment Card Protection (🔴 BLOCK on WA-DATA-001)
  const cardDataDecision = PolicyEngine.evaluate({
    tenantId: 'tenant-test-1',
    contactPhone: '+919876543210',
    channel: 'WHATSAPP',
    isMarketing: true,
    // Contains test Visa PAN and CVV
    messageBody: 'Please confirm your payment with card 4532 0150 0000 0004 and cvv: 928.',
    templateId: 'tpl-1',
    templateCategory: 'MARKETING',
    templateStatus: 'APPROVED',
    consentStatus: 'GRANTED'
  });

  assert(cardDataDecision.decision === 'BLOCK', 'Card number and CVV in message results in BLOCK');
  assert(cardDataDecision.violations.some(v => v.ruleId === 'WA-DATA-001'), 'Violates rule WA-DATA-001');

  // Test 10: Unsubstantiated Health Claim (🟡 HUMAN_REVIEW on WA-CONTENT-002)
  const healthClaimDecision = PolicyEngine.evaluate({
    tenantId: 'tenant-test-1',
    contactPhone: '+919876543210',
    channel: 'WHATSAPP',
    isMarketing: true,
    messageBody: 'Discover our dietary supplement therapy and wellness program for daily vitality.',
    templateId: 'tpl-1',
    templateCategory: 'MARKETING',
    templateStatus: 'APPROVED',
    consentStatus: 'GRANTED'
  });

  assert(healthClaimDecision.decision === 'HUMAN_REVIEW', 'Regulated health claim results in HUMAN_REVIEW');
  assert(healthClaimDecision.riskLevel === 'MEDIUM', 'Regulated claim has MEDIUM risk level');
  assert(healthClaimDecision.violations.some(v => v.ruleId === 'WA-CONTENT-002'), 'Flags rule WA-CONTENT-002');
  assert(healthClaimDecision.canHumanOverride === true, 'Review item can be inspected by compliance operator');

  console.log('\n=====================================================');
  console.log('🎉 ALL 10 META WHATSAPP POLICY SUITE TESTS PASSED 100%');
  console.log('=====================================================');
}

runComplianceTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
