export type SessionStatus = 'Confirmed' | 'In Progress' | 'Pending' | 'Cancelled' | 'Waiting' | 'Completed';

export interface Session {
  id: string;
  time: string;
  patientName: string;
  patientAvatar: string;
  doctorName: string;
  room: string;
  status: SessionStatus;
  packageAlert?: string;
}
