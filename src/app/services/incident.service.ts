import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface IncidentLocation {
  latitude: number;
  longitude: number;
}

export interface Incident {
  id?: string;
  type: string;
  status: string;
  location: IncidentLocation;
  bin?: any;
  createdAt?: string;
  resolvedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class IncidentService {
  private BASE_URL = 'http://localhost:8080/api/incidents';

  constructor(private http: HttpClient) {}

  // Create an incident (including road block)
  createIncident(incident: Partial<Incident>): Observable<Incident> {
    return this.http.post<Incident>(this.BASE_URL, incident);
  }

  // Get all incidents
  getIncidents(): Observable<Incident[]> {
    return this.http.get<Incident[]>(this.BASE_URL);
  }

  // Get all active incidents
  getActiveIncidents(): Observable<Incident[]> {
    return this.http.get<Incident[]>(`${this.BASE_URL}/active`);
  }

  // Resolve an incident by ID
  resolveIncident(id: string): Observable<Incident> {
    return this.http.post<Incident>(`${this.BASE_URL}/${id}/resolve`, {});
  }
}
