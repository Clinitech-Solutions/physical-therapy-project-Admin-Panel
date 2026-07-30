export interface Invoice {
  id: string;
  patient: string;
  amount: number;
  status: 'Pending' | 'Paid' | 'Partial' | 'Overdue';
  type: string;
  date: string;
}
