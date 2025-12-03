export type EmployeeStatus = 'AVAILABLE' | 'ASSIGNED' | 'IN_ROUTE';
export type EmployeeRole = 'DRIVER' | 'COLLECTOR';

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  available: boolean;
  status?: EmployeeStatus;
  role: EmployeeRole;
  assignedVehicleId?: string;
  department?: {
    id: string;
    name: string;
    latitude?: number;
    longitude?: number;
  };
}