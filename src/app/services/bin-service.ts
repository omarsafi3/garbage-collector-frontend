import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Bin } from '../models/bin';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BinService {
  private readonly apiUrl = `${environment.apiUrl}/bins`;

  constructor(private http: HttpClient) {}

  getAllBins(): Observable<Bin[]> {
    return this.http.get<Bin[]>(this.apiUrl);
  }
  createBin(bin: Partial<Bin>): Observable<Bin> {
  return this.http.post<Bin>(this.apiUrl, bin);
}



}
