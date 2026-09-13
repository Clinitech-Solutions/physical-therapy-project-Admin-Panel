export type Gender = 'Male' | 'Female';
export type PaymentMethod = 'Cash' | 'Online' | 'Insurance' | 'Card' | 'InstaPay';

export interface InsuranceDetails {
  company: string;
  status: 'Pending' | 'Approved';
  copayPercentage?: number;
  approvedSessions?: number;
  memberId?: string;
}

export interface Patient {
  id: string;
  nameEn: string;
  nameAr: string;
  avatar: string;
  gender: Gender;
  phone: string;
  paymentType: PaymentMethod;
  lastVisit: string; // ISO 8601
  documents: {
    medicalConsent: boolean;
    liabilityWaiver: boolean;
    idCard: boolean;
  };
  insuranceDetails?: InsuranceDetails;
}

export interface NewPatient {
  nameEn: string;
  nameAr: string;
  phone: string;
  gender: Gender;
  dob: string;
  paymentType: PaymentMethod;
  insuranceCompany: string;
  insuranceDetails?: InsuranceDetails;
  docs: {
    medicalConsent: boolean;
    liabilityWaiver: boolean;
    idCard: boolean;
  };
}

