import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Bin } from '../models/bin';

@Injectable({
  providedIn: 'root'
})
export class BinService {
  private apiUrl = 'http://localhost:8080/bins'; // backend endpoint

  constructor(private http: HttpClient) {}

  getAllBins(): Observable<Bin[]> {
    return this.http.get<Bin[]>(this.apiUrl);
  }
  addBin(bin: Partial<Bin>): Observable<Bin> {
  return this.http.post<Bin>(this.apiUrl, bin);
}

}
