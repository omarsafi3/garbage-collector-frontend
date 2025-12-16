import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Bin } from '../models/bin';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BinService {
  private readonly apiUrl = `${environment.apiUrl}/api/bins`;

  constructor(private http: HttpClient) {}

  getAllBins(): Observable<Bin[]> {
    return this.http.get<Bin[]>(this.apiUrl);
  }

  getBinsByDepartment(departmentId: string): Observable<Bin[]> {
    return this.http.get<Bin[]>(`${this.apiUrl}/department/${departmentId}`);
  }

  createBin(bin: Partial<Bin>): Observable<Bin> {
    return this.http.post<Bin>(this.apiUrl, bin);
  }

  updateBin(id: string, bin: Partial<Bin>): Observable<Bin> {
    return this.http.put<Bin>(`${this.apiUrl}/${id}`, bin);
  }

  deleteBin(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
