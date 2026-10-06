/**
 * Data Quality Engine
 * Provides phone canonicalization, email validation, disposable domain checks, and duplicate triage.
 */

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'sharklasers.com',
  'throwawaymail.com',
  'yopmail.com',
  'trashmail.com',
  'dispostable.com',
]);

export interface NormalizedPhoneResult {
  isValid: boolean;
  canonical: string;
  country: string;
  isMobile: boolean;
  isLandline: boolean;
  error?: string;
}

export interface NormalizedEmailResult {
  isValid: boolean;
  canonical: string;
  domain: string;
  isDisposable: boolean;
  error?: string;
}

export class DataQualityEngine {
  /**
   * Normalizes phone numbers to canonical E.164.
   * Special high-accuracy rule for India (+91) with standard 10-digit mobile check.
   */
  static normalizePhone(rawPhone: string, defaultCountry = 'IN'): NormalizedPhoneResult {
    if (!rawPhone || typeof rawPhone !== 'string') {
      return { isValid: false, canonical: '', country: defaultCountry, isMobile: false, isLandline: false, error: 'Phone number is empty' };
    }

    // Strip all whitespace, dashes, parentheses, dots
    const cleaned = rawPhone.trim().replace(/[\s\-\(\)\.]/g, '');

    // India specific rule
    if (defaultCountry === 'IN' || cleaned.startsWith('+91') || (cleaned.startsWith('91') && cleaned.length === 12) || (cleaned.startsWith('0') && cleaned.length === 11)) {
      let digits = cleaned;
      if (digits.startsWith('+91')) {
        digits = digits.substring(3);
      } else if (digits.startsWith('91') && digits.length === 12) {
        digits = digits.substring(2);
      } else if (digits.startsWith('0') && digits.length === 11) {
        digits = digits.substring(1);
      }

      // Check if 10 digits
      if (!/^\d{10}$/.test(digits)) {
        return {
          isValid: false,
          canonical: cleaned,
          country: 'IN',
          isMobile: false,
          isLandline: digits.length < 10,
          error: `Malformed Indian number (${digits.length} digits). Expected 10 digits.`
        };
      }

      // Indian mobile numbers start with 6, 7, 8, or 9
      const firstDigit = digits.charAt(0);
      if (['6', '7', '8', '9'].includes(firstDigit)) {
        return {
          isValid: true,
          canonical: `+91${digits}`,
          country: 'IN',
          isMobile: true,
          isLandline: false
        };
      } else {
        return {
          isValid: false,
          canonical: `+91${digits}`,
          country: 'IN',
          isMobile: false,
          isLandline: true,
          error: `Number begins with '${firstDigit}' which indicates a landline, not a mobile/WhatsApp line.`
        };
      }
    }

    // Generic international E.164 check
    if (cleaned.startsWith('+')) {
      const digitsOnly = cleaned.substring(1);
      if (/^\d{7,15}$/.test(digitsOnly)) {
        return {
          isValid: true,
          canonical: cleaned,
          country: 'INTL',
          isMobile: true,
          isLandline: false
        };
      }
    }

    // If digits only without plus
    if (/^\d{10,14}$/.test(cleaned)) {
      return {
        isValid: true,
        canonical: `+${cleaned}`,
        country: 'INTL',
        isMobile: true,
        isLandline: false
      };
    }

    return {
      isValid: false,
      canonical: cleaned,
      country: defaultCountry,
      isMobile: false,
      isLandline: false,
      error: 'Invalid phone format. Please include valid country code.'
    };
  }

  /**
   * Validates and normalizes email addresses.
   */
  static normalizeEmail(rawEmail: string): NormalizedEmailResult {
    if (!rawEmail || typeof rawEmail !== 'string') {
      return { isValid: false, canonical: '', domain: '', isDisposable: false, error: 'Email is empty' };
    }

    const trimmed = rawEmail.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

    if (!emailRegex.test(trimmed)) {
      return {
        isValid: false,
        canonical: trimmed,
        domain: trimmed.split('@')[1] || '',
        isDisposable: false,
        error: 'Malformed email syntax'
      };
    }

    const parts = trimmed.split('@');
    const domain = parts[1];

    if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
      return {
        isValid: false,
        canonical: trimmed,
        domain,
        isDisposable: true,
        error: `Temporary or disposable email domain (${domain}) detected`
      };
    }

    return {
      isValid: true,
      canonical: trimmed,
      domain,
      isDisposable: false
    };
  }

  /**
   * Resolves text variables like {{first_name}}, {{company_name}} in templates.
   */
  static resolveTemplateVariables(template: string, data: Record<string, string>): {
    resolved: string;
    missingVariables: string[];
  } {
    const missing: string[] = [];
    const resolved = template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
      const val = data[key];
      if (val === undefined || val === null || val.trim() === '') {
        missing.push(key);
        return `{{${key}}}`;
      }
      return val;
    });

    return {
      resolved,
      missingVariables: Array.from(new Set(missing))
    };
  }
}
