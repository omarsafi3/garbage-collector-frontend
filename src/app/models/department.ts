import { Employee } from "./employee";
import { Vehicle } from "./vehicle";
export interface Department {
  id: string;
  name: string;
  latitude: number;
  longitude: number;

  employees?: Employee[];
  vehicles?: Vehicle[];
}