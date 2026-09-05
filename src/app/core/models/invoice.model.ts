export type InvoiceStatus = 'Pending' | 'Paid' | 'Partial' | 'Overdue';

export interface Invoice {
  id: string;
  patientId: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  type: string;
  createdAt: string; // ISO 8601
}
