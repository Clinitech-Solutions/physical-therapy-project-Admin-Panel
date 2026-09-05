export interface Doctor {
  id: string;
  name: string;
  gender: 'Male' | 'Female';
}

export interface DoctorSlot {
  doctorId: string;
  scheduledAt: string; // ISO 8601
  roomId: string;
  currentLoad: number;
}

export interface DoctorAvailability {
  doctorId: string;
  currentLoad: number;
  roomId: string;
}
