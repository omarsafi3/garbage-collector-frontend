import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';


export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  available: boolean;
  status: 'AVAILABLE' | 'ASSIGNED' | 'IN_ROUTE';
  assignedVehicleId?: string;
  department?: any;
}

@Injectable({
  providedIn: 'root'
})
export class EmployeeService {
  private apiUrl = "http://localhost:8080/api/employees";

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
  assignEmployeesToVehicle(vehicleId: string, employeeIds: string[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/assign/${vehicleId}`, {
      employeeIds: employeeIds
    });
  }

  // Release employees from a vehicle
  releaseEmployeesFromVehicle(vehicleId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/release/${vehicleId}`, {});
  }

  // Check if vehicle has required employees
  checkRequiredEmployees(vehicleId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/check-required/${vehicleId}`);
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
