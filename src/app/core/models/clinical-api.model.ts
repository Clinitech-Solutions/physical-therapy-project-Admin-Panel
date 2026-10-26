/** DTOs transcribed from the current OpenAPI schemas; enum integers stay opaque. */
export interface AssessmentRecord {
  id: number;
  patientId: number;
  patientName: string;
  seniorId: string;
  seniorName: string;
  diagnosis: string;
  conditionType: string;
  priority: string;
  notes: string | null;
  assessmentDate: string;
  status: number;
  hasTreatmentPlan: boolean;
  treatmentPlanId: number | null;
}
export interface TreatmentPlanRecord {
  id: number;
  assessmentId: number;
  doctorId: string;
  doctorName: string;
  numberOfSessions: number;
  completedSessions: number;
  progressPercentage: number;
  frequencyPerWeek: number;
  treatmentType: string;
  exercises: string | null;
  status: number;
}
export interface TreatmentPlanSessionRecord {
  id: number;
  treatmentPlanId: number;
  sessionNumber: number;
  sessionDate: string | null;
  checkIn: string | null;
  checkOut: string | null;
  paymentStatus: number;
  status: number;
  notes: string | null;
}
