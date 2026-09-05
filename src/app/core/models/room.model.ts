export interface Room {
  id: string;
  displayName: string;
  status: 'Occupied' | 'Available' | 'Maintenance';
  doctorId: string | null;
  currentLoad: number;
  capacity: number;
}
