export type Gender = 'Male' | 'Female';
export type PaymentMethod = 'Cash' | 'Online' | 'Insurance' | 'Card' | 'InstaPay';

export interface InsuranceDetails {
  company: string;
  status: 'Pending' | 'Approved' | 'Unknown';
  /** Preserve the server enum until its numeric labels are documented. */
  apiStatus?: number | null;
  copayPercentage?: number;
  approvedSessions?: number;
  memberId?: string;
  employer?: string;
}

export interface FinancialPlan {
  paymentMode: 'Per-Session' | 'Package' | 'Upfront-Copay';
  totalAgreedAmount?: number; // Total package price or Total Copay for all sessions
  discount?: number;
  netAmount?: number;
  totalPaidSoFar?: number;
  remainingDebt?: number;
  sessionPrice?: number; // Used if 'Per-Session'
}

export interface Patient {
  id: string;
  nameEn: string;
  nameAr: string;
  avatar: string;
  gender: Gender;
  phone: string;
  birthDate?: string;
  email?: string;
  emergencyContact?: string | null;
  address?: string;
  occupation?: string;
  paymentType: PaymentMethod;
  lastVisit: string; // ISO 8601
  documents: {
    medicalConsent: boolean;
    liabilityWaiver: boolean;
    idCard: boolean;
  };
  documentsKnown?: boolean;
  assignedDoctorId?: string;
  insuranceCompanyId?: number | null;
  insuranceCompanyName?: string | null;
  insuranceDetails?: InsuranceDetails;
  financialPlan?: FinancialPlan;
  treatmentPlan?: {
    totalSessions: number;
    primaryDoctorId: string;
    financialPlan?: FinancialPlan;
  };
}

export interface NewPatient {
  userName?: string;
  nameEn: string;
  nameAr: string;
  phone: string;
  gender: Gender;
  dob: string;
  emergencyContact?: string;
  address?: string;
  occupation?: string;
  paymentType: PaymentMethod;
  insuranceCompanyId?: number | null;
  insuranceCompany: string;
  insuranceDetails?: InsuranceDetails;
  financialPlan?: FinancialPlan;
  docs: {
    medicalConsent: boolean;
    liabilityWaiver: boolean;
    idCard: boolean;
  };
}

