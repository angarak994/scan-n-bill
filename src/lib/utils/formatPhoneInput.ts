export function formatPhoneInput(rawValue: string): string {
  let digits = rawValue.replace(/\D/g, '');
  
  // If the user pastes a number with country code, strip it to avoid truncation of actual number
  if (digits.length >= 12 && digits.startsWith('91')) {
    digits = digits.substring(2);
  } else if (digits.length >= 11 && digits.startsWith('0')) {
    digits = digits.substring(1);
  }
  
  return digits.slice(0, 10);
}
