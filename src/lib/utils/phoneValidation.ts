/**
 * Centralized utility to strictly validate and normalize phone numbers across the QControl platform.
 * Follows the core rule: Any required phone number MUST be exactly 10 digits after normalization.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
    if (!phone) return null;
    
    // Remove all non-digit characters (spaces, hyphens, plus signs, brackets, etc.)
    let digits = phone.toString().replace(/\D/g, '');
    
    // Normalize Indian prefixes (+91 or 0)
    if (digits.length === 12 && digits.startsWith('91')) {
        digits = digits.substring(2);
    } else if (digits.length === 11 && digits.startsWith('0')) {
        digits = digits.substring(1);
    }
    
    // Strict validation: must be exactly 10 digits
    if (digits.length === 10) {
        return digits;
    }
    
    return null;
}
