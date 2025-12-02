import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Employee } from '../models/employee';

export { Employee } from '../models/employee';

export interface AssignEmployeesRequest {
  employeeIds: string[];
}

export interface EmployeeCheckResponse {
  hasRequiredEmployees: boolean;
  employeeCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class EmployeeService {
  private readonly apiUrl = `${environment.apiUrl}/api/employees`;

  constructor(private http: HttpClient) { }

  // Get all employees
  getAllEmployees(): Observable<Employee[]> {
    return this.http.get<Employee[]>(this.apiUrl);
  }

  // Get available employees (not assigned or in route)
  getAvailableEmployees(): Observable<Employee[]> {
    return this.http.get<Employee[]>(`${this.apiUrl}/available`);
  }

  // Get available employees by department
  getAvailableEmployeesByDepartment(departmentId: string): Observable<Employee[]> {
    return this.http.get<Employee[]>(`${this.apiUrl}/available/department/${departmentId}`);
  }

  // Get employees assigned to a vehicle
  getEmployeesByVehicle(vehicleId: string): Observable<Employee[]> {
    return this.http.get<Employee[]>(`${this.apiUrl}/vehicle/${vehicleId}`);
  }

  // Assign 2 employees to a vehicle
  assignEmployeesToVehicle(vehicleId: string, employeeIds: string[]): Observable<Employee[]> {
    const request: AssignEmployeesRequest = { employeeIds };
    return this.http.post<Employee[]>(`${this.apiUrl}/assign/${vehicleId}`, request);
  }

  // Release employees from a vehicle
  releaseEmployeesFromVehicle(vehicleId: string): Observable<Employee[]> {
    return this.http.post<Employee[]>(`${this.apiUrl}/release/${vehicleId}`, {});
  }

  // Check if vehicle has required employees
  checkRequiredEmployees(vehicleId: string): Observable<EmployeeCheckResponse> {
    return this.http.get<EmployeeCheckResponse>(`${this.apiUrl}/check-required/${vehicleId}`);
  }

  // Get employee by ID
  getEmployeeById(id: string): Observable<Employee> {
    return this.http.get<Employee>(`${this.apiUrl}/${id}`);
  }

  // Create new employee
  createEmployee(employee: Employee): Observable<Employee> {
    return this.http.post<Employee>(this.apiUrl, employee);
  }

  // Update employee
  updateEmployee(id: string, employee: Employee): Observable<Employee> {
    return this.http.put<Employee>(`${this.apiUrl}/${id}`, employee);
  }

  // Delete employee
  deleteEmployee(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
