import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services';
import { DepartmentService } from '../../services/department.service';
import { EmployeeService } from '../../services/employee.service';
import { VehicleService } from '../../services/vehicle.service';
import { BinService } from '../../services/bin-service';
import { Department } from '../../models/department';
import { Employee } from '../../models/employee';
import { Vehicle } from '../../models/vehicle';
import { Bin } from '../../models/bin';

interface NewVehicle {
  plate: string;
  reference?: string;
  status: string;
  fillLevel: number;
  available: boolean;
  department: { id: string } | null;
}

interface NewBin {
  latitude: number;
  longitude: number;
  fillLevel: number;
  status: string;
  department: { id: string } | null;
}

interface NewEmployee {
  firstName: string;
  lastName: string;
  role: 'DRIVER' | 'COLLECTOR';
  available: boolean;
  department: { id: string } | null;
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
  activeTab: 'vehicles' | 'employees' | 'bins' = 'vehicles';

  // Data
  departments: Department[] = [];
  departmentVehicles: Vehicle[] = [];
  departmentEmployees: Employee[] = [];
  departmentBins: Bin[] = [];

  // Modals
  showAddDepartmentModal = false;
  showAddVehicleModal = false;
  showAddEmployeeModal = false;
  showAddBinModal = false;

  // Form data
  newDepartment: Partial<Department> = { name: '', latitude: 0, longitude: 0 };
  newVehicle: NewVehicle = { 
    plate: '', 
    reference: '',
    status: 'AVAILABLE',
    fillLevel: 0,
    available: true,
    department: null 
  };
  newEmployee: NewEmployee = { 
    firstName: '', 
    lastName: '', 
    role: 'DRIVER',
    available: true,
    department: null 
  };
  newBin: NewBin = {
    latitude: 0,
    longitude: 0,
    fillLevel: 0,
    status: 'active',
    department: null
  };

  // Leaflet
  private L: any;
  private mainMap: any;
  private departmentMarkers: Map<string, any> = new Map();
  private binMarkers: Map<string, any> = new Map();
  private locationPickerMap: any;
  private locationMarker: any;
  private binPickerMap: any;
  private binMarker: any;

  constructor(
    public authService: AuthService,
    private departmentService: DepartmentService,
    private employeeService: EmployeeService,
    private vehicleService: VehicleService,
    private binService: BinService,
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
      const leafletModule = await import('leaflet');
      this.L = leafletModule.default || leafletModule;
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
    this.loadDepartmentBins(dept.id);
  }

