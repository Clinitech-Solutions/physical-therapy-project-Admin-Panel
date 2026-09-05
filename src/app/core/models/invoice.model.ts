export type InvoiceStatus = 'Pending' | 'Paid' | 'Partial' | 'Overdue';

export interface Invoice {
  id: string;
  patient: string;
  amount: number;
  status: InvoiceStatus;
  type: string;
  date: string;
}
