import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Bin } from '../models/bin';

export type IncidentType = 'ROAD_BLOCK' | 'OVERFILL' | 'VEHICLE_BREAKDOWN';
export type IncidentStatus = 'ACTIVE' | 'RESOLVED';

export interface Incident {
  id?: string;
  type: IncidentType;
  status: IncidentStatus;
  latitude: number;
  longitude: number;
  radiusKm: number;
  description?: string;
  createdAt?: Date;
  resolvedAt?: Date;
  bin?: Bin;
}

@Injectable({
  providedIn: 'root'
})
export class IncidentService {
  private readonly apiUrl = `${environment.apiUrl}/api/incidents`;

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
