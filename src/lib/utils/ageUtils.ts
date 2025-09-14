import { Profile } from '@/types';

/**
 * Calculate age from DOB string in DD/MM/YYYY format
 */
export function calculateAge(dobString: string): number {
  const [day, month, year] = dobString.split('/').map(Number);
  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Determine which form type to use based on age
 * 15G for age < 60, 15H for age >= 60
 */
export function getFormType(profile: Profile): '15g' | '15h' {
  const age = calculateAge(profile.dob_ddmmyyyy);
  return age >= 60 ? '15h' : '15g';
}

/**
 * Get form display name
 */
export function getFormDisplayName(formType: '15g' | '15h'): string {
  return formType === '15g' ? 'Form 15G' : 'Form 15H';
}