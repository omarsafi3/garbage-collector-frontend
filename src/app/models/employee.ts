export type EmployeeStatus = 'AVAILABLE' | 'ASSIGNED' | 'IN_ROUTE';

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  available: boolean;
  status?: EmployeeStatus;
  role?: string;
  assignedVehicleId?: string;
  departmentId?: string;
  department?: {
    id?: string;
    name: string;
    latitude?: number;
    longitude?: number;
  };
}