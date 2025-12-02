// Re-export shared models
export { Bin } from './bin';
export { Department } from './department';

export interface TruckPositionUpdate {
  vehicleId: string;
  latitude: number;
  longitude: number;
  progressPercent: number;
}

export interface VehicleStatusUpdate {
  vehicleId: string;
  status: 'AVAILABLE' | 'UNLOADING' | 'IN_ROUTE' | 'RETURNING';
  fillLevel?: number;
  available?: boolean;
  timestamp?: string;
}

export interface RouteProgressUpdate {
  vehicleId: string;
  currentStop: number;
  totalStops: number;
  binId: string;
  vehicleFillLevel: number;
}

export interface RouteCompletionEvent {
  vehicleId: string;
  binsCollected: number;
}
