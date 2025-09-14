export type Profile = {
  name: string;
  pan: string;
  dob_ddmmyyyy: string;
  resident: boolean;
  status: 'Individual';
  addr_flat: string;
  addr_premises: string;
  addr_street: string;
  addr_area: string;
  addr_city: string;
  addr_state: string;
  addr_pin: string;
  email: string;
  phone: string;
  assessed_to_tax: 'Yes' | 'No';
  latest_ay: string;
  fy_label: string;
  income_for_decl: number;
  income_total_fy: number;
  other_forms_count: number;
  other_forms_amount: number;
  boid: string;
  signature?: string; // base64 image
  ack_15g_over_exemption?: boolean;
};

export type DividendRow = {
  symbol: string;
  qty: number;
  dps: number;
  total: number;
  status: 'pending' | 'ready' | 'filed';
};

export type HoldingRow = {
  symbol: string;
  qty: number;
};

export type AuthData = {
  phone: string;
  pinHash: string;
  isAuthenticated: boolean;
  attempts: number;
  lastAttempt: number;
};

export type UIState = {
  currentPage: string;
  debugMode: boolean;
};

export type FormType = '15G' | '15H';

export type FieldMapping = {
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  lineClamp?: number;
};