// src/app/services/route.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RouteBin } from '../models/route';
import { DepartmentRoute } from '../models/department-route';

@Injectable({
  providedIn: 'root'
})
export class RouteService {
  private baseUrl = 'http://localhost:8080/api/routes';

  constructor(private http: HttpClient) { }

  // existing single-vehicle method
  getOptimizedRoute(departmentId: string, vehicleId: string): Observable<RouteBin[]> {
    const params = new HttpParams()
      .set('departmentId', departmentId)
      .set('vehicleId', vehicleId);
    return this.http.get<RouteBin[]>(`${this.baseUrl}/optimize`, { params });
  }

  // NEW: all vehicle routes for a department
  getDepartmentRoutes(departmentId: string): Observable<DepartmentRoute[]> {
    const params = new HttpParams().set('departmentId', departmentId);
    return this.http.get<DepartmentRoute[]>(`${this.baseUrl}/optimize/department`, { params });
  }
  getDepartmentRoutesByBinIds(departmentId: string, binIds: string[]): Observable<DepartmentRoute[]> {
    const params = new HttpParams()
      .set('departmentId', departmentId)
      .set('binIds', binIds.join(','));
    // FIXED: use baseUrl so the request goes to 8080, not 4200
    return this.http.get<DepartmentRoute[]>(`${this.baseUrl}/optimize/department/bins`, { params });
  }
  // NEW: execute full route for one vehicle (no animation yet)
  executeVehicleRoute(vehicleId: string, binIds: string[]): Observable<void> {
    const params = new HttpParams().set('vehicleId', vehicleId);
    return this.http.post<void>(`${this.baseUrl}/execute`, binIds, { params });
  }

  // NEW: execute one step (one bin) – will be used for animation later
  executeVehicleRouteStep(vehicleId: string, binId: string): Observable<void> {
    const params = new HttpParams()
      .set('vehicleId', vehicleId)
      .set('binId', binId);
    return this.http.post<void>(`${this.baseUrl}/execute/step`, {}, { params });
  }
  executeManagedRoute(departmentId: string, vehicleId: string): Observable<any> {
    const params = new HttpParams()
      .set('departmentId', departmentId)
      .set('vehicleId', vehicleId);
    return this.http.post<any>(`${this.baseUrl}/execute-managed`, {}, { params });
  }
  getDepartmentRoutesWithPolylines(departmentId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/department/${departmentId}/pre-generated`);
  }
  executeAllManagedRoutes(departmentId: string): Observable<any> {
    const params = new HttpParams().set('departmentId', departmentId);
    return this.http.post<any>(`${this.baseUrl}/execute-all-managed`, {}, { params });
  }
  getRouteInfo(departmentId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/department/${departmentId}/route-info`);
  }
  getAvailableRoutes(departmentId: string): Observable<any[]> {
  return this.http.get<any[]>(`${this.baseUrl}/department/${departmentId}/available-routes`);
}

assignRouteToVehicle(routeId: string, vehicleId: string, departmentId: string): Observable<any> {
  return this.http.post(`${this.baseUrl}/assign-route`, null, {
    params: { routeId, vehicleId, departmentId }
  });
}

}
