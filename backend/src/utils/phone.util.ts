/**
 * International E.164 phone number validation and privacy masking utilities.
 */

// E.164: '+' followed by 1-3 digit country code and 4-14 digit subscriber number (7-15 digits total)
export const E164_REGEX = /^\+[1-9]\d{6,14}$/;

export function isValidE164(phone: string): boolean {
  return E164_REGEX.test(phone.trim());
}

/**
 * Mask destination phone numbers for privacy protection in list and aggregate views.
 * e.g. "+14155552671" -> "+1 (415) ***-2671" or "+1 415 *** 2671"
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone) return 'Unknown';
  const clean = phone.trim();

  // If standard US/Canada number +1XXXXXXXXXX
  if (clean.startsWith('+1') && clean.length === 12) {
    const area = clean.substring(2, 5);
    const last4 = clean.substring(8);
    return `+1 (${area}) ***-${last4}`;
  }

  // General international format: preserve prefix (+ & country/area code) and last 4 digits
  if (clean.startsWith('+') && clean.length >= 8) {
    const prefix = clean.substring(0, clean.length - 7);
    const last4 = clean.substring(clean.length - 4);
    return `${prefix} *** ${last4}`;
  }

  // Fallback for non-standard formats
  if (clean.length > 4) {
    const last4 = clean.substring(clean.length - 4);
    return `***-***-${last4}`;
  }

  return '***';
}
