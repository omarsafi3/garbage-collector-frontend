import { Component, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';

import { CommonModule } from '@angular/common';
import { DashboardService, DepartmentStats, VehicleInfo } from '../services/dashboard.service';
import { MapComponent } from '../map/map.component'; // ✅ ADD THIS
import { DepartmentService } from '../services/department.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MapComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  encapsulation: ViewEncapsulation.None  // ✅ ADD THIS LINE
})

export class DashboardComponent implements OnInit, OnDestroy {
  departments: DepartmentStats[] = [];
  selectedDeptVehicles: VehicleInfo[] = [];
  loading = true;
  selectedDepartment: DepartmentStats | null = null;
  departmentRoutes: any[] = [];
  loadingRoutes = false;
  vehicleProgress: Map<string, { currentStop: number; totalStops: number; binId: string }> = new Map();
  activeTrucks: Map<string, any> = new Map();
  departmentStats: any = null;
  department: any = null;  // ✅ ADD THIS TOO
  employees: any[] = [];  // ✅ ADD THIS
  private activeRoutes: Set<string> = new Set();
  private refreshInterval?: any;

  private readonly CURRENT_DEPARTMENT_ID = '6920266d0b737026e2496c54'; // Omar
  constructor(private dashboardService: DashboardService,
    private departmentService: DepartmentService
  ) { }

