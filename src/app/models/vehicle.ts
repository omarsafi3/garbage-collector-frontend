export type VehicleStatus = 'AVAILABLE' | 'IN_ROUTE' | 'RETURNING' | 'UNLOADING';
export type VehicleType = 'TRUCK' | 'VAN' | 'COMPACT';

export interface Vehicle {
  id?: string;
  reference?: string;
  plate: string;
  type?: VehicleType;
  capacity?: number;
  fillLevel?: number;
  available?: boolean;
  status?: VehicleStatus;
  statusUpdatedAt?: string;
  departmentId?: string;
  department?: {
    id: string;
    name: string;
  };
}
