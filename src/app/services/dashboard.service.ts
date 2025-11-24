import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';

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
  selectedRouteId?: string;  // ✅ ADD THIS LINE
}
@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private readonly apiUrl = 'http://localhost:8080/api/dashboard';

  constructor(private http: HttpClient) { }

  getDepartments(): Observable<DepartmentStats[]> {
    return this.http.get<DepartmentStats[]>(`${this.apiUrl}/departments`).pipe(
      timeout(5000),
      catchError(() => of([]))
    );
  }

  getDepartmentVehicles(deptId: string): Observable<VehicleInfo[]> {
  // ✅ CORRECT URL: /api/departments/{id}/vehicles (exists!)
  const url = `http://localhost:8080/api/departments/${deptId}/vehicles`;
  console.log('🚛 Fetching vehicles:', url);
  
  return this.http.get<VehicleInfo[]>(url).pipe(
    timeout(5000),
    catchError(err => {
      console.error('❌ Vehicles error:', err);
      return of([]); // Empty fallback
    })
  );
}

  // 🔥 NEW ROUTE ENDPOINTS
  getDepartmentRoutes(deptId: string): Observable<any> {
    // ✅ CORRECT URL: /api/routes/optimize/department?departmentId=...
    const url = `http://localhost:8080/api/routes/optimize/department?departmentId=${deptId}`;
    console.log('🗺️ Fetching department routes:', url);
    return this.http.get<any>(url).pipe(
      timeout(10000),
      catchError(err => {
        console.error('❌ Routes error:', err);
        return of([]); // Fallback to empty
      })
    );
  }

  getVehicleRoute(deptId: string, vehicleId: string): Observable<any> {
    // ✅ CORRECT URL: /api/routes/optimize?departmentId=...&vehicleId=...
    const url = `http://localhost:8080/api/routes/optimize?departmentId=${deptId}&vehicleId=${vehicleId}`;
    console.log('🚛 Fetching single vehicle route:', url);
    return this.http.get<any>(url).pipe(
      timeout(10000),
      catchError(err => {
        console.error('❌ Single route error:', err);
        return of([]);
      })
    );
  }

  executeAllDepartmentRoutes(deptId: string): Observable<any> {
    // TODO: Add backend endpoint later
    console.log('🚀 Execute ALL routes (mock)');
    return of({ success: true });
  }

  executeVehicleRoute(vehicleId: string, routeData: any): Observable<any> {
    // ✅ CORRECT URL: /api/routes/execute?vehicleId=... 
    const url = `http://localhost:8080/api/routes/execute?vehicleId=${vehicleId}`;
    return this.http.post(url, routeData).pipe(
      timeout(5000),
      catchError(() => of({ success: true })) // Mock success for now
    );
  }
}
