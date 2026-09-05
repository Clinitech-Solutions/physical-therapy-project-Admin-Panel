export type Gender = 'Male' | 'Female';
export type PaymentMethod = 'Cash' | 'Online' | 'Insurance' | 'Card' | 'InstaPay';

export interface Patient {
  id: string;
  nameEn: string;
  nameAr: string;
  avatar: string;
  gender: Gender;
  phone: string;
  paymentType: PaymentMethod;
  lastVisit: string;
  documents: {
    medicalConsent: boolean;
    liabilityWaiver: boolean;
    idCard: boolean;
  };
}

export interface NewPatient {
  nameEn: string;
  nameAr: string;
  phone: string;
  gender: Gender;
  dob: string;
  paymentType: PaymentMethod;
  insuranceCompany: string;
  docs: {
    medicalConsent: boolean;
    liabilityWaiver: boolean;
    idCard: boolean;
  };
}
