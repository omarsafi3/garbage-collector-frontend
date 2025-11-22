export interface TruckPositionUpdate {
  vehicleId: string;
  latitude: number;
  longitude: number;
  progressPercent: number;
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

export interface Bin {
  id: string;
  latitude: number;
  longitude: number;
  fillLevel: number;
  status: string;
}

export interface Department {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}
