export type UserRole = 'Receptionist' | 'Senior Therapist' | 'Doctor' | 'CEO' | 'Patient' | string;

export interface User {
  id: string;
  email: string;
  roles: UserRole[];
  [key: string]: any; // Allow other properties from JWT
}

export interface AuthResponse {
  token: string;
}

export interface LoginRequest {
  email?: string;
  password?: string;
  [key: string]: any;
}
