// src/app/services/route.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RouteBin } from '../models/route';
import { DepartmentRoute } from '../models/department-route';
import { environment } from '../../environments/environment';

export interface RouteGenerationResponse {
  routeCount: number;
  departmentId: string;
  generatedAt: Date;
}

export interface AvailableRoute {
  routeId: string;
  binCount: number;
  bins: RouteBin[];
  polyline: Array<{ latitude: number; longitude: number }>;
}

export interface ActiveVehicle {
  vehicleId: string;
  reference: string;
  latitude: number;
  longitude: number;
  fillLevel: number;
  status: string;
  activeRouteId?: string;
  departmentId: string;
}

export interface ActiveRoute {
  routeId: string;
  vehicleId: string;
  bins: RouteBin[];
  fullRoutePolyline: Array<{ latitude: number; longitude: number }>;
  currentStopIndex: number;
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class RouteService {
  private readonly baseUrl = `${environment.apiUrl}/api/routes`;

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
  
  getAvailableRoutes(departmentId: string): Observable<AvailableRoute[]> {
    return this.http.get<AvailableRoute[]>(`${this.baseUrl}/department/${departmentId}/available-routes`);
  }

  assignRouteToVehicle(routeId: string, vehicleId: string, departmentId: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.baseUrl}/assign-route`, null, {
      params: { routeId, vehicleId, departmentId }
    });
  }

  /**
   * Manual route generation trigger
   */
  generateRoutes(departmentId: string): Observable<RouteGenerationResponse> {
    return this.http.post<RouteGenerationResponse>(`${this.baseUrl}/department/${departmentId}/generate`, null);
  }

  /**
   * Manually check critical bins
   */
  checkCriticalBins(): Observable<{ checked: boolean; criticalCount: number }> {
    return this.http.post<{ checked: boolean; criticalCount: number }>(`${this.baseUrl}/check-critical-bins`, null);
  }

  /**
   * Dispatch all available vehicles
   */
  dispatchAllVehicles(departmentId: string): Observable<{ dispatched: number }> {
    const params = new HttpParams().set('departmentId', departmentId);
    return this.http.post<{ dispatched: number }>(`${this.baseUrl}/execute-all-managed`, null, { params });
  }

  getActiveVehicles(): Observable<ActiveVehicle[]> {
    return this.http.get<ActiveVehicle[]>(`${this.baseUrl}/active-vehicles`);
  }

  /**
   * Get active route for a vehicle
   */
  getActiveRoute(vehicleId: string): Observable<ActiveRoute> {
    return this.http.get<ActiveRoute>(`${this.baseUrl}/active-route/${vehicleId}`);
  }

  // ==================== AUTO-DISPATCH ====================

  /**
   * Get auto-dispatch status for a department
   */
  getAutoDispatchStatus(departmentId: string): Observable<AutoDispatchStatus> {
    return this.http.get<AutoDispatchStatus>(`${this.baseUrl}/auto-dispatch/status/${departmentId}`);
  }

  /**
   * Manually trigger auto-dispatch for a department
   */
  triggerAutoDispatch(departmentId: string): Observable<AutoDispatchResult> {
    return this.http.post<AutoDispatchResult>(`${this.baseUrl}/auto-dispatch/trigger/${departmentId}`, null);
  }

  /**
   * Enable auto-dispatch globally
   */
  enableAutoDispatch(): Observable<{ message: string; enabled: boolean }> {
    return this.http.post<{ message: string; enabled: boolean }>(`${this.baseUrl}/auto-dispatch/enable`, null);
  }

  /**
   * Disable auto-dispatch globally
   */
  disableAutoDispatch(): Observable<{ message: string; enabled: boolean }> {
    return this.http.post<{ message: string; enabled: boolean }>(`${this.baseUrl}/auto-dispatch/disable`, null);
  }
}

// Auto-dispatch interfaces
export interface AutoDispatchStatus {
  enabled: boolean;
  criticalThreshold: number;
  minBinsForRoute: number;
  availableRoutes: number;
  availableVehicles: number;
  availableDrivers: number;
  availableCollectors: number;
  canDispatch: boolean;
}

export interface AutoDispatchResult {
  success: boolean;
  vehiclesDispatched: number;
  remainingRoutes: number;
  message: string;
}
