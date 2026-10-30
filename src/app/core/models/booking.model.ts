export interface BookingPlan {
  id: number; doctorId: string; doctorName: string; treatmentType: string;
  plannedSessions: number; bookedSessions: number; completedSessions: number; remainingSessions: number;
}
export interface BookingContext {
  patientId: number; patientName: string; gender: 'Male' | 'Female'; paymentType: string | null;
  hasCompletedAssessment: boolean; isInsurance: boolean; insuranceApproved: boolean;
  remainingApprovedSessions: number | null; copayPercentage: number | null; insuranceCompanyName: string | null;
  assessments: { id: number; assessmentDate: string; completedAt: string | null; diagnosis: string }[];
  plans: BookingPlan[];
}
export interface BookingClinician { id: string; name: string; gender: 'Male' | 'Female'; role: string; preferred: boolean; currentLoad: number; }
export type BookingPaymentMethod = 'Cash' | 'Visa' | 'EWallet' | 'BankTransfer';
export interface BookingRequest {
  idempotencyKey: string; patientId: number; clinicianId: string; roomId: number; treatmentPlanId: number | null;
  startsAt: string[]; assessmentCharge: 'Free' | 'Paid' | null; pricingMode: 'PerSession' | 'Package';
  unitPrice: number | null; packagePrice: number | null; discount: number; deposit: number;
  paymentMethod: BookingPaymentMethod | null; installments: { dueDate: string; amount: number }[];
}
export interface BookingPreview {
  canSave: boolean; appointments: { startTime: string; endTime: string; conflicts: string[] }[]; errors: string[];
  totalAmount: number; patientAmount: number; insuranceAmount: number; deposit: number; remainingAmount: number; waiverReason: string | null;
}
export interface BookingReceipt {
  idempotencyKey: string; patientId: number; outcome: 'Committed'; appointments: { id: number; treatmentPlanSessionId: number | null; startTime: string; endTime: string }[];
  invoiceIds: number[]; totalAmount: number; patientAmount: number; insuranceAmount: number; paidAmount: number;
  remainingAmount: number; waiverReason: string | null; installments: { dueDate: string; amount: number }[];
}
export interface BookingAccount {
  key: string; patientId: number; patientName: string; pricingMode: 'PerSession' | 'Package'; totalAmount: number; discount: number;
  patientAmount: number; insuranceAmount: number; paidAmount: number; remainingAmount: number;
  invoiceIds: number[]; installments: { dueDate: string; amount: number }[];
}
