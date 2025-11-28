import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Incident {
  id?: string;
  type: string; // "ROAD_BLOCK", "OVERFILL", "VEHICLE_BREAKDOWN"
  status: string; // "ACTIVE", "RESOLVED"
  latitude: number;
  longitude: number;
  radiusKm: number;
  description?: string;
  createdAt?: Date;
  resolvedAt?: Date;
  bin?: any;
}

@Injectable({
  providedIn: 'root'
})
export class IncidentService {
  private apiUrl = 'http://localhost:8080/api/incidents';

  constructor(private http: HttpClient) {}

  /**
   * Get all incidents
   */
  getAllIncidents(): Observable<Incident[]> {
    return this.http.get<Incident[]>(this.apiUrl);
  }

  /**
   * Get active incidents only
   */
  getActiveIncidents(): Observable<Incident[]> {
    return this.http.get<Incident[]>(`${this.apiUrl}/active`);
  }

  /**
   * Report a road block incident
   */
  reportRoadBlock(
    latitude: number, 
    longitude: number, 
    radiusKm: number, 
    description: string
  ): Observable<Incident> {
    return this.http.post<Incident>(`${this.apiUrl}/road-block`, {
      latitude,
      longitude,
      radiusKm,
      description
    });
  }

  /**
   * Resolve an incident
   */
  resolveIncident(incidentId: string): Observable<Incident> {
    return this.http.post<Incident>(`${this.apiUrl}/${incidentId}/resolve`, {});
  }

  /**
   * Create a generic incident
   */
  createIncident(incident: Incident): Observable<Incident> {
    return this.http.post<Incident>(this.apiUrl, incident);
  }
}
