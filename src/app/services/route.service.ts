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

  constructor(private http: HttpClient) {}

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
}
