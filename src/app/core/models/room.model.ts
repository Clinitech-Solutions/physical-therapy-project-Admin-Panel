export interface Room {
  name: string;
  status: 'Occupied' | 'Available' | 'Maintenance';
  doctor: string | null;
  load: string | null;
}
