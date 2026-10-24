import { parseAuthorityStrict } from '../src/core/routing/AuthorityParser.ts';

interface TestCase {
  name: string;
  input: string;
  expectedValid: boolean;
  expectedType?: string;
  expectedSlug?: string | null;
  expectedPort?: number | null;
  expectedError?: string;
}

const testCases: TestCase[] = [
  // 1. Canonical Domain Hierarchy
  {
    name: 'Root domain matches LANDING',
    input: 'reachoutos.com',
    expectedValid: true,
    expectedType: 'LANDING',
    expectedSlug: null,
    expectedPort: null
  },
  {
    name: 'App subdomain matches APP',
    input: 'app.reachoutos.com',
    expectedValid: true,
    expectedType: 'APP',
    expectedSlug: null,
    expectedPort: null
  },
  {
    name: 'API subdomain matches API',
    input: 'api.reachoutos.com',
    expectedValid: true,
    expectedType: 'API',
    expectedSlug: null,
    expectedPort: null
  },
  {
    name: 'Links subdomain matches LINKS',
    input: 'links.reachoutos.com',
    expectedValid: true,
    expectedType: 'LINKS',
    expectedSlug: null,
    expectedPort: null
  },
  {
    name: 'Tenant subdomain matches TENANT',
    input: 'yar.reachoutos.com',
    expectedValid: true,
    expectedType: 'TENANT',
    expectedSlug: 'yar',
    expectedPort: null
  },
  {
    name: 'Hyphenated tenant slug is valid',
    input: 'acme-corp.reachoutos.com',
    expectedValid: true,
    expectedType: 'TENANT',
    expectedSlug: 'acme-corp',
    expectedPort: null
  },

  // 2. Ports and Colon Handling
  {
    name: 'Standard HTTPS port',
    input: 'app.reachoutos.com:443',
    expectedValid: true,
    expectedType: 'APP',
    expectedPort: 443
  },
  {
    name: 'Custom dev port',
    input: 'yar.reachoutos.com:3000',
    expectedValid: true,
    expectedType: 'TENANT',
    expectedSlug: 'yar',
    expectedPort: 3000
  },
  {
    name: 'Port with trailing non-digits (443abc) must fail',
    input: 'app.reachoutos.com:443abc',
    expectedValid: false,
    expectedError: 'PORT_NOT_DECIMAL_DIGITS'
  },
  {
    name: 'Port out of range (99999) must fail',
    input: 'app.reachoutos.com:99999',
    expectedValid: false,
    expectedError: 'PORT_OUT_OF_RANGE'
  },
  {
    name: 'Port zero (0) must fail',
    input: 'app.reachoutos.com:0',
    expectedValid: false,
    expectedError: 'PORT_OUT_OF_RANGE'
  },

  // 3. Trailing Dot Handling
  {
    name: 'Trailing dot (DNS root) must fail',
    input: 'reachoutos.com.',
    expectedValid: false,
    expectedError: 'TRAILING_DOT_DISALLOWED'
  },
  {
    name: 'Tenant with trailing dot must fail',
    input: 'yar.reachoutos.com.',
    expectedValid: false,
    expectedError: 'TRAILING_DOT_DISALLOWED'
  },

  // 4. Label RFC 1123 Boundary and Format Checks
  {
    name: 'Single character label is valid',
    input: 'a.reachoutos.com',
    expectedValid: true,
    expectedType: 'TENANT',
    expectedSlug: 'a'
  },
  {
    name: 'Label starting with hyphen is invalid',
    input: '-bad.reachoutos.com',
    expectedValid: false,
    expectedError: 'LABEL_FAILS_RFC1123'
  },
  {
    name: 'Label ending with hyphen is invalid',
    input: 'bad-.reachoutos.com',
    expectedValid: false,
    expectedError: 'LABEL_FAILS_RFC1123'
  },
  {
    name: 'Consecutive dots create empty label and must fail',
    input: 'yar..reachoutos.com',
    expectedValid: false,
    expectedError: 'EMPTY_LABEL_OR_CONSECUTIVE_DOTS'
  },
  {
    name: 'Label exceeding 63 octets must fail',
    input: `${'a'.repeat(64)}.reachoutos.com`,
    expectedValid: false,
    expectedError: 'LABEL_LENGTH_EXCEEDED'
  },

  // 5. Reserved and Multi-Tier Subdomains
  {
    name: 'Reserved subdomain "www" is rejected',
    input: 'www.reachoutos.com',
    expectedValid: false,
    expectedError: 'RESERVED_SUBDOMAIN_WWW'
  },
  {
    name: 'Reserved subdomain "admin" is rejected',
    input: 'admin.reachoutos.com',
    expectedValid: false,
    expectedError: 'RESERVED_SUBDOMAIN_ADMIN'
  },
  {
    name: 'Reserved subdomain "auth" is rejected',
    input: 'auth.reachoutos.com',
    expectedValid: false,
    expectedError: 'RESERVED_SUBDOMAIN_AUTH'
  },
  {
    name: 'Multi-tier subdomain is rejected',
    input: 'nested.yar.reachoutos.com',
    expectedValid: false,
    expectedError: 'MULTI_TIER_SUBDOMAIN_DISALLOWED'
  },

  // 6. External and Suffix Spoofing
  {
    name: 'Untrusted external domain is rejected',
    input: 'attacker.com',
    expectedValid: false,
    expectedError: 'DOMAIN_NOT_ALLOWED'
  },
  {
    name: 'Domain suffix spoofing (reachoutos.com.attacker.com) is rejected',
    input: 'reachoutos.com.attacker.com',
    expectedValid: false,
    expectedError: 'DOMAIN_NOT_ALLOWED'
  },
  {
    name: 'Lookalike prefix (evilreachoutos.com) is rejected',
    input: 'evilreachoutos.com',
    expectedValid: false,
    expectedError: 'DOMAIN_NOT_ALLOWED'
  },

  // 7. IPv4 Format and Malformed Octets
  {
    name: 'IPv4 loopback is recognized as LOCALHOST',
    input: '127.0.0.1',
    expectedValid: true,
    expectedType: 'LOCALHOST'
  },
  {
    name: 'Malformed IPv4 octet > 255 is rejected',
    input: '127.0.0.999',
    expectedValid: false,
    expectedError: 'IPV4_OCTET_OUT_OF_RANGE'
  },
  {
    name: 'Malformed IPv4 with octal leading zero is rejected',
    input: '127.0.0.01',
    expectedValid: false,
    expectedError: 'IPV4_LEADING_ZERO_OCTAL_DISALLOWED'
  },
  {
    name: 'IPv4 with extra octet is rejected',
    input: '127.0.0.1.1',
    expectedValid: false,
    expectedError: 'MALFORMED_IPV4_OCTET_COUNT'
  },

  // 8. IPv6 Bracketed vs Unbracketed
  {
    name: 'Bracketed IPv6 loopback is valid',
    input: '[::1]',
    expectedValid: true,
    expectedType: 'LOCALHOST'
  },
  {
    name: 'Bracketed IPv6 loopback with port is valid',
    input: '[::1]:8080',
    expectedValid: true,
    expectedType: 'LOCALHOST',
    expectedPort: 8080
  },
  {
    name: 'Unbracketed IPv6 is ambiguous and rejected',
    input: '2001:db8::1',
    expectedValid: false,
    expectedError: 'UNBRACKETED_IPV6_DISALLOWED'
  },
  {
    name: 'Malformed unclosed bracket IPv6 is rejected',
    input: '[::1',
    expectedValid: false,
    expectedError: 'MALFORMED_BRACKETED_IPV6'
  },

  // 9. Injection Delimiters and Userinfo
  {
    name: 'Userinfo injection is rejected',
    input: 'admin:secret@reachoutos.com',
    expectedValid: false,
    expectedError: 'USERINFO_DISALLOWED'
  },
  {
    name: 'Path delimiter in authority is rejected',
    input: 'reachoutos.com/admin',
    expectedValid: false,
    expectedError: 'URI_DELIMITERS_DISALLOWED'
  },
  {
    name: 'Query delimiter in authority is rejected',
    input: 'reachoutos.com?param=value',
    expectedValid: false,
    expectedError: 'URI_DELIMITERS_DISALLOWED'
  }
];

