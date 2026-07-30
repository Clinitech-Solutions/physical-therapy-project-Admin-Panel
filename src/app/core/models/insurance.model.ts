export interface InsuranceClaim {
  id: string;
  name: string;
  company: string;
  status: 'Documents Pending' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected';
  copay: number | null;
  pendingDocs?: number;
}
