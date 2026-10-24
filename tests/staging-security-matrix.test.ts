import crypto from 'crypto';

interface MockTenant {
  id: string;
  slug: string;
  status: 'ACTIVE' | 'SUSPENDED';
  is_kill_switch_active: boolean;
}

interface MockSession {
  token_hash: string;
  user_id: string;
  tenant_id: string;
  expires_at: number;
  revoked: boolean;
}

interface MockSsoCode {
  code_hash: string;
  user_id: string;
  tenant_id: string;
  expires_at: number;
  redeemed: boolean;
}

// In-memory isolated staging mock engine for security invariant verification
class StagingSecuritySimulator {
  public tenants: Map<string, MockTenant> = new Map();
  public memberships: Map<string, Set<string>> = new Map(); // tenant_id -> Set<user_id>
  public sessions: Map<string, MockSession> = new Map();
  public ssoCodes: Map<string, MockSsoCode> = new Map();

  constructor() {
    // Setup test tenants
    this.tenants.set('tenant-yar', {
      id: 'tenant-yar',
      slug: 'yar',
      status: 'ACTIVE',
      is_kill_switch_active: false
    });
    this.tenants.set('tenant-acme', {
      id: 'tenant-acme',
      slug: 'acme',
      status: 'ACTIVE',
      is_kill_switch_active: false
    });
    this.tenants.set('tenant-suspended', {
      id: 'tenant-suspended',
      slug: 'suspended',
      status: 'SUSPENDED',
      is_kill_switch_active: false
    });
    this.tenants.set('tenant-killed', {
      id: 'tenant-killed',
      slug: 'killed',
      status: 'ACTIVE',
      is_kill_switch_active: true
    });

    // Setup memberships
    this.memberships.set('tenant-yar', new Set(['user-avinash']));
    this.memberships.set('tenant-acme', new Set(['user-acme-owner']));
  }

  public mintSsoCode(userId: string, tenantId: string, ttlSeconds = 60): string {
    const rawCode = `sso_${crypto.randomBytes(24).toString('hex')}`;
    const codeHash = crypto.createHash('sha256').update(rawCode).digest('hex');
    this.ssoCodes.set(codeHash, {
      code_hash: codeHash,
      user_id: userId,
      tenant_id: tenantId,
      expires_at: Date.now() + ttlSeconds * 1000,
      redeemed: false
    });
    return rawCode;
  }

  public redeemSsoCode(rawCode: string, requestedTenantId: string): { success: boolean; error?: string; sessionToken?: string } {
    const codeHash = crypto.createHash('sha256').update(rawCode).digest('hex');
    const record = this.ssoCodes.get(codeHash);

    if (!record) {
      return { success: false, error: 'INVALID_SSO_CODE' };
    }
    if (record.redeemed) {
      return { success: false, error: 'CODE_ALREADY_REDEEMED' };
    }
    if (Date.now() > record.expires_at) {
      return { success: false, error: 'CODE_EXPIRED' };
    }
    if (record.tenant_id !== requestedTenantId) {
      return { success: false, error: 'TENANT_MISMATCH' };
    }

    // Atomically consume code
    record.redeemed = true;

    // Issue session token
    const sessionToken = `sess_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
    this.sessions.set(tokenHash, {
      token_hash: tokenHash,
      user_id: record.user_id,
      tenant_id: requestedTenantId,
      expires_at: Date.now() + 86400 * 1000,
      revoked: false
    });

    return { success: true, sessionToken };
  }

  public revokeSession(sessionToken: string): boolean {
    const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
    const sess = this.sessions.get(tokenHash);
    if (sess) {
      sess.revoked = true;
      return true;
    }
    return false;
  }

  public authorizeTenantRequest(
    sessionToken: string,
    targetTenantSlug: string,
    method: string,
    originHeader?: string,
    csrfHeader?: string
  ): { status: number; error?: string } {
    // 1. CSRF Verification for state-changing methods
    const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase());
    if (isStateChanging) {
      if (!originHeader) {
        return { status: 403, error: 'CSRF_ORIGIN_MISSING' };
      }
      const expectedOrigin = `https://${targetTenantSlug}.reachoutos.com`;
      if (originHeader !== expectedOrigin) {
        return { status: 403, error: 'CSRF_ORIGIN_MISMATCH' };
      }
      if (!csrfHeader) {
        return { status: 403, error: 'CSRF_TOKEN_MISSING' };
      }
    }