function runTests() {
  console.log('================================================================');
  console.log('AUTHORITY PARSER STRICT RFC 1123 / MULTI-TENANT TEST HARNESS');
  console.log(`Node Runtime: ${process.version}`);
  console.log(`Platform: ${process.platform} (${process.arch})`);
  console.log(`Total Test Assertions: ${testCases.length}`);
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const res = parseAuthorityStrict(tc.input);

    let ok = res.isValid === tc.expectedValid;
    if (tc.expectedType && res.type !== tc.expectedType) ok = false;
    if (tc.expectedSlug !== undefined && res.tenantSlug !== tc.expectedSlug) ok = false;
    if (tc.expectedPort !== undefined && res.port !== tc.expectedPort) ok = false;
    if (tc.expectedError && res.error !== tc.expectedError) ok = false;

    if (ok) {
      passed++;
      console.log(`  PASS: [${tc.input}] -> Valid=${res.isValid}, Type=${res.type}${res.tenantSlug ? ', Slug=' + res.tenantSlug : ''}${res.port ? ', Port=' + res.port : ''}`);
    } else {
      failed++;
      console.error(`  FAIL: [${tc.input}]`);
      console.error(`        Expected: Valid=${tc.expectedValid}, Type=${tc.expectedType}, Slug=${tc.expectedSlug}, Error=${tc.expectedError}`);
      console.error(`        Actual:   Valid=${res.isValid}, Type=${res.type}, Slug=${res.tenantSlug}, Error=${res.error}`);
    }
  }

  console.log('\n================================================================');
  console.log(`RESULT: ${passed} PASSED / ${failed} FAILED (Total ${testCases.length})`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
