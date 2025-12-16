import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { Router } from '@angular/router';
import { LoginRequest, LoginResponse, User, Role } from '../../models/auth.model';
import { jwtDecode } from 'jwt-decode';
import { environment } from '../../../environments/environment';

interface JwtPayload {
  sub: string;        // username
  role: string;       // ADMIN or SUPER_ADMIN
  departmentId?: string;
  exp: number;        // expiration timestamp
  iat: number;        // issued at
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = `${environment.apiUrl}/api/auth`;
  private readonly TOKEN_KEY = 'auth_token';
  private isBrowser: boolean;
  
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser$: Observable<User | null>;

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    // Initialize after isBrowser is set
    this.currentUserSubject = new BehaviorSubject<User | null>(this.getUserFromToken());
    this.currentUser$ = this.currentUserSubject.asObservable();
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API_URL}/login`, credentials)
      .pipe(
        tap(response => {
          this.setToken(response.token);
          this.currentUserSubject.next(this.getUserFromToken());
        })
      );
  }

  logout(): void {
    this.removeToken();
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(this.TOKEN_KEY);
  }

  private setToken(token: string): void {
    if (!this.isBrowser) return;
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  private removeToken(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(this.TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    if (!this.isBrowser) return false;
    
    const token = this.getToken();
    if (!token) return false;
    
    try {
      const decoded = jwtDecode<JwtPayload>(token);
      const isExpired = decoded.exp * 1000 < Date.now();
      return !isExpired;
    } catch (error) {
      console.error('Invalid token:', error);
      return false;
    }
  }

  private getUserFromToken(): User | null {
    if (!this.isBrowser) return null;
    
    const token = this.getToken();
    if (!token) return null;

    try {
      const decoded = jwtDecode<JwtPayload>(token);
      return {
        id: decoded.sub,
        username: decoded.sub,
        role: decoded.role as 'SUPER_ADMIN' | 'ADMIN',
        departmentId: decoded.departmentId
      };
    } catch (error) {
      console.error('Failed to decode token:', error);
      return null;
    }
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  hasRole(role: Role): boolean {
    const user = this.getCurrentUser();
    return user?.role === role;
  }

  isSuperAdmin(): boolean {
    return this.hasRole(Role.SUPER_ADMIN);
  }

  isAdmin(): boolean {
    return this.hasRole(Role.ADMIN);
  }

  getDepartmentId(): string | null {
    return this.getCurrentUser()?.departmentId || null;
  }
}
