export type Profile = {
  name: string;
  pan: string;
  dob_ddmmyyyy: string;
  residential_status: 'Indian' | 'NRI';
  status: 'Individual' | 'HUF';
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
  // Updated field names to match user mapping
  estimatedIncomeCurrent: number;  // income_for_decl
  estimatedIncomeTotal: number;    // income_total_fy
  assessmentYearPrevious?: string; // latest AY if assessed
  formCount: number;               // other_forms_count
  formAmount: number;              // other_forms_amount
  boid: string;
  signature?: string; // base64 image
  financialYear?: string;
  assessmentYear?: string;
  financialYearEnd?: string;
  ack_15g_over_exemption?: boolean;
  // Legacy fields for backward compatibility
  income_for_decl?: number;
  income_total_fy?: number;
  other_forms_count?: number;
  other_forms_amount?: number;
};

export type DividendRow = {
  symbol: string;
  qty: number;
  dps: number;
  total: number;
  status: 'pending' | 'ready' | 'filed';
  formType?: '15g' | '15h'; // Which form type was filed
  filedAt?: string; // When was it filed
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

export type GeneratedForm = {
  id: string;
  type: 'Form15G' | 'Form15H';
  generatedAt: string;
  filename: string;
  dividend: DividendRow; // Single dividend per form
  profileSnapshot: Profile;
  totalAmount: number;
  pdfBlob?: Blob; // For preview
};

export type UIState = {
  currentPage: string;
  debugMode: boolean;
};
