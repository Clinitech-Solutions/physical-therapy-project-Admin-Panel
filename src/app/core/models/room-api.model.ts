export interface RoomWriteRequest {
  name: string;
  capacity: number;
  isActive: boolean;
}
export interface MaintenanceRequest {
  maintenance: boolean;
}
/** Read adapter validates these fields; non-empty response still awaits a backend sample. */
export interface RoomRecord extends RoomWriteRequest {
  id: number;
  status?: 'Available' | 'Occupied' | 'Maintenance' | 'Unknown';
  currentLoad?: number;
  occupants?: {appointmentId:number;patientName:string;clinicianName:string|null;state:string}[];
}
