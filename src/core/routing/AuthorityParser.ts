import net from 'net';

export type HostType = 'LANDING' | 'APP' | 'API' | 'LINKS' | 'TENANT' | 'LOCALHOST' | 'INVALID';

export interface ParsedAuthority {
  raw: string;
  isValid: boolean;
  hostname: string;
  port: number | null;
  isIPv4: boolean;
  isIPv6: boolean;
  type: HostType;
  tenantSlug: string | null;
  error?: string;
}

export const RESERVED_SLUGS = new Set([
  'www',
  'app',
  'api',
  'links',
  'link',
  'auth',
  'admin',
  'billing',
  'status',
  'mail',
  'smtp',
  'internal',
  'stage',
  'staging',
  'prod',
  'production',
  'test',
  'dev'
]);

const LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const PORT_REGEX = /^\d+$/;

/**
 * Parses and validates an HTTP authority string (host[:port]) strictly according
 * to RFC 1123, RFC 3986, and ReachOut OS multi-tenant routing invariants.
 */
export function parseAuthorityStrict(authority: string, baseDomain = 'reachoutos.com'): ParsedAuthority {
  const result: ParsedAuthority = {
    raw: authority,
    isValid: false,
    hostname: '',
    port: null,
    isIPv4: false,
    isIPv6: false,
    type: 'INVALID',
    tenantSlug: null
  };

  if (!authority || typeof authority !== 'string') {
    result.error = 'EMPTY_OR_NON_STRING_AUTHORITY';
    return result;
  }

  const trimmed = authority.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > 255) {
    result.error = 'INVALID_LENGTH';
    return result;
  }

  // Reject embedded credentials (user:pass@host)
  if (trimmed.includes('@')) {
    result.error = 'USERINFO_DISALLOWED';
    return result;
  }

  // Reject paths, query parameters, or fragments
  if (trimmed.includes('/') || trimmed.includes('?') || trimmed.includes('#')) {
    result.error = 'URI_DELIMITERS_DISALLOWED';
    return result;
  }

  let hostPart = '';
  let portPart: string | null = null;

  // 1. Bracketed IPv6 authority: [::1] or [::1]:port
  if (trimmed.startsWith('[')) {
    const closeBracketIdx = trimmed.indexOf(']');
    if (closeBracketIdx === -1) {
      result.error = 'MALFORMED_BRACKETED_IPV6';
      return result;
    }
    const ipInside = trimmed.substring(1, closeBracketIdx);
    if (!net.isIPv6(ipInside)) {
      result.error = 'INVALID_IPV6_ADDRESS';
      return result;
    }
    hostPart = `[${ipInside}]`;
    result.isIPv6 = true;

    const afterBracket = trimmed.substring(closeBracketIdx + 1);
    if (afterBracket.length > 0) {
      if (!afterBracket.startsWith(':')) {
        result.error = 'MALFORMED_IPV6_PORT_DELIMITER';
        return result;
      }
      portPart = afterBracket.substring(1);
    }
  } else {
    // 2. Standard hostname or IPv4 (optional :port)
    const colonCount = (trimmed.match(/:/g) || []).length;
    if (colonCount > 1) {
      // Unbracketed IPv6 is ambiguous and rejected per RFC 3986
      result.error = 'UNBRACKETED_IPV6_DISALLOWED';
      return result;
    } else if (colonCount === 1) {
      const parts = trimmed.split(':');
      hostPart = parts[0];
      portPart = parts[1];
    } else {
      hostPart = trimmed;
    }
  }

  // Validate Port if present
  if (portPart !== null) {
    if (!PORT_REGEX.test(portPart)) {
      result.error = 'PORT_NOT_DECIMAL_DIGITS';
      return result;
    }
    const parsedPort = parseInt(portPart, 10);
    if (isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      result.error = 'PORT_OUT_OF_RANGE';
      return result;
    }
    result.port = parsedPort;
  }

  // Trailing dot check (reject DNS root reference to prevent canonical confusion)
  if (hostPart.endsWith('.')) {
    result.error = 'TRAILING_DOT_DISALLOWED';
    return result;
  }

  result.hostname = hostPart;

  // IPv6 handling
  if (result.isIPv6) {
    result.isValid = true;
    result.type = hostPart === '[::1]' ? 'LOCALHOST' : 'INVALID';
    return result;
  }

  // IPv4 validation
  if (/^\d+(\.\d+)*$/.test(hostPart)) {
    const octets = hostPart.split('.');
    if (octets.length !== 4) {
      result.error = 'MALFORMED_IPV4_OCTET_COUNT';
      return result;
    }
    for (const octet of octets) {
      if (octet.length > 1 && octet.startsWith('0')) {
        result.error = 'IPV4_LEADING_ZERO_OCTAL_DISALLOWED';
        return result;
      }
      const val = parseInt(octet, 10);
      if (isNaN(val) || val < 0 || val > 255) {
        result.error = 'IPV4_OCTET_OUT_OF_RANGE';
        return result;
      }
    }
    result.isIPv4 = true;
    result.isValid = true;
    result.type = (hostPart === '127.0.0.1') ? 'LOCALHOST' : 'INVALID';
    return result;
  }

  // Localhost hostname check
  if (hostPart === 'localhost') {
    result.isValid = true;
    result.type = 'LOCALHOST';
    return result;
  }

  // RFC 1123 Hostname validation
  const labels = hostPart.split('.');
  if (labels.some(l => l.length === 0)) {
    result.error = 'EMPTY_LABEL_OR_CONSECUTIVE_DOTS';
    return result;
  }

  for (const label of labels) {
    if (label.length < 1 || label.length > 63) {
      result.error = 'LABEL_LENGTH_EXCEEDED';
      return result;
    }
    if (!LABEL_REGEX.test(label)) {
      result.error = 'LABEL_FAILS_RFC1123';
      return result;
    }
  }

  // Domain hierarchy classification against base domain
  const normalizedBase = baseDomain.toLowerCase();
  if (hostPart === normalizedBase) {
    result.isValid = true;
    result.type = 'LANDING';
    return result;
  }

  if (hostPart.endsWith(`.${normalizedBase}`)) {
    const prefix = hostPart.slice(0, -(normalizedBase.length + 1));
    const subLabels = prefix.split('.');

    // We do NOT allow multi-tier subdomains (e.g. foo.bar.reachoutos.com)
    if (subLabels.length !== 1) {
      result.error = 'MULTI_TIER_SUBDOMAIN_DISALLOWED';
      return result;
    }

    const sub = subLabels[0];
    if (sub === 'app') {
      result.isValid = true;
      result.type = 'APP';
      return result;
    }
    if (sub === 'api') {
      result.isValid = true;
      result.type = 'API';
      return result;
    }
    if (sub === 'links') {
      result.isValid = true;
      result.type = 'LINKS';
      return result;
    }

    if (RESERVED_SLUGS.has(sub)) {
      result.error = `RESERVED_SUBDOMAIN_${sub.toUpperCase()}`;
      return result;
    }

    // Valid tenant subdomain
    result.isValid = true;
    result.type = 'TENANT';
    result.tenantSlug = sub;
    return result;
  }

  // Unrecognized domain
  result.error = 'DOMAIN_NOT_ALLOWED';
  return result;
}
