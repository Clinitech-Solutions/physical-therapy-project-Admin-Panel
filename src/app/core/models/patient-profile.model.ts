export interface ProfileSession {
  id: number;
  sessionNumber: number;
  appointmentId: number | null;
  version: string | null;
  clinicianId: string | null;
  doctorName: string;
  roomId: number | null;
  roomName: string | null;
  startTime: string | null;
  endTime: string | null;
  actualCheckIn: string | null;
  actualCheckOut: string | null;
  status: string;
  patientCoverage: string;
  patientLiability: number | null;
  patientPaid: number | null;
  canReschedule: boolean;
}
export interface ProfilePayment {
  id: number;
  invoiceId: number;
  invoiceNumber: string;
  amount: number;
  payer: string;
  method: string;
  date: string;
  reference: string | null;
}
export interface ProfileActivity {
  id: number;
  appointmentId: number;
  changedAt: string;
  actorName: string;
  previousStart: string;
  previousEnd: string;
  previousRoomName: string;
  newStart: string;
  newEnd: string;
  newRoomName: string;
  reason: string | null;
}
export interface ProfileCourse {
  id: number;
  treatmentType: string;
  status: string;
  doctorName: string;
  prescribedSessions: number;
  completedSessions: number;
  patientAmount: number;
  patientPaid: number;
  patientBalance: number;
  insurerAmount: number;
  insurerPaid: number;
  insurerBalance: number;
  sessions: ProfileSession[];
  payments: ProfilePayment[];
  activity: ProfileActivity[];
}
export interface ProfileData {
  assessmentPayments?: ProfilePayment[];
  patientId: number;
  courses: ProfileCourse[];
  assessments: {
    id: number;
    date: string;
    diagnosis: string;
    seniorName: string;
    completedAt: string | null;
  }[];
}
export interface RescheduleSlot {
  startTime: string;
  endTime: string;
  roomId: number;
  roomName: string;
  remainingCapacity: number;
}
export interface RescheduleAvailability {
  appointmentId: number;
  version: string;
  currentStart: string;
  currentEnd: string;
  currentRoomId: number | null;
  clinicianId: string;
  clinicianName: string;
  date: string;
  slots: RescheduleSlot[];
  notices: string[];
}
export interface RescheduleRequest {
  operationKey: string;
  expectedVersion: string;
  startTime: string;
  roomId: number;
  reason: string | null;
}
export interface RescheduleReceipt {
  operationKey: string;
  appointmentId: number;
  patientId: number;
  treatmentPlanId: number | null;
  startTime: string;
  endTime: string;
  roomId: number;
  roomName: string;
  changedAt: string;
}