  ngOnInit() {
    console.log('🚀 Dashboard loading...');
    this.loadCurrentDepartment();

    // Listen for route completion
    window.addEventListener('vehicle-route-completed', (e: any) => {
      const { vehicleId, binsCollected } = e.detail;
      this.onRouteCompleted(vehicleId, binsCollected);
    });
    window.addEventListener('vehicle-route-completed', (e: any) => {
      const { vehicleId, binsCollected } = e.detail;
      this.onRouteCompleted(vehicleId, binsCollected);
    });

    // Listen for vehicle progress updates
    window.addEventListener('vehicle-at-bin', (e: any) => {
      const { vehicleId, binId, currentStop, totalStops } = e.detail;
      this.updateVehicleProgress(vehicleId, currentStop, totalStops, binId);
    });


    // ✅ ADD THIS: Track active routes
    window.addEventListener('vehicle-started', (e: any) => {
      const { vehicleId } = e.detail;
      this.activeTrucks.set(vehicleId, { vehicleId, progress: 0 });
    });

    // Refresh vehicles every 10 seconds if routes active
    this.refreshInterval = setInterval(() => {
      if (this.activeRoutes.size > 0 && this.selectedDepartment) {
        console.log('🔄 Refreshing vehicles (routes active)');
        this.loadVehicles(this.selectedDepartment.departmentId);
      }
    }, 10000);

    // ✅ ADD THIS: Listen for vehicle progress updates
    window.addEventListener('vehicle-at-bin', (e: any) => {
      const { vehicleId, binId, currentStop, totalStops } = e.detail;
      this.updateVehicleProgress(vehicleId, currentStop, totalStops, binId);
    });


    // Refresh vehicles every 10 seconds if routes active
    this.refreshInterval = setInterval(() => {
      if (this.activeRoutes.size > 0 && this.selectedDepartment) {
        console.log('🔄 Refreshing vehicles (routes active)');
        this.loadVehicles(this.selectedDepartment.departmentId);
      }
    }, 10000);
  }
  ngOnDestroy() {
    // ✅ Clean up interval
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
  loadDepartmentEmployees() {
    this.departmentService.getDepartmentEmployees(this.CURRENT_DEPARTMENT_ID).subscribe({
      next: (employees) => {
        console.log('👷 Employees loaded:', employees.length);
        this.employees = employees;
      },
      error: (err) => console.log('ℹ️ No employees')
    });
  }
  loadDepartmentVehicles() {
    this.dashboardService.getDepartmentVehicles(this.CURRENT_DEPARTMENT_ID).subscribe({
      next: (vehicles) => {
        console.log('🚛 Vehicles loaded:', vehicles.length);
        this.selectedDeptVehicles = vehicles;  // Store in selectedDeptVehicles
      },
      error: (err) => console.log('ℹ️ No vehicles')
    });
  }


  loadCurrentDepartment() {
    this.loading = true;

    this.departmentService.getDepartmentById(this.CURRENT_DEPARTMENT_ID).subscribe({
      next: (dept: any) => {
        console.log('✅ Department loaded:', dept.name);
        this.department = dept;
        this.departmentStats = dept;
        this.loading = false;

        // Load department resources
        this.loadDepartmentVehicles();
        this.loadDepartmentEmployees();
      },
      error: (err: any) => {
        console.error('❌ Failed to load department:', err);
        this.loading = false;
      }
    });
  }


  getFillGradient(fillLevel: number): string {
    if (fillLevel < 30) {
      return 'linear-gradient(90deg, #10b981 0%, #34d399 100%)';
    } else if (fillLevel < 60) {
      return 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)';
    } else {
      return 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)';
    }
  }

  // ✅ NEW: Track active route
  trackActiveRoute(vehicleId: string) {
    this.activeRoutes.add(vehicleId);
    console.log(`📍 Tracking ${this.activeRoutes.size} active routes`);
  }
  // ✅ ADD THIS: Update vehicle progress
  updateVehicleProgress(vehicleId: string, currentStop: number, totalStops: number, binId: string) {
    this.vehicleProgress.set(vehicleId, { currentStop, totalStops, binId });
    console.log(`📊 Vehicle ${vehicleId}: Stop ${currentStop}/${totalStops} at bin ${binId}`);
  }

  // ✅ ADD THIS: Get progress for vehicle
  getVehicleProgress(vehicleId: string): string {
    const progress = this.vehicleProgress.get(vehicleId);
    if (progress) {
      return `🚛 Stop ${progress.currentStop}/${progress.totalStops}`;
    }
    return '';
  }


  // ✅ NEW: Handle route completion
  onRouteCompleted(vehicleId: string, binsCollected: number) {
    this.activeRoutes.delete(vehicleId);
    this.vehicleProgress.delete(vehicleId); // ✅ ADD THIS LINE
    console.log(`✅ Route completed! ${this.activeRoutes.size} routes remaining`);

    const vehicle = this.selectedDeptVehicles.find(v => v.id === vehicleId);
    const vehicleName = vehicle?.reference || 'Vehicle';

    alert(`✅ ${vehicleName} completed route!\nCollected ${binsCollected} bins`);

    if (this.selectedDepartment) {
      this.loadVehicles(this.selectedDepartment.departmentId);
    }
  }


  loadDepartments() {
    console.log('📡 Fetching departments...');
    this.loading = true;

    this.dashboardService.getDepartments().subscribe({
      next: (data) => {
        console.log('✅ DEPARTMENTS LOADED:', data);
        this.departments = data;
        this.loading = false;
        if (data.length > 0 && !this.selectedDepartment) {
          this.selectDepartment(data[0]);
        }
      },
      error: (err) => {
        console.error('❌ LOAD ERROR:', err);
        this.loading = false;
        this.departments = [];
      }
    });
  }

  selectDepartment(dept: DepartmentStats) {
    this.selectedDepartment = dept;
    console.log('🏢 Selected:', dept.departmentName);
    this.loadVehicles(dept.departmentId);
  }

  loadVehicles(deptId: string) {
    this.dashboardService.getDepartmentVehicles(deptId).subscribe(vehicles => {
      console.log('🚛 Vehicles:', vehicles);
      this.selectedDeptVehicles = vehicles;
    });
  }

  showDepartmentRoutes() {
    if (!this.selectedDepartment) return;

    this.loadingRoutes = true;
    console.log('🗺️ Loading routes for:', this.selectedDepartment.departmentName);

    this.dashboardService.getDepartmentRoutes(this.selectedDepartment.departmentId)
      .subscribe({
        next: (routes) => {
          this.departmentRoutes = routes;
          console.log('✅ Routes loaded:', routes);
          this.loadingRoutes = false;

          window.dispatchEvent(new CustomEvent('show-department-routes', {
            detail: { departmentId: this.selectedDepartment!.departmentId }
          }));
        },
        error: (err) => {
          console.error('❌ Route load failed:', err);
          this.loadingRoutes = false;
          alert('Failed to load routes');
        }
      });
  }

  showVehicleRoute(vehicleId: string) {
    if (!this.selectedDepartment) return;

    console.log('🚛 Single vehicle route:', vehicleId);

    window.dispatchEvent(new CustomEvent('show-vehicle-route', {
      detail: {
        departmentId: this.selectedDepartment.departmentId,
        vehicleId: vehicleId
      }
    }));
  }

  executeAllRoutes() {
    if (!this.selectedDepartment) return;

    if (!confirm(`🚀 Execute ALL routes for ${this.selectedDepartment.departmentName}?`)) {
      return;
    }

    console.log('🚀 Step 1: Loading routes before execution...');

    this.dashboardService.getDepartmentRoutes(this.selectedDepartment.departmentId)
      .subscribe({
        next: (routes) => {
          console.log('✅ Step 2: Routes loaded:', routes);
          this.departmentRoutes = routes;

          window.dispatchEvent(new CustomEvent('show-department-routes', {
            detail: { departmentId: this.selectedDepartment!.departmentId }
          }));

          console.log('🚀 Step 3: Executing routes for animation...');
          routes.forEach((route: any, index: number) => {
            // ✅ NEW: Track each vehicle
            this.trackActiveRoute(route.vehicleId);

            setTimeout(() => {
              console.log(`🚛 Executing vehicle ${route.vehicleId}...`);

              window.dispatchEvent(new CustomEvent('execute-vehicle-route', {
                detail: { vehicleId: route.vehicleId }
              }));
            }, index * 1000);
          });

          alert(`✅ Executing ${routes.length} routes! Watch the map!`);
        },
        error: (err) => {
          console.error('❌ Failed to load routes:', err);
          alert('❌ Failed to execute routes');
        }
      });
  }

  dispatchVehicle(vehicle: VehicleInfo) {
    if (!confirm(`Dispatch ${vehicle.reference}?\nPlate: ${vehicle.plate}`)) {
      return;
    }

    if (!this.selectedDepartment) return;

    console.log('🚀 Dispatching single vehicle:', vehicle.id);

    this.dashboardService.getVehicleRoute(
      this.selectedDepartment.departmentId,
      vehicle.id
    ).subscribe({
      next: (route) => {
        console.log(`✅ Loaded route for ${vehicle.id}:`, route);

        // ✅ NEW: Track this vehicle
        this.trackActiveRoute(vehicle.id);

        window.dispatchEvent(new CustomEvent('execute-single-vehicle-route', {
          detail: {
            vehicleId: vehicle.id,
            route: route
          }
        }));
      },
      error: (err) => {
        console.error('❌ Failed to load vehicle route:', err);
        alert('Failed to load route for this vehicle');
      }
    });
  }

  get totalCriticalBins(): number {
    return this.departments.reduce((sum, d) => sum + (d.criticalBins || 0), 0);
  }

  get totalActiveTrucks(): number {
    return this.departments.reduce((sum, d) => sum + (d.activeVehicles || 0), 0);
  }

  dispatchAllAvailable() {
    const available = this.selectedDeptVehicles.filter(v => v.available);
    if (available.length === 0) {
      alert('No available vehicles!');
      return;
    }
    if (confirm(`Dispatch ${available.length} vehicles?`)) {
      available.forEach(v => this.dispatchVehicle(v));
    }
  }

  getFillColor(fillLevel: number): string {
    if (fillLevel < 50) return '#10b981';
    if (fillLevel < 80) return '#f59e0b';
    return '#ef4444';
  }

  // ✅ NEW: Clear routes button
  clearRoutes() {
    window.dispatchEvent(new CustomEvent('clear-routes'));
    this.departmentRoutes = [];
    console.log('🧹 Routes cleared');
  }
}
