export interface Session {
  id: string;
  time: string;
  patientName: string;
  patientAvatar: string;
  doctorName: string;
  room: string;
  status: 'Confirmed' | 'In Progress' | 'Pending' | 'Cancelled' | 'Waiting' | 'Completed';
  packageAlert?: string;
}
