export interface User {
  id: string;
  username: string;
  role: 'SUPER_ADMIN' | 'ADMIN';
  departmentId?: string;
}
