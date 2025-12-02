export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

export interface User {
  id: string;
  username: string;
  role: 'SUPER_ADMIN' | 'ADMIN';
  departmentId?: string; // Only for ADMIN
}

export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN'
}
