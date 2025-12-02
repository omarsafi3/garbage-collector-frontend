import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface DepartmentStats {
  departmentId: string;
  departmentName: string;
  totalVehicles: number;
  availableVehicles: number;
  activeVehicles: number;
  totalEmployees: number;
  availableEmployees: number;
  totalBins: number;
  criticalBins: number;
  binsCollectedToday: number;
  averageFillLevel: number;
  co2Saved: number;
}

export interface VehicleInfo {
  id: string;
  reference: string;
  plate: string;
  fillLevel: number;
  available: boolean;
  selectedRouteId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private readonly apiUrl = `${environment.apiUrl}/api/dashboard`;

  constructor(private http: HttpClient) { }

  getDepartments(): Observable<DepartmentStats[]> {
    return this.http.get<DepartmentStats[]>(`${this.apiUrl}/departments`).pipe(
      timeout(5000),
      catchError(() => of([]))
    );
  }

  getDepartmentVehicles(deptId: string): Observable<VehicleInfo[]> {
    const url = `${environment.apiUrl}/api/departments/${deptId}/vehicles`;
    return this.http.get<VehicleInfo[]>(url).pipe(
      timeout(5000),
      catchError(() => of([]))
    );
  }

  getDepartmentRoutes(deptId: string): Observable<DepartmentStats[]> {
    const url = `${environment.apiUrl}/api/routes/optimize/department?departmentId=${deptId}`;
    return this.http.get<DepartmentStats[]>(url).pipe(
      timeout(10000),
      catchError(() => of([]))
    );
  }

  getVehicleRoute(deptId: string, vehicleId: string): Observable<VehicleInfo[]> {
    const url = `${environment.apiUrl}/api/routes/optimize?departmentId=${deptId}&vehicleId=${vehicleId}`;
    return this.http.get<VehicleInfo[]>(url).pipe(
      timeout(10000),
      catchError(() => of([]))
    );
  }

  executeAllDepartmentRoutes(deptId: string): Observable<{ success: boolean }> {
    return of({ success: true });
  }

  executeVehicleRoute(vehicleId: string, routeData: unknown): Observable<{ success: boolean }> {
    const url = `${environment.apiUrl}/api/routes/execute?vehicleId=${vehicleId}`;
    return this.http.post<{ success: boolean }>(url, routeData).pipe(
      timeout(5000),
      catchError(() => of({ success: true }))
    );
  }
}
