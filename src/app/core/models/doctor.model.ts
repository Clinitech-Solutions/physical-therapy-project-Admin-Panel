export interface DoctorSlot {
  doctor: string;
  doctorGender: string;
  time: string;
  room: string;
  load: number;
}

export interface DoctorAvailability {
  name: string;
  load: number;
  room: string;
}
