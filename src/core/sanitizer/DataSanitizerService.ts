/**
 * ReachOutOS Smart Data Sanitizer & AI Column Transformer Service
 * Automatically cleanses, standardizes, and normalizes contact records prior to import.
 */

export interface SanitizedContactRow {
  originalIndex: number;
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string;
  email?: string;
  companyName: string;
  city: string;
  state: string;
  hasPhoneFormatted: boolean;
  hasNameCapitalized: boolean;
  isEmailValid: boolean;
  warnings: string[];
}

export interface SanitizationReport {
  totalProcessed: number;
  phoneNumbersFixed: number;
  namesNormalized: number;
  invalidEmailsFlagged: number;
  duplicatesRemoved: number;
  rows: SanitizedContactRow[];
}

export class DataSanitizerService {
  /**
   * Title-cases words properly (handling abbreviations like PVT, LTD)
   */
  public static toTitleCase(str: string): string {
    if (!str) return '';
    return str
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map(word => {
        if (/^(pvt|ltd|llp|inc|co|corp)$/i.test(word)) return word.toUpperCase();
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }

  /**
   * Cleans and standardizes international phone numbers into E.164 format
   */
  public static cleanPhoneNumber(raw: string, defaultCountryCode: string = '91'): { phone: string; wasModified: boolean; isValid: boolean } {
    if (!raw) return { phone: '', wasModified: false, isValid: false };
    
    // Strip non-digit characters except leading plus
    let digits = raw.replace(/[^\d+]/g, '');
    const original = digits;

    // Remove leading zeroes (e.g. 09848012345 -> 9848012345)
    if (digits.startsWith('0')) {
      digits = digits.replace(/^0+/, '');
    }

    // If no leading '+', prepend default country code if 10-digit
    if (!digits.startsWith('+')) {
      if (digits.length === 10) {
        digits = `+${defaultCountryCode}${digits}`;
      } else if (digits.length === 12 && digits.startsWith(defaultCountryCode)) {
        digits = `+${digits}`;
      } else {
        digits = `+${digits}`;
      }
    }

    const isValid = /^\+[1-9]\d{9,14}$/.test(digits);
    return {
      phone: digits,
      wasModified: digits !== original,
      isValid
    };
  }

  /**
   * Validates email address syntax and flags disposable domains
   */
  public static validateEmail(raw?: string): { isValid: boolean; warning?: string } {
    if (!raw || !raw.trim()) return { isValid: true };
    const email = raw.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(email)) {
      return { isValid: false, warning: 'Malformed email syntax' };
    }

    if (/mailinator|tempmail|10minutemail|guerrillamail/i.test(email)) {
      return { isValid: false, warning: 'Disposable/temporary email domain' };
    }

    return { isValid: true };
  }

  /**
   * Batch sanitizes and enriches raw imported rows
   */
  public static sanitizeBatch(rawRows: any[]): SanitizationReport {
    let phoneNumbersFixed = 0;
    let namesNormalized = 0;
    let invalidEmailsFlagged = 0;
    const seenPhones = new Set<string>();
    const cleanedRows: SanitizedContactRow[] = [];

    rawRows.forEach((row, idx) => {
      const rawFirst = String(row.first_name || row.firstName || row.name || '').trim();
      const rawLast = String(row.last_name || row.lastName || '').trim();
      const rawCompany = String(row.company_name || row.company || '').trim();
      const rawCity = String(row.city || '').trim();
      const rawState = String(row.state || '').trim();
      const rawPhone = String(row.phone || row.mobile || row.whatsapp || '').trim();
      const rawEmail = String(row.email || '').trim();

      const { phone, wasModified: phoneFixed, isValid: phoneValid } = this.cleanPhoneNumber(rawPhone);
      if (phoneFixed) phoneNumbersFixed++;

      const cleanFirst = this.toTitleCase(rawFirst);
      const cleanLast = this.toTitleCase(rawLast);
      const cleanCompany = this.toTitleCase(rawCompany);
      const cleanCity = this.toTitleCase(rawCity);
      const cleanState = this.toTitleCase(rawState);

      const nameNormalized = cleanFirst !== rawFirst || cleanCompany !== rawCompany;
      if (nameNormalized) namesNormalized++;

      const emailCheck = this.validateEmail(rawEmail);
      if (!emailCheck.isValid) invalidEmailsFlagged++;

      const warnings: string[] = [];
      if (!phoneValid) warnings.push('Phone number may be incomplete or invalid E.164');
      if (emailCheck.warning) warnings.push(emailCheck.warning);

      // Check duplicates within batch
      if (phone && seenPhones.has(phone)) {
        warnings.push('Duplicate phone collision within batch');
      } else if (phone) {
        seenPhones.add(phone);
      }

      cleanedRows.push({
        originalIndex: idx,
        firstName: cleanFirst,
        lastName: cleanLast,
        displayName: `${cleanFirst} ${cleanLast}`.trim() || cleanCompany || 'Contact',
        phone,
        email: rawEmail || undefined,
        companyName: cleanCompany,
        city: cleanCity,
        state: cleanState,
        hasPhoneFormatted: phoneFixed,
        hasNameCapitalized: nameNormalized,
        isEmailValid: emailCheck.isValid,
        warnings
      });
    });

    return {
      totalProcessed: rawRows.length,
      phoneNumbersFixed,
      namesNormalized,
      invalidEmailsFlagged,
      duplicatesRemoved: rawRows.length - seenPhones.size,
      rows: cleanedRows
    };
  }
}
