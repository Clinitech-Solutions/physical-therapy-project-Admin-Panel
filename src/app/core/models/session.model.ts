export type SessionStatus = 'Confirmed' | 'In Progress' | 'Pending' | 'Cancelled' | 'Waiting' | 'Completed';
export type SessionType = 'Session' | 'Assessment';

export interface Session {
  id: string;
  scheduledAt: string; // ISO 8601 format
  patientId: string;
  doctorId: string;
  roomId: string;
  status: SessionStatus;
  type: SessionType;
  packageAlert?: string;
}
