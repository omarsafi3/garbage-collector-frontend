import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DepartmentSummary {
  totalBins: number;
  criticalBins: number;
  averageFillLevel: number;
  totalCollections: number;
  co2Saved: number;
  // Extended fields from backend
  totalCO2EmissionsKg?: number;
  treesNeededToOffset?: number;
  avgCO2PerRoute?: number;
  totalCostEuros?: number;
  totalFuelLiters?: number;
  avgCostPerRoute?: number;
  totalBinsCollected?: number;
  totalDistanceKm?: number;
  totalRoutes?: number;
}

export interface RecentRoute {
  id: string;
  vehicleId: string;
  vehicleReference?: string;
  completedAt: Date;
  binsCollected: number;
  distanceKm: number;
  totalDistanceKm?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private readonly apiUrl = `${environment.apiUrl}/api/analytics`;

  constructor(private http: HttpClient) {}

  getDepartmentSummary(departmentId: string): Observable<DepartmentSummary> {
    return this.http.get<DepartmentSummary>(`${this.apiUrl}/department/${departmentId}/summary`);
  }

  getRecentRoutes(departmentId: string, limit: number = 5): Observable<RecentRoute[]> {
    return this.http.get<RecentRoute[]>(`${this.apiUrl}/department/${departmentId}/recent?limit=${limit}`);
  }
}