    // 2. Session Validation
    const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
    const sess = this.sessions.get(tokenHash);
    if (!sess) {
      return { status: 401, error: 'SESSION_NOT_FOUND' };
    }
    if (sess.revoked) {
      return { status: 401, error: 'SESSION_REVOKED' };
    }
    if (Date.now() > sess.expires_at) {
      return { status: 401, error: 'SESSION_EXPIRED' };
    }

    // 3. Resolve Target Tenant
    let foundTenant: MockTenant | null = null;
    for (const t of this.tenants.values()) {
      if (t.slug === targetTenantSlug) {
        foundTenant = t;
        break;
      }
    }
    if (!foundTenant) {
      return { status: 404, error: 'TENANT_NOT_FOUND' };
    }

    // 4. Kill Switch Verification
    if (foundTenant.is_kill_switch_active) {
      return { status: 403, error: 'KILL_SWITCH_ACTIVE' };
    }

    // 5. Tenant Status Verification
    if (foundTenant.status !== 'ACTIVE') {
      return { status: 403, error: 'TENANT_SUSPENDED' };
    }

    // 6. Tenant Scope & Cross-Tenant Boundary
    if (sess.tenant_id !== foundTenant.id) {
      return { status: 403, error: 'CROSS_TENANT_ACCESS_DENIED' };
    }

    // 7. Membership Verification
    const members = this.memberships.get(foundTenant.id);
    if (!members || !members.has(sess.user_id)) {
      return { status: 403, error: 'MEMBERSHIP_REVOKED' };
    }

    return { status: 200 };
  }
}

