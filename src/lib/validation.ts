import { Profile } from '@/types';

export const validatePAN = (pan: string): string | null => {
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
  if (!pan) return 'PAN is required';
  if (!panRegex.test(pan)) return 'Format: ABCDE1234F';
  return null;
};

export const validateDOB = (dob: string): string | null => {
  const dobRegex = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!dob) return 'Date of birth is required';
  if (!dobRegex.test(dob)) return 'Use DD/MM/YYYY format';
  
  const [day, month, year] = dob.split('/').map(Number);
  const date = new Date(year, month - 1, day);
  
  if (date.getFullYear() !== year || 
      date.getMonth() !== month - 1 || 
      date.getDate() !== day) {
    return 'Invalid date';
  }
  
  if (date > new Date()) return 'Date cannot be in the future';
  
  return null;
};

export const validatePhone = (phone: string): string | null => {
  const phoneRegex = /^[6-9]\d{9}$/;
  if (!phone) return 'Phone number is required';
  if (!phoneRegex.test(phone)) return 'Enter 10 digits starting with 6-9';
  return null;
};

export const validatePIN = (pin: string): string | null => {
  if (!pin) return 'PIN is required';
  if (pin.length !== 4) return 'PIN must be 4 digits';
  if (!/^\d{4}$/.test(pin)) return 'PIN must contain only numbers';
  return null;
};

export const validateBOID = (boid: string): string | null => {
  if (!boid) return 'BO ID is required';
  if (boid.length !== 16) return `Enter 16 characters (DP+Client). You entered ${boid.length}`;
  if (!/^[A-Z0-9]{16}$/i.test(boid)) return 'BO ID must contain only letters and numbers';
  return null;
};

export const validatePinCode = (pin: string): string | null => {
  if (!pin) return 'PIN code is required';
  if (!/^\d{6}$/.test(pin)) return 'Enter 6 digits';
  return null;
};

export const validateEmail = (email: string): string | null => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) return 'Email is required';
  if (!emailRegex.test(email)) return 'Enter a valid email address';
  return null;
};

export const getAgeFromDOB = (dob: string): number => {
  const [day, month, year] = dob.split('/').map(Number);
  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

export const isProfileComplete = (profile: Partial<Profile>): boolean => {
  const requiredFields: (keyof Profile)[] = [
    'name', 'pan', 'dob_ddmmyyyy', 'addr_flat', 'addr_premises',
    'addr_street', 'addr_area', 'addr_city', 'addr_state', 'addr_pin',
    'email', 'phone', 'assessed_to_tax', 'latest_ay', 'fy_label',
    'income_for_decl', 'income_total_fy', 'other_forms_count',
    'other_forms_amount', 'boid', 'signature'
  ];

  return requiredFields.every(field => {
    const value = profile[field];
    return value !== undefined && value !== '' && value !== null;
  });
};

export const getBasicExemptionLimit = (financialYear: string): number => {
  // Basic exemption limits for different years
  const limits: Record<string, number> = {
    '2023-24': 250000,
    '2024-25': 300000,
  };
  
  return limits[financialYear] || 250000;
};