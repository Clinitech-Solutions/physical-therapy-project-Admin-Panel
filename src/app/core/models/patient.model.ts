export interface Patient {
  id: string;
  nameEn: string;
  nameAr: string;
  avatar: string;
  gender: 'Male' | 'Female';
  phone: string;
  paymentType: 'Cash' | 'Online' | 'Insurance';
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
  gender: string;
  dob: string;
  paymentType: string;
  insuranceCompany: string;
  docs: {
    medicalConsent: boolean;
    liabilityWaiver: boolean;
    idCard: boolean;
  };
}
