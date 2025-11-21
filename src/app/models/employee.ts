export interface Employee {
  id?: string;
  firstName: string;
  lastName: string;
  available: boolean;
  department?: {
    id?: string;
    name: string;
    latitude?: number;
    longitude?: number;
  };
}