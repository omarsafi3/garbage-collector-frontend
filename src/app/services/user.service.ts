import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LoginRequest } from '../models/loginRequest';
import { LoginResponse } from '../models/loginResponse';
import { User } from '../models/user';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private BASE_URL = `${environment.apiUrl}/auth`;

  constructor(private http: HttpClient) {}

  // LOGIN
  login(data: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.BASE_URL}/login`, data);
  }

  // SAVE TOKEN + USER
  saveLogin(result: LoginResponse): void {
    localStorage.setItem('token', result.token);
    localStorage.setItem('user', JSON.stringify(result.user));
  }

  // GET TOKEN
  getToken(): string | null {
    return localStorage.getItem('token');
  }

  // GET USER
  getUser(): User | null {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  }

  // GET ROLE
  getRole(): 'SUPER_ADMIN' | 'ADMIN' | null {
    const user = this.getUser();
    return user ? user.role : null;
  }

  // LOGOUT
  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  isLoggedIn(): boolean {
    return this.getToken() !== null;
  }
}
