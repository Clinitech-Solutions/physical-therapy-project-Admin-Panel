export interface RecoveryBooking {
  appointmentId: number;
  patientId: number;
  patientName: string;
  patientGender: string;
  appointmentType: string;
  clinicianId: string;
  clinicianName: string;
  roomId: number | null;
  roomName: string | null;
  start: string;
  end: string;
  version: string;
  absenceIds: number[];
  contactStatus: string;
}
export interface AbsenceAudit {
  action: string;
  actorId: string;
  actorName: string;
  recordedAt: string;
  previousStart: string | null;
  previousEnd: string | null;
  start: string;
  end: string;
  note: string | null;
}
export interface AbsenceView {
  id: number;
  clinicianId: string;
  clinicianName: string;
  role: string;
  start: string;
  end: string;
  note: string | null;
  version: number;
  withdrawn: boolean;
  recordedBy: string | null;
  recordedAt: string;
  history: AbsenceAudit[];
  affected: RecoveryBooking[];
}
export interface AbsenceRequest {
  operationKey: string;
  clinicianId: string;
  date: string;
  endDate: string | null;
  fullDay: boolean;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  expectedVersion: number | null;
}
export interface AbsenceImpact {
  start: string;
  end: string;
  timeZone: string;
  affected: RecoveryBooking[];
}
export interface RecoveryCandidate {
  clinicianId: string;
  name: string;
  role: string;
  gender: string;
  genderMatch: boolean;
  coveringTreatment: boolean;
  start: string;
  end: string;
  roomId: number;
  roomName: string;
}
export interface RecoveryOptions {
  appointment: RecoveryBooking;
  matching: RecoveryCandidate[];
  exceptions: RecoveryCandidate[];
  nearestMatching: RecoveryCandidate[];
  seniorCapacity: number;
  timeZone: string;
}
export interface RecoveryRequest {
  operationKey: string;
  expectedVersion: string;
  absenceId: number;
  clinicianId: string;
  startTime: string;
  roomId: number;
  action: "Replace" | "Reschedule";
  reason: string;
  useException: boolean;
  phoneConsent: boolean;
  exceptionReason: string | null;
}
export interface RecoveryHistory {
  id: number;
  action: string;
  changedAt: string;
  actorName: string;
  reason: string | null;
  previousClinicianName: string | null;
  clinicianName: string | null;
  previousStart: string;
  newStart: string;
  previousRoomName: string;
  newRoomName: string;
  contactOutcome: string | null;
  genderException: boolean;
  consentMethod: string | null;
  consentRecordedAt: string | null;
  consentReason: string | null;
}
