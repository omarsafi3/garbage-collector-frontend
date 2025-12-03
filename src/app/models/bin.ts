export type BinStatus = 'normal' | 'warning' | 'critical' | 'collected' | 'active';

export interface Bin {
  id: string;
  latitude: number;
  longitude: number;
  fillLevel: number;
  status: BinStatus;
  lastEmptied?: string;
  lastUpdated?: string;
  department?: {
    id: string;
    name: string;
  };
}
