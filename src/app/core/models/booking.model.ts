export interface BookingPlan {
  id: number; doctorId: string; doctorName: string; treatmentType: string;
  plannedSessions: number; bookedSessions: number; completedSessions: number; remainingSessions: number;
  financial?: CourseFinancialSummary | null;
  staffReviewRequired?:boolean;
}
export interface BookingContext {
  patientId: number; patientName: string; gender: 'Male' | 'Female'; paymentType: string | null;
  hasCompletedAssessment: boolean; isInsurance: boolean; insuranceApproved: boolean;
  remainingApprovedSessions: number | null; copayPercentage: number | null; insuranceCompanyName: string | null;
  approvedSessions?: number | null;
  assessments: { id: number; assessmentDate: string; completedAt: string | null; diagnosis: string }[];
  plans: BookingPlan[];
}
export interface BookingClinician { id: string; name: string; gender: 'Male' | 'Female'; role: string; preferred: boolean; currentLoad: number; }
export type BookingPaymentMethod = 'Cash' | 'Visa' | 'Online' | 'EWallet' | 'BankTransfer';
export interface BookingRequest {
  idempotencyKey: string; patientId: number; clinicianId: string; roomId: number; treatmentPlanId: number | null;
  startsAt: string[]; assessmentCharge: 'Free' | 'Paid' | null; pricingMode: 'PerSession' | 'Package';
  unitPrice: number | null; packagePrice: number | null; discount: number; deposit: number;
  paymentMethod: BookingPaymentMethod | null; installments: { dueDate: string; amount: number }[];
  discountType?: 'None' | 'Percent' | 'Fixed'; discountValue?: number;
}
export interface BookingPreview {
  canSave: boolean; appointments: { startTime: string; endTime: string; conflicts: string[] }[]; errors: string[];
  totalAmount: number; patientAmount: number; insuranceAmount: number; deposit: number; remainingAmount: number; waiverReason: string | null;
  financial?: CourseFinancialSummary | null; discountAmount?: number;
}
export interface CourseFinancialSummary {
  agreementId: number | null; treatmentPlanId: number; fundingType: 'SelfPay' | 'Insurance'; pricingMode: 'PerSession' | 'Package';
  prescribedSessions: number; coveredSessions: number; approvedSessions: number | null; unitPrice: number;
  discountType: 'None' | 'Fixed' | 'Percent'; discountValue: number; grossAmount: number; discountAmount: number;
  totalAmount: number; patientAmount: number; insuranceAmount: number; copayPercentage: number; paidAmount: number;
  remainingAmount: number; consumedSessions: number; nextSessionPatientAmount: number; additionalPaymentRequired: number;
  reused: boolean; approvalReference: string | null;
}
export interface PaymentGate {
  appointmentId: number; canStart: boolean; accountKey: string; invoiceId: number | null; pricingMode: string;
  patientPaid: number; requiredCumulative: number; additionalPaymentRequired: number; patientBalance: number; consumedSessions: number;
}
export interface InsuranceReceivable {
  invoiceId: number; claimId: number | null; courseAgreementId: number | null; treatmentPlanSessionId: number | null;
  patientId: number; patientName: string; insuranceCompanyId: number; companyName: string; approvalReference: string | null;
  deliveredAt: string | null; plannedAmount: number; earnedAmount: number; submittedAmount: number; collectedAmount: number;
  outstandingAmount: number; submissionReference: string | null;
  canSubmitClaim: boolean;
}
export interface InsurerBalance { planned: number; earned: number; submitted: number; collected: number; outstanding: number; }
export interface InsuranceAccounts {
  companies: (InsurerBalance & {insuranceCompanyId: number; companyName: string; patients: (InsurerBalance & {patientId: number; patientName: string})[]})[];
  receivables: InsuranceReceivable[];
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
