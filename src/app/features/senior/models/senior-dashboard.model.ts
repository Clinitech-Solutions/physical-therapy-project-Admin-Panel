export interface SeniorTask {
  id: string;
  patientId: string;
  patientName: string;
  avatarInitials: string;
  scheduledTime: string;
  type: 'Assessment' | 'Re-Assessment';
  status: 'Pending' | 'In Progress' | 'Completed';
}

export interface DoctorWorkload {
  doctorId: string;
  name: string;
  currentLoad: number;
  maxLoad: number;
  borderColor: string;
}
