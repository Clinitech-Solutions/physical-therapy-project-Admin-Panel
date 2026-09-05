export interface InsuranceClaim {
  id: string;
  patientId: string;
  company: string;
  status: 'Documents Pending' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected';
  copay: number | null;
  missingDocs: string[];
}
