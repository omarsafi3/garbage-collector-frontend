export type BinStatus = 'normal' | 'warning' | 'critical' | 'collected';

export interface Bin {
  id: string;
  latitude: number;
  longitude: number;
  fillLevel: number;
  status: BinStatus;
  lastCollected?: Date;
  departmentId?: string;
}
