/** Contracts verified against /openapi/v1.json on 2026-10-29. */
export interface InsuranceDetailsResponse {
  status: number | null;
  copayPercentage: number | string | null;
  approvedSessions: number | string | null;
  memberId: string | null;
  employer: string | null;
}

export interface PatientResponse {
  id: number | string;
  applicationUserId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  birthDate: string;
  gender: number;
  paymentType: string | null;
  emergencyContact: string | null;
  insuranceCompanyId: number | string | null;
  insuranceCompanyName: string | null;
  insuranceDetails: InsuranceDetailsResponse | null;
  createdAt: string;
}

export interface CreatePatientRequest {
  userName: string;
  fullName: string;
  gender: number;
  birthDate: string;
  phoneNumber: string;
  paymentType?: string | null;
  emergencyContact?: string | null;
  insuranceCompanyId?: number | null;
  insuranceDetails?: InsuranceDetailsResponse | null;
}

/** Updates have a separate contract; omitted fields must remain omitted. */
export interface UpdatePatientRequest {
  userName?: string;
  email?: string;
  fullName?: string;
  gender?: number;
  birthDate?: string;
  phoneNumber?: string;
  paymentType?: string | null;
  emergencyContact?: string | null;
  insuranceCompanyId?: number | null;
  insuranceDetails?: InsuranceDetailsResponse | null;
}

export interface PagedPatientsResponse {
  items: PatientResponse[];
  pageNumber: number | string;
  totalPages: number | string;
  hasNextPage: boolean;
}