function runSecurityTests() {
  console.log('================================================================');
  console.log('STAGING SECURITY SIMULATION & INVARIANT VERIFICATION TEST MATRIX');
  console.log('Node Runtime:', process.version);
  console.log('================================================================\n');

  const sim = new StagingSecuritySimulator();
  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, detail?: string) {
    if (condition) {
      passed++;
      console.log(`  PASS: ${name}`);
    } else {
      failed++;
      console.error(`  FAIL: ${name}${detail ? ' -> ' + detail : ''}`);
    }
  }

  // Test 1: SSO Minting & Valid Redemption
  const code1 = sim.mintSsoCode('user-avinash', 'tenant-yar');
  const redeem1 = sim.redeemSsoCode(code1, 'tenant-yar');
  assert('SSO Code successfully minted and redeemed for authorized tenant', redeem1.success && !!redeem1.sessionToken);

  // Test 2: SSO Single-Use Replay Attack
  const replayRedeem = sim.redeemSsoCode(code1, 'tenant-yar');
  assert('SSO Code Replay attack fails with CODE_ALREADY_REDEEMED', !replayRedeem.success && replayRedeem.error === 'CODE_ALREADY_REDEEMED');

  // Test 3: SSO Code Expiry
  const expiredCode = sim.mintSsoCode('user-avinash', 'tenant-yar', -10); // 10 seconds in the past
  const expiredRedeem = sim.redeemSsoCode(expiredCode, 'tenant-yar');
  assert('Expired SSO Code fails with CODE_EXPIRED', !expiredRedeem.success && expiredRedeem.error === 'CODE_EXPIRED');

  // Test 4: SSO Tenant Mismatch
  const code2 = sim.mintSsoCode('user-avinash', 'tenant-yar');
  const mismatchRedeem = sim.redeemSsoCode(code2, 'tenant-acme');
  assert('SSO Code for Tenant YAR rejected on Tenant ACME with TENANT_MISMATCH', !mismatchRedeem.success && mismatchRedeem.error === 'TENANT_MISMATCH');

  // Test 5: Session Revocation
  const sessionToken = redeem1.sessionToken!;
  const authBeforeRevoke = sim.authorizeTenantRequest(sessionToken, 'yar', 'GET');
  assert('Valid session permits read access to tenant yar', authBeforeRevoke.status === 200);

  sim.revokeSession(sessionToken);
  const authAfterRevoke = sim.authorizeTenantRequest(sessionToken, 'yar', 'GET');
  assert('Revoked session immediately rejected with 401 SESSION_REVOKED', authAfterRevoke.status === 401 && authAfterRevoke.error === 'SESSION_REVOKED');

  // Test 6: Cross-Tenant Access Prevention
  const freshCode = sim.mintSsoCode('user-avinash', 'tenant-yar');
  const freshRedeem = sim.redeemSsoCode(freshCode, 'tenant-yar');
  const validYarToken = freshRedeem.sessionToken!;

  const crossTenantAttempt = sim.authorizeTenantRequest(validYarToken, 'acme', 'GET');
  assert('Token for Tenant YAR rejected on Tenant ACME with 403 CROSS_TENANT_ACCESS_DENIED', crossTenantAttempt.status === 403 && crossTenantAttempt.error === 'CROSS_TENANT_ACCESS_DENIED');

  // Test 7: Suspended Tenant Enforcement
  // Issue a token to a suspended tenant artificially
  const suspendedToken = 'sess_suspended_user';
  sim.sessions.set(crypto.createHash('sha256').update(suspendedToken).digest('hex'), {
    token_hash: crypto.createHash('sha256').update(suspendedToken).digest('hex'),
    user_id: 'user-suspended',
    tenant_id: 'tenant-suspended',
    expires_at: Date.now() + 86400000,
    revoked: false
  });
  sim.memberships.set('tenant-suspended', new Set(['user-suspended']));

  const suspendedAttempt = sim.authorizeTenantRequest(suspendedToken, 'suspended', 'GET');
  assert('Suspended tenant request returns 403 TENANT_SUSPENDED', suspendedAttempt.status === 403 && suspendedAttempt.error === 'TENANT_SUSPENDED');

  // Test 8: Kill Switch Enforcement
  const killedToken = 'sess_killed_user';
  sim.sessions.set(crypto.createHash('sha256').update(killedToken).digest('hex'), {
    token_hash: crypto.createHash('sha256').update(killedToken).digest('hex'),
    user_id: 'user-killed',
    tenant_id: 'tenant-killed',
    expires_at: Date.now() + 86400000,
    revoked: false
  });
  sim.memberships.set('tenant-killed', new Set(['user-killed']));

  const killedAttempt = sim.authorizeTenantRequest(killedToken, 'killed', 'GET');
  assert('Active kill switch returns 403 KILL_SWITCH_ACTIVE', killedAttempt.status === 403 && killedAttempt.error === 'KILL_SWITCH_ACTIVE');

  // Test 9: CSRF State-Changing Guard
  const csrfFailNoOrigin = sim.authorizeTenantRequest(validYarToken, 'yar', 'POST');
  assert('POST request without Origin header fails with 403 CSRF_ORIGIN_MISSING', csrfFailNoOrigin.status === 403 && csrfFailNoOrigin.error === 'CSRF_ORIGIN_MISSING');

  const csrfFailBadOrigin = sim.authorizeTenantRequest(validYarToken, 'yar', 'POST', 'https://evil-site.com', 'csrf-token-123');
  assert('POST request with untrusted Origin fails with 403 CSRF_ORIGIN_MISMATCH', csrfFailBadOrigin.status === 403 && csrfFailBadOrigin.error === 'CSRF_ORIGIN_MISMATCH');

  const csrfFailNoToken = sim.authorizeTenantRequest(validYarToken, 'yar', 'POST', 'https://yar.reachoutos.com');
  assert('POST request without CSRF header fails with 403 CSRF_TOKEN_MISSING', csrfFailNoToken.status === 403 && csrfFailNoToken.error === 'CSRF_TOKEN_MISSING');

  const csrfPass = sim.authorizeTenantRequest(validYarToken, 'yar', 'POST', 'https://yar.reachoutos.com', 'csrf-valid-token');
  assert('POST request with valid Origin and CSRF header succeeds with 200', csrfPass.status === 200);

  console.log('\n================================================================');
  console.log(`SECURITY MATRIX RESULT: ${passed} PASSED / ${failed} FAILED (Total ${passed + failed})`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runSecurityTests();