  deselectDepartment(): void {
    if (this.selectedDepartment) {
      this.updateDepartmentMarkerStyle(this.selectedDepartment.id, false);
    }
    this.selectedDepartment = null;
    this.departmentVehicles = [];
    this.departmentEmployees = [];
    this.departmentBins = [];
    
    // Clear bin markers from map
    this.clearBinMarkers();

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

  loadDepartmentBins(departmentId: string): void {
    this.binService.getBinsByDepartment(departmentId).subscribe({
      next: (data) => {
        this.departmentBins = data;
        this.addBinMarkersToMap();
      },
      error: () => { 
        this.departmentBins = [];
        this.clearBinMarkers();
      }
    });
  }

  // ============= BIN MARKERS ON MAP =============
  private addBinMarkersToMap(): void {
    if (!this.mainMap || !this.L) return;

    // Clear existing bin markers
    this.clearBinMarkers();

    // Add markers for each bin
    this.departmentBins.forEach(bin => {
      if (!bin.latitude || !bin.longitude) return;

      const binIcon = this.createBinMarkerIcon(bin.fillLevel);
      const marker = this.L.marker([bin.latitude, bin.longitude], { 
        icon: binIcon 
      }).addTo(this.mainMap);

      // Popup with bin info
      marker.bindPopup(`
        <div style="text-align: center; min-width: 120px;">
          <strong>🗑️ Bin</strong><br>
          <span style="font-size: 12px; color: #6b7280;">
            Fill Level: <strong style="color: ${this.getFillColor(bin.fillLevel)}">${bin.fillLevel}%</strong>
          </span><br>
          <span style="font-size: 11px; color: #9ca3af;">
            ${bin.latitude.toFixed(4)}, ${bin.longitude.toFixed(4)}
          </span>
        </div>
      `);

      // Tooltip
      marker.bindTooltip(`🗑️ ${bin.fillLevel}%`, {
        permanent: false,
        direction: 'top',
        offset: [0, -20]
      });

      this.binMarkers.set(bin.id, marker);
    });
  }

  private clearBinMarkers(): void {
    this.binMarkers.forEach(marker => {
      this.mainMap?.removeLayer(marker);
    });
    this.binMarkers.clear();
  }

  private createBinMarkerIcon(fillLevel: number): any {
    const color = this.getFillColor(fillLevel);
    const size = fillLevel >= 80 ? 36 : 30;
    
    return this.L.divIcon({
      html: `
        <div style="filter: drop-shadow(0 2px 6px rgba(0,0,0,0.3)); transition: all 0.2s;">
          <svg width="${size}" height="${size + 8}" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C7.163 0 0 7.163 0 16c0 8.837 16 24 16 24s16-15.163 16-24C32 7.163 24.837 0 16 0z" fill="${color}"/>
            <circle cx="16" cy="14" r="9" fill="white"/>
            <text x="16" y="18" font-size="10" text-anchor="middle" fill="${color}" font-weight="bold">${fillLevel}</text>
          </svg>
        </div>
      `,
      className: '',
      iconSize: [size, size + 8],
      iconAnchor: [size/2, size + 8]
    });
  }

  private getFillColor(fillLevel: number): string {
    if (fillLevel >= 80) return '#ef4444'; // Red - critical
    if (fillLevel >= 50) return '#f59e0b'; // Orange - warning
    return '#10b981'; // Green - ok
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
        const leafletModule = await import('leaflet');
        this.L = leafletModule.default || leafletModule;
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
      status: 'AVAILABLE',
      fillLevel: 0,
      available: true,
      department: { id: this.selectedDepartment.id }
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
      status: this.newVehicle.status as Vehicle['status'],
      fillLevel: this.newVehicle.fillLevel,
      available: this.newVehicle.available,
      department: this.newVehicle.department ? { id: this.newVehicle.department.id, name: '' } : undefined
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
      department: { id: this.selectedDepartment.id }
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

    const employeeData: Partial<Employee> = {
      firstName: this.newEmployee.firstName,
      lastName: this.newEmployee.lastName,
      role: this.newEmployee.role,
      available: this.newEmployee.available,
      department: this.newEmployee.department ? { id: this.newEmployee.department.id, name: '' } : undefined
    };

    this.employeeService.createEmployee(employeeData as Employee).subscribe({
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

  // ============= ADD BIN =============
  async openAddBinModal(): Promise<void> {
    if (!this.selectedDepartment) return;
    
    this.showAddBinModal = true;
    this.newBin = {
      latitude: 0,
      longitude: 0,
      fillLevel: 0,
      status: 'active',
      department: { id: this.selectedDepartment.id }
    };

    if (isPlatformBrowser(this.platformId)) {
      setTimeout(async () => {
        await this.initBinPickerMap();
      }, 100);
    }
  }

  closeBinModal(): void {
    this.showAddBinModal = false;
    this.destroyBinPickerMap();
  }

  private async initBinPickerMap(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      if (!this.L) {
        const leafletModule = await import('leaflet');
        this.L = leafletModule.default || leafletModule;
      }
      
      const mapContainer = document.getElementById('bin-picker-map');
      if (!mapContainer) return;

      // Center on selected department location
      const centerLat = this.selectedDepartment?.latitude || 36.8065;
      const centerLng = this.selectedDepartment?.longitude || 10.1815;

      this.binPickerMap = this.L.map('bin-picker-map', {
        center: [centerLat, centerLng],
        zoom: 14,
        maxZoom: 19,
        minZoom: 6
      });

      this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.binPickerMap);

      this.binPickerMap.on('click', (e: any) => {
        this.setBinLocation(e.latlng.lat, e.latlng.lng);
      });

      setTimeout(() => {
        this.binPickerMap?.invalidateSize();
      }, 200);

    } catch {
      // Leaflet loading failed
    }
  }

  private setBinLocation(lat: number, lng: number): void {
    this.newBin.latitude = lat;
    this.newBin.longitude = lng;

    if (this.binMarker) {
      this.binPickerMap.removeLayer(this.binMarker);
    }

    const binIcon = this.createBinIcon();
    this.binMarker = this.L.marker([lat, lng], { icon: binIcon })
      .addTo(this.binPickerMap);
  }

  private createBinIcon(): any {
    return this.L.divIcon({
      html: `
        <div style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
          <svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C7.163 0 0 7.163 0 16c0 8.837 16 24 16 24s16-15.163 16-24C32 7.163 24.837 0 16 0z" fill="#10b981"/>
            <circle cx="16" cy="16" r="10" fill="white"/>
            <text x="16" y="20" font-size="12" text-anchor="middle" fill="#10b981">🗑️</text>
          </svg>
        </div>
      `,
      className: '',
      iconSize: [32, 40],
      iconAnchor: [16, 40]
    });
  }

  private destroyBinPickerMap(): void {
    if (this.binPickerMap) {
      this.binPickerMap.remove();
      this.binPickerMap = null;
      this.binMarker = null;
    }
  }

  saveBin(): void {
    if (!this.newBin.latitude || !this.newBin.longitude) {
      alert('Please click on the map to select bin location');
      return;
    }

    const binData: Partial<Bin> = {
      latitude: this.newBin.latitude,
      longitude: this.newBin.longitude,
      fillLevel: this.newBin.fillLevel,
      status: this.newBin.status as Bin['status'],
      department: this.newBin.department ? { id: this.newBin.department.id, name: '' } : undefined
    };

    this.binService.createBin(binData).subscribe({
      next: (bin) => {
        this.departmentBins.push(bin);
        this.addBinMarkersToMap(); // Refresh bin markers on map
        this.closeBinModal();
      },
      error: (err) => {
        alert('Failed to create bin: ' + (err.error?.error || err.message));
      }
    });
  }

  deleteBin(id: string): void {
    if (!confirm('Are you sure you want to delete this bin?')) return;

    this.binService.deleteBin(id).subscribe({
      next: () => {
        this.departmentBins = this.departmentBins.filter(b => b.id !== id);
        // Remove marker from map
        const marker = this.binMarkers.get(id);
        if (marker && this.mainMap) {
          this.mainMap.removeLayer(marker);
          this.binMarkers.delete(id);
        }
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

  getDriversCount(): number {
    return this.departmentEmployees.filter(e => e.role === 'DRIVER').length;
  }

  getCollectorsCount(): number {
    return this.departmentEmployees.filter(e => e.role === 'COLLECTOR').length;
  }

  getAvailableDriversCount(): number {
    return this.departmentEmployees.filter(e => e.role === 'DRIVER' && e.available).length;
  }

  getAvailableCollectorsCount(): number {
    return this.departmentEmployees.filter(e => e.role === 'COLLECTOR' && e.available).length;
  }

  canDispatchVehicle(): boolean {
    return this.getAvailableDriversCount() >= 1 && this.getAvailableCollectorsCount() >= 1;
  }

  logout(): void {
    this.authService.logout();
  }
}
