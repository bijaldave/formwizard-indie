import type { Profile, DividendRow, HoldingRow, AuthData, UIState, GeneratedForm } from '@/types';

const STORAGE_KEYS = {
  AUTH: 'auth.json',
  PROFILE: 'profile.json',
  HOLDINGS: 'holdings.json',
  DIVIDENDS: 'dividends.json',
  UI: 'ui.json',
  GENERATED_FORMS: 'generated_forms.json',
} as const;

export class LocalStorage {
  static get<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  static set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }

  static remove(key: string): void {
    localStorage.removeItem(key);
  }
}

// Auth functions
export const getAuth = (): AuthData => 
  LocalStorage.get(STORAGE_KEYS.AUTH, {
    phone: '',
    pinHash: '',
    isAuthenticated: false,
    attempts: 0,
    lastAttempt: 0,
  });

export const setAuth = (auth: AuthData): void => 
  LocalStorage.set(STORAGE_KEYS.AUTH, auth);

export const clearAuth = (): void => 
  LocalStorage.remove(STORAGE_KEYS.AUTH);

// Profile functions
export const getProfile = (): Partial<Profile> => 
  LocalStorage.get(STORAGE_KEYS.PROFILE, {});

export const setProfile = (profile: Partial<Profile>): void => 
  LocalStorage.set(STORAGE_KEYS.PROFILE, profile);

// Holdings functions
export const getHoldings = (): HoldingRow[] => 
  LocalStorage.get(STORAGE_KEYS.HOLDINGS, []);

export const setHoldings = (holdings: HoldingRow[]): void => 
  LocalStorage.set(STORAGE_KEYS.HOLDINGS, holdings);

// Dividends functions
export const getDividends = (): DividendRow[] => 
  LocalStorage.get(STORAGE_KEYS.DIVIDENDS, []);

export const setDividends = (dividends: DividendRow[]): void => 
  LocalStorage.set(STORAGE_KEYS.DIVIDENDS, dividends);

// UI state functions
export const getUIState = (): UIState => 
  LocalStorage.get(STORAGE_KEYS.UI, {
    currentPage: '/',
    debugMode: false,
  });

export const setUIState = (state: Partial<UIState>): void => {
  const current = getUIState();
  LocalStorage.set(STORAGE_KEYS.UI, { ...current, ...state });
};

// Generated forms functions
export const getGeneratedForms = (): GeneratedForm[] => 
  LocalStorage.get(STORAGE_KEYS.GENERATED_FORMS, []);

export const setGeneratedForms = (forms: GeneratedForm[]): void => 
  LocalStorage.set(STORAGE_KEYS.GENERATED_FORMS, forms);

export const addGeneratedForm = (form: GeneratedForm): void => {
  const forms = getGeneratedForms();
  forms.unshift(form); // Add to beginning for recent-first order
  setGeneratedForms(forms);
};

export const removeGeneratedForm = (formId: string): void => {
  const forms = getGeneratedForms();
  const filtered = forms.filter(f => f.id !== formId);
  setGeneratedForms(filtered);
};

// Reset holdings data function
export const resetHoldingsData = (): void => {
  LocalStorage.remove(STORAGE_KEYS.HOLDINGS);
  LocalStorage.remove(STORAGE_KEYS.DIVIDENDS);
  LocalStorage.remove(STORAGE_KEYS.GENERATED_FORMS);
};

// Logout function
export const logout = (): void => {
  setAuth({
    phone: '',
    pinHash: '',
    isAuthenticated: false,
    attempts: 0,
    lastAttempt: 0,
  });
};