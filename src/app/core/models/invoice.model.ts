export type InvoiceStatus = 'Paid' | 'Pending' | 'Partial' | 'Waived' | 'Refunded';

export interface Invoice {
  id: string;
  patientId: string;
  sessionId?: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  type: string;
  createdAt: string; // ISO 8601
  paymentMethod?: string;
  subtotal?: number;
  discount?: number;
  netAmount?: number; // The final amount after discount
  paidAmount?: number;
  remainingBalance?: number;
}
