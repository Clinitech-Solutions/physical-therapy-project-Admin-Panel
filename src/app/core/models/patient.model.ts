export type Gender = 'Male' | 'Female';
export type PaymentMethod = 'Cash' | 'Online' | 'Insurance' | 'Card' | 'InstaPay';

export interface InsuranceDetails {
  company: string;
  status: 'Pending' | 'Approved';
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
  address?: string;
  occupation?: string;
  paymentType: PaymentMethod;
  lastVisit: string; // ISO 8601
  documents: {
    medicalConsent: boolean;
    liabilityWaiver: boolean;
    idCard: boolean;
  };
  assignedDoctorId?: string;
  insuranceDetails?: InsuranceDetails;
  financialPlan?: FinancialPlan;
  treatmentPlan?: {
    totalSessions: number;
    primaryDoctorId: string;
    financialPlan?: FinancialPlan;
  };
}

export interface NewPatient {
  nameEn: string;
  nameAr: string;
  phone: string;
  gender: Gender;
  dob: string;
  address?: string;
  occupation?: string;
  paymentType: PaymentMethod;
  insuranceCompany: string;
  insuranceDetails?: InsuranceDetails;
  financialPlan?: FinancialPlan;
  docs: {
    medicalConsent: boolean;
    liabilityWaiver: boolean;
    idCard: boolean;
  };
}

