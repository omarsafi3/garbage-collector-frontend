import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { DepartmentService } from '../../services/department.service';
import { EmployeeService } from '../../services/employee.service';
import { VehicleService } from '../../services/vehicle.service';
import { Department } from '../../models/department';
import { Employee } from '../../models/employee';
import { Vehicle } from '../../models/vehicle';

interface NewVehicle {
  plate: string;
  reference?: string;
  type: string;
  capacity: number;
  status: string;
  departmentId: string;
}

interface NewEmployee {
  firstName: string;
  lastName: string;
  role: string;
  available: boolean;
  departmentId: string;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit, OnDestroy {
  // View state
  selectedDepartment: Department | null = null;
  activeTab: 'vehicles' | 'employees' = 'vehicles';

  // Data
  departments: Department[] = [];
  departmentVehicles: Vehicle[] = [];
  departmentEmployees: Employee[] = [];

  // Modals
  showAddDepartmentModal = false;
  showAddVehicleModal = false;
  showAddEmployeeModal = false;

  // Form data
  newDepartment: Partial<Department> = { name: '', latitude: 0, longitude: 0 };
  newVehicle: NewVehicle = { 
    plate: '', 
    reference: '',
    type: 'TRUCK', 
    capacity: 1000, 
    status: 'AVAILABLE',
    departmentId: '' 
  };
  newEmployee: NewEmployee = { 
    firstName: '', 
    lastName: '', 
    role: 'DRIVER',
    available: true,
    departmentId: '' 
  };

  // Leaflet
  private L: any;
  private mainMap: any;
  private departmentMarkers: Map<string, any> = new Map();
  private locationPickerMap: any;
  private locationMarker: any;

  constructor(
    public authService: AuthService,
    private departmentService: DepartmentService,
    private employeeService: EmployeeService,
    private vehicleService: VehicleService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.loadDepartments();
    
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        this.initMainMap();
      }, 100);
    }
  }

  ngOnDestroy(): void {
    this.destroyLocationPickerMap();
    if (this.mainMap) {
      this.mainMap.remove();
    }
  }

  // ============= MAIN MAP =============
  private async initMainMap(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      this.L = await import('leaflet');
      
      const mapContainer = document.getElementById('admin-main-map');
      if (!mapContainer) return;

      // Tunisia bounds
      const tunisiaBounds = this.L.latLngBounds(
        this.L.latLng(30.0, 7.5), 
        this.L.latLng(37.5, 12.0)
      );

      this.mainMap = this.L.map('admin-main-map', {
        center: [34.0, 9.0],
        zoom: 7,
        maxBounds: tunisiaBounds,
        maxBoundsViscosity: 1.0,
        minZoom: 6,
        maxZoom: 18
      });

      this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.mainMap);

      // Add department markers after map is ready
      setTimeout(() => {
        this.addDepartmentMarkersToMap();
        this.mainMap?.invalidateSize();
      }, 300);

    } catch {
      // Leaflet loading failed
    }
  }

  private addDepartmentMarkersToMap(): void {
    if (!this.mainMap || !this.L) return;

    // Clear existing markers
    this.departmentMarkers.forEach(marker => {
      this.mainMap.removeLayer(marker);
    });
    this.departmentMarkers.clear();

    // Add markers for each department
    this.departments.forEach(dept => {
      if (!dept.latitude || !dept.longitude) return;

      const isSelected = this.selectedDepartment?.id === dept.id;
      const deptIcon = this.createDepartmentIcon(isSelected);

      const marker = this.L.marker([dept.latitude, dept.longitude], { 
        icon: deptIcon 
      }).addTo(this.mainMap);

      // Click to select department
      marker.on('click', () => {
        this.selectDepartment(dept);
      });

      // Tooltip with department name
      marker.bindTooltip(dept.name, {
        permanent: false,
        direction: 'top',
        offset: [0, -50]
      });

      this.departmentMarkers.set(dept.id, marker);
    });

    // Fit map to show all departments
    if (this.departments.length > 0) {
      const bounds = this.departments
        .filter(d => d.latitude && d.longitude)
        .map(d => [d.latitude, d.longitude]);
      
      if (bounds.length > 0) {
        this.mainMap.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }

  private createDepartmentIcon(isSelected: boolean): any {
    const color = isSelected ? '#10b981' : '#2563eb';
    const strokeColor = isSelected ? '#059669' : '#1e40af';
    const glowColor = isSelected ? 'rgba(16, 185, 129, 0.6)' : 'rgba(37, 99, 235, 0.4)';
    
    return this.L.divIcon({
      html: `
        <div style="filter: drop-shadow(0 0 ${isSelected ? '15px' : '8px'} ${glowColor}); transform: scale(${isSelected ? 1.2 : 1}); transition: all 0.3s;">
          <svg width="50" height="60" viewBox="0 0 50 60" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="25" cy="57" rx="10" ry="3" fill="rgba(0,0,0,0.3)"/>
            <rect x="10" y="20" width="30" height="35" rx="2" fill="${color}" stroke="${strokeColor}" stroke-width="2"/>
            <rect x="13" y="23" width="5" height="5" rx="1" fill="#dbeafe"/>
            <rect x="22.5" y="23" width="5" height="5" rx="1" fill="#dbeafe"/>
            <rect x="32" y="23" width="5" height="5" rx="1" fill="#dbeafe"/>
            <rect x="13" y="31" width="5" height="5" rx="1" fill="#dbeafe"/>
            <rect x="22.5" y="31" width="5" height="5" rx="1" fill="#dbeafe"/>
            <rect x="32" y="31" width="5" height="5" rx="1" fill="#dbeafe"/>
            <rect x="13" y="39" width="5" height="5" rx="1" fill="#dbeafe"/>
            <rect x="22.5" y="39" width="5" height="5" rx="1" fill="#dbeafe"/>
            <rect x="32" y="39" width="5" height="5" rx="1" fill="#dbeafe"/>
            <rect x="20" y="47" width="10" height="8" rx="1" fill="${strokeColor}"/>
            <path d="M 8 20 L 25 8 L 42 20 Z" fill="${strokeColor}" stroke="${strokeColor}" stroke-width="1.5"/>
            ${isSelected ? '<circle cx="40" cy="12" r="8" fill="white" stroke="#10b981" stroke-width="2"/><text x="40" y="16" font-size="10" text-anchor="middle" fill="#10b981" font-weight="bold">✓</text>' : ''}
          </svg>
        </div>
      `,
      className: '',
      iconSize: [50, 60],
      iconAnchor: [25, 60]
    });
  }

  private updateDepartmentMarkerStyle(deptId: string, isSelected: boolean): void {
    const marker = this.departmentMarkers.get(deptId);
    if (marker && this.L) {
      marker.setIcon(this.createDepartmentIcon(isSelected));
    }
  }

  // ============= DEPARTMENT SELECTION =============
  selectDepartment(dept: Department): void {
    // Update marker styles
    if (this.selectedDepartment) {
      this.updateDepartmentMarkerStyle(this.selectedDepartment.id, false);
    }
    
    this.selectedDepartment = dept;
    this.updateDepartmentMarkerStyle(dept.id, true);
    
    // Center map on selected department
    if (this.mainMap && dept.latitude && dept.longitude) {
      this.mainMap.setView([dept.latitude, dept.longitude], 14, {
        animate: true,
        duration: 0.5
      });
    }

    // Load department data
    this.loadDepartmentVehicles(dept.id);
    this.loadDepartmentEmployees(dept.id);
  }

  deselectDepartment(): void {
    if (this.selectedDepartment) {
      this.updateDepartmentMarkerStyle(this.selectedDepartment.id, false);
    }
    this.selectedDepartment = null;
    this.departmentVehicles = [];
    this.departmentEmployees = [];

    // Reset map view
    if (this.mainMap && this.departments.length > 0) {
      const bounds = this.departments
        .filter(d => d.latitude && d.longitude)
        .map(d => [d.latitude, d.longitude]);
      
      if (bounds.length > 0) {
        this.mainMap.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }

  // ============= LOAD DATA =============
  loadDepartments(): void {
    this.departmentService.getAllDepartments().subscribe({
      next: (data) => {
        this.departments = data;
        // Refresh map markers if map is ready
        if (this.mainMap) {
          this.addDepartmentMarkersToMap();
        }
      },
      error: () => { /* Handle silently */ }
    });
  }

  loadDepartmentVehicles(departmentId: string): void {
    this.departmentService.getDepartmentVehicles(departmentId).subscribe({
      next: (data) => {
        this.departmentVehicles = data;
      },
      error: () => { 
        this.departmentVehicles = [];
      }
    });
  }

  loadDepartmentEmployees(departmentId: string): void {
    this.departmentService.getDepartmentEmployees(departmentId).subscribe({
      next: (data) => {
        this.departmentEmployees = data;
      },
      error: () => { 
        this.departmentEmployees = [];
      }
    });
  }

  // ============= ADD DEPARTMENT =============
  async openAddDepartmentModal(): Promise<void> {
    this.showAddDepartmentModal = true;
    this.newDepartment = { name: '', latitude: 0, longitude: 0 };

    if (isPlatformBrowser(this.platformId)) {
      setTimeout(async () => {
        await this.initLocationPickerMap();
      }, 100);
    }
  }

  closeDepartmentModal(): void {
    this.showAddDepartmentModal = false;
    this.destroyLocationPickerMap();
  }

  private async initLocationPickerMap(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      if (!this.L) {
        this.L = await import('leaflet');
      }
      
      const mapContainer = document.getElementById('location-picker-map');
      if (!mapContainer) return;

      const defaultLat = 36.8065;
      const defaultLng = 10.1815;

      this.locationPickerMap = this.L.map('location-picker-map', {
        center: [defaultLat, defaultLng],
        zoom: 12,
        maxZoom: 18,
        minZoom: 6
      });

      this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.locationPickerMap);

      this.locationPickerMap.on('click', (e: any) => {
        this.setDepartmentLocation(e.latlng.lat, e.latlng.lng);
      });

      setTimeout(() => {
        this.locationPickerMap?.invalidateSize();
      }, 200);

    } catch {
      // Leaflet loading failed
    }
  }

  private setDepartmentLocation(lat: number, lng: number): void {
    this.newDepartment.latitude = lat;
    this.newDepartment.longitude = lng;

    if (this.locationMarker) {
      this.locationPickerMap.removeLayer(this.locationMarker);
    }

    const deptIcon = this.createDepartmentIcon(true);
    this.locationMarker = this.L.marker([lat, lng], { icon: deptIcon })
      .addTo(this.locationPickerMap);

    this.locationPickerMap.setView([lat, lng], 15);
  }

  private destroyLocationPickerMap(): void {
    if (this.locationPickerMap) {
      this.locationPickerMap.remove();
      this.locationPickerMap = null;
      this.locationMarker = null;
    }
  }

  saveDepartment(): void {
    if (!this.newDepartment.name?.trim()) {
      alert('Please enter a department name');
      return;
    }
    
    if (!this.newDepartment.latitude || !this.newDepartment.longitude) {
      alert('Please click on the map to select a location');
      return;
    }

    this.departmentService.createDepartment(this.newDepartment).subscribe({
      next: (dept) => {
        this.departments.push(dept);
        this.addDepartmentMarkersToMap();
        this.closeDepartmentModal();
      },
      error: (err) => {
        alert('Failed to create department: ' + (err.error?.error || err.message));
      }
    });
  }

  deleteDepartment(id: string): void {
    if (!confirm('Are you sure you want to delete this department? This will also delete all related vehicles and employees.')) return;

    this.departmentService.deleteDepartment(id).subscribe({
      next: () => {
        this.departments = this.departments.filter(d => d.id !== id);
        if (this.selectedDepartment?.id === id) {
          this.deselectDepartment();
        }
        this.addDepartmentMarkersToMap();
      },
      error: (err) => {
        alert('Failed to delete: ' + (err.error?.error || err.message));
      }
    });
  }

  // ============= ADD VEHICLE =============
  openAddVehicleModal(): void {
    if (!this.selectedDepartment) return;
    
    this.showAddVehicleModal = true;
    this.newVehicle = { 
      plate: '', 
      reference: '',
      type: 'TRUCK', 
      capacity: 1000,
      status: 'AVAILABLE',
      departmentId: this.selectedDepartment.id
    };
  }

  closeVehicleModal(): void {
    this.showAddVehicleModal = false;
  }

  saveVehicle(): void {
    if (!this.newVehicle.plate?.trim()) {
      alert('Please enter a plate number');
      return;
    }

    if (!this.newVehicle.reference) {
      this.newVehicle.reference = `TRUCK-${this.departmentVehicles.length + 1}`;
    }

    const vehicleData: Partial<Vehicle> = {
      plate: this.newVehicle.plate,
      reference: this.newVehicle.reference,
      type: this.newVehicle.type as Vehicle['type'],
      capacity: this.newVehicle.capacity,
      status: this.newVehicle.status as Vehicle['status'],
      departmentId: this.newVehicle.departmentId
    };

    this.vehicleService.createVehicle(vehicleData as Vehicle).subscribe({
      next: (vehicle) => {
        this.departmentVehicles.push(vehicle);
        this.closeVehicleModal();
      },
      error: (err) => {
        alert('Failed to create vehicle: ' + (err.error?.error || err.message));
      }
    });
  }

  deleteVehicle(id: string): void {
    if (!confirm('Are you sure you want to delete this vehicle?')) return;

    this.vehicleService.deleteVehicle(id).subscribe({
      next: () => {
        this.departmentVehicles = this.departmentVehicles.filter(v => v.id !== id);
      },
      error: (err) => {
        alert('Failed to delete: ' + (err.error?.error || err.message));
      }
    });
  }

  // ============= ADD EMPLOYEE =============
  openAddEmployeeModal(): void {
    if (!this.selectedDepartment) return;
    
    this.showAddEmployeeModal = true;
    this.newEmployee = { 
      firstName: '', 
      lastName: '', 
      role: 'DRIVER',
      available: true,
      departmentId: this.selectedDepartment.id
    };
  }

  closeEmployeeModal(): void {
    this.showAddEmployeeModal = false;
  }

  saveEmployee(): void {
    if (!this.newEmployee.firstName?.trim() || !this.newEmployee.lastName?.trim()) {
      alert('Please enter first and last name');
      return;
    }

    this.employeeService.createEmployee(this.newEmployee as unknown as Employee).subscribe({
      next: (emp) => {
        this.departmentEmployees.push(emp);
        this.closeEmployeeModal();
      },
      error: (err) => {
        alert('Failed to create employee: ' + (err.error?.error || err.message));
      }
    });
  }

  deleteEmployee(id: string): void {
    if (!confirm('Are you sure you want to delete this employee?')) return;

    this.employeeService.deleteEmployee(id).subscribe({
      next: () => {
        this.departmentEmployees = this.departmentEmployees.filter(e => e.id !== id);
      },
      error: (err) => {
        alert('Failed to delete: ' + (err.error?.error || err.message));
      }
    });
  }

  // ============= HELPERS =============
  getAvailableEmployeesCount(): number {
    return this.departmentEmployees.filter(e => e.available).length;
  }

  getAvailableVehiclesCount(): number {
    return this.departmentVehicles.filter(v => v.available).length;
  }

  logout(): void {
    this.authService.logout();
  }
}
