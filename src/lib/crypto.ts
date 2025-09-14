// Simple password hashing for client-side storage
export const hashPIN = async (pin: string, salt: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const generateSalt = (): string => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

export const verifyPIN = async (pin: string, hash: string): Promise<boolean> => {
  // Extract salt from hash (first 32 chars)
  const salt = hash.substring(0, 32);
  const expectedHash = hash.substring(32);
  
  const calculatedHash = await hashPIN(pin, salt);
  return calculatedHash === expectedHash;
};

export const createPINHash = async (pin: string): Promise<string> => {
  const salt = generateSalt();
  const hash = await hashPIN(pin, salt);
  return salt + hash;
};