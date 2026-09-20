export type UserRole = 'Receptionist' | 'Senior' | 'Doctor' | 'CEO' | 'Patient' | string;

export interface User {
  id: string;
  email: string;
  userName?: string;
  roles: UserRole[];
  [key: string]: any; // Allow other properties from JWT
}

export interface AuthResponse {
  id?: string;
  userName?: string;
  token: string;
  refreshToken?: string;
  expiresIn?: number;
  message?: string;
}

export interface LoginRequest {
  email?: string;
  password?: string;
  [key: string]: any;
}
