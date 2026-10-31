export type TreatmentState =
  | "Scheduled"
  | "Arrived"
  | "Treating"
  | "TreatmentFinished"
  | "Departed"
  | "Cancelled"
  | "NoShow"
  | "LegacyCompleted";
export interface DoctorVisit {
  appointmentId: number;
  patientId: number;
  patientName: string;
  phone: string | null;
  gender: string;
  treatmentPlanId: number;
  sessionId: number;
  sessionNumber: number;
  planSummary: string | null;
  doctorId: string;
  doctorName: string | null;
  roomId: number | null;
  roomName: string | null;
  plannedStart: string;
  plannedEnd: string;
  arrivedAt: string | null;
  departedAt: string | null;
  treatmentStartedAt: string | null;
  treatmentEndedAt: string | null;
  state: TreatmentState;
}
export interface DoctorSchedule {
  date: string;
  appointments: DoctorVisit[];
  activeTreatments: DoctorVisit[];
}
export interface ClinicalPlan {
  id: number;
  diagnosis: string;
  conditionType: string;
  assessmentNotes: string | null;
  assessedAt: string | null;
  seniorName: string;
  treatmentType: string;
  exercises: string | null;
  prescribed: number;
  booked: number;
  completed: number;
  frequencyPerWeek: number;
  assignedDoctor: string;
  staffReviewRequired: boolean;
}
export interface NotesFields {
  progressNotes: string;
  conditionChanges: string;
  responseToTreatment: string;
  treatmentPerformed: string;
}
export interface ClinicalNotes extends NotesFields {
  version: number;
  authorName: string | null;
  savedAt: string | null;
  finalizedAt: string | null;
}
export interface PreviousClinicalSession {
  sessionNumber: number;
  plannedAt: string | null;
  treatmentStartedAt: string | null;
  treatmentEndedAt: string | null;
  authorName: string | null;
  recordedAt: string | null;
  progressNotes: string | null;
  conditionChanges: string | null;
  responseToTreatment: string | null;
  treatmentPerformed: string | null;
}
export interface ReassessmentRequest {
  id: number;
  patientId: number;
  patientName: string;
  treatmentPlanId: number;
  relatedAppointmentId: number | null;
  requestedBy: string;
  requestedAt: string;
  reasonCategory: string;
  notes: string;
  recommendation: "Continue" | "Pause";
  state: "Requested" | "InReview" | "Completed" | "Cancelled";
  reviewStartedAt: string | null;
  seniorId: string | null;
  seniorName: string | null;
  completedAssessmentId: number | null;
  revisedPlanId: number | null;
  cancellationReason: string | null;
  version: number;
  diagnosis: string;
  exercises: string | null;
  previousSessions: PreviousClinicalSession[];
  prescribedSessions: number;
  completedSessions: number;
  treatmentType: string;
  frequencyPerWeek: number;
  doctorId: string;
  doctorName: string;
  reviewNotes: string | null;
  decision: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
}
export interface DoctorPatientWorkspace {
  visit: DoctorVisit;
  birthDate: string | null;
  plan: ClinicalPlan;
  notes: ClinicalNotes;
  previousSessions: PreviousClinicalSession[];
  documents: { id: number; fileName: string; uploadedAt: string }[];
  reassessments: ReassessmentRequest[];
}
export interface NotesMutation extends NotesFields {
  expectedVersion: number;
}
export interface CompleteReassessment {
  expectedVersion: number;
  progressNotes: string;
  decision: "Continue" | "Revise" | "Discharge";
  diagnosis: string;
  doctorId: string;
  numberOfSessions: number;
  frequencyPerWeek: number;
  treatmentType: string;
  exercises: string | null;
}
