import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private apiUrl = 'http://localhost:8080/api/analytics';

  constructor(private http: HttpClient) {}

  getDepartmentSummary(departmentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/department/${departmentId}/summary`);
  }

  getRecentRoutes(departmentId: string, limit: number = 5): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/department/${departmentId}/recent?limit=${limit}`);
  }
}
