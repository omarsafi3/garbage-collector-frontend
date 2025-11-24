import { Component, OnInit, OnDestroy, ViewEncapsulation, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { DashboardService, DepartmentStats, VehicleInfo } from '../services/dashboard.service';
import { MapComponent } from '../map/map.component';
import { DepartmentService } from '../services/department.service';
import { WebSocketService } from '../services/web-socket-service';
import { RouteProgressUpdate } from '../models/websocket-dtos';
import { ChangeDetectorRef } from '@angular/core';
import { AnalyticsService } from '../services/analytics.service';
import { RouteService } from '../services/route.service';
import { FormsModule } from '@angular/forms'; // ✅ CRITICAL: Must import FormsModule

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MapComponent, FormsModule], // ✅ CRITICAL: Add FormsModule here
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class DashboardComponent implements OnInit, OnDestroy {
  departments: DepartmentStats[] = [];
  selectedDeptVehicles: VehicleInfo[] = [];
  loading = true;
  selectedDepartment: DepartmentStats | null = null;
  departmentRoutes: any[] = [];
  loadingRoutes = false;
  vehicleProgress: Map<string, { currentStop: number; totalStops: number; binId: string; fillLevel: number }> = new Map();
  activeTrucks: Map<string, any> = new Map();
  departmentStats: any = null;
  department: any = null;
  employees: any[] = [];
  private activeRoutes: Set<string> = new Set();
  private refreshInterval?: any;
  
  // Analytics
  analyticsData: any = null;
  recentRoutes: any[] = [];
  loadingAnalytics = false;

  // ✅ NEW: Available routes property
  availableRoutes: any[] = [];

  private routeProgressSub?: Subscription;
  private routeCompletionSub?: Subscription;
  private vehicleUpdateSub?: Subscription;
  unloadingVehicles: Set<string> = new Set();

  private readonly CURRENT_DEPARTMENT_ID = '6920266d0b737026e2496c54';

  constructor(
    private dashboardService: DashboardService,
    private departmentService: DepartmentService,
    private webSocketService: WebSocketService,
    private cdr: ChangeDetectorRef,
    private routeService: RouteService,
    private analyticsService: AnalyticsService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit() {
    console.log('🚀 Dashboard loading...');
    this.loadCurrentDepartment();
    this.setupWebSocketListeners();

    // ✅ Load available routes
    this.loadAvailableRoutes();

    // Auto-fetch routes on load
    setTimeout(() => {
      console.log('📍 Auto-fetching pre-generated routes...');
      this.showAllRoutes();
    }, 1000);

    window.addEventListener('vehicle-route-completed', (e: any) => {
      const { vehicleId, binsCollected } = e.detail;
      this.onRouteCompleted(vehicleId, binsCollected);
    });

    window.addEventListener('vehicle-at-bin', (e: any) => {
      const { vehicleId, binId, currentStop, totalStops, fillLevel } = e.detail;
      this.updateVehicleProgress(vehicleId, currentStop, totalStops, binId, fillLevel || 0);
    });

    window.addEventListener('vehicle-started', (e: any) => {
      const { vehicleId } = e.detail;
      this.activeTrucks.set(vehicleId, { vehicleId, progress: 0 });
    });

    this.refreshInterval = setInterval(() => {
      if (this.activeRoutes.size > 0 && this.selectedDepartment) {
        console.log('🔄 Refreshing vehicles (routes active)');
        this.loadVehicles(this.selectedDepartment.departmentId);
      }
    }, 5000);
  }

  // ✅ NEW: Load available routes
  loadAvailableRoutes() {
    this.routeService.getAvailableRoutes(this.CURRENT_DEPARTMENT_ID).subscribe({
      next: (routes: any[]) => {
        this.availableRoutes = routes;
        console.log('✅ Available routes loaded:', routes.length);
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('❌ Failed to load routes:', err);
      }
    });
  }

  // ✅ Get only available vehicles (not in route)
  getAvailableVehiclesOnly(): VehicleInfo[] {
    return this.selectedDeptVehicles.filter(v => 
      v.available && !this.activeTrucks.has(v.id)
    );
  }
  getRouteColorEmoji(index: number): string {
  const emojis = ['🔵', '🔴', '🟢', '🟠', '🟣', '🌸'];
  return emojis[index % emojis.length];
}

  getRouteColor(index: number): string {
  const colors = ['#2563eb', '#ef4444', '#16a34a', '#f97316', '#8b5cf6', '#ec4899'];
  return colors[index % colors.length];
}

  // ✅ NEW: Dispatch vehicle with specific route (CRITICAL - this was missing)
  dispatchVehicleWithRoute(vehicleId: string, routeId: string | undefined) {
  if (!routeId) {
    alert('⚠️ Please select a route first!');
    return;
  }

  console.log(`🚀 Dispatching vehicle ${vehicleId} with route ${routeId}`);

  // Assign route to vehicle
  this.routeService.assignRouteToVehicle(routeId, vehicleId, this.CURRENT_DEPARTMENT_ID).subscribe({
    next: (result: any) => {
      console.log(`✅ Route assigned and started:`, result);

      // ✅ CRITICAL FIX: Store with VEHICLE ID, not route ID!
      this.activeTrucks.set(vehicleId, {  // ✅ Use vehicleId here, not routeId!
        vehicleId: vehicleId,
        progress: 0,
        routeId: routeId
      });

      // ✅ ALSO: Notify map component to track this vehicle
      window.dispatchEvent(new CustomEvent('vehicle-started', {
        detail: { vehicleId: vehicleId }  // ✅ Send vehicle ID, not route ID
      }));

      // Remove route from available list
      this.availableRoutes = this.availableRoutes.filter(r => r.routeId !== routeId);

      // Clear vehicle's selected route
      const vehicle = this.selectedDeptVehicles.find(v => v.id === vehicleId);
      if (vehicle) {
        (vehicle as any).selectedRouteId = '';
      }

      this.cdr.detectChanges();
    },
    error: (err: any) => {
      console.error('❌ Failed to assign route:', err);
      alert(err.error?.error || 'Failed to assign route to vehicle');
    }
  });
}

  // ✅ Dispatch with first available route (for "Dispatch" button without route selector)
  dispatchVehicle(vehicleId: string) {
    console.log(`🚀 Dispatching vehicle: ${vehicleId}`);

    if (this.availableRoutes.length === 0) {
      alert('❌ No available routes! All routes are assigned or no bins need collection.');
      return;
    }

    const route = this.availableRoutes[0]; // Take first available route

    console.log(`📦 Assigning route ${route.routeId} to vehicle ${vehicleId}`);

    // Assign route to vehicle
    this.routeService.assignRouteToVehicle(route.routeId, vehicleId, this.CURRENT_DEPARTMENT_ID).subscribe({
      next: (result: any) => {
        console.log(`✅ Route assigned and started:`, result);

        // Mark vehicle as active
        this.activeTrucks.set(vehicleId, {
          vehicleId: vehicleId,
          progress: 0,
          routeId: route.routeId
        });

        // Remove route from available list
        this.availableRoutes = this.availableRoutes.filter(r => r.routeId !== route.routeId);

        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('❌ Failed to assign route:', err);
        alert(err.error?.error || 'Failed to assign route to vehicle');
      }
    });
  }

  // ✅ Dispatch all available vehicles
  dispatchAllAvailable() {
    const availableVehicles = this.getAvailableVehiclesOnly();

    if (availableVehicles.length === 0) {
      alert('❌ No available vehicles to dispatch!');
      return;
    }

    if (this.availableRoutes.length < availableVehicles.length) {
      alert(`⚠️ Not enough routes! You have ${availableVehicles.length} vehicles but only ${this.availableRoutes.length} routes available.`);
      return;
    }

    console.log(`🚀🚀 Dispatching ${availableVehicles.length} vehicles`);

    // Dispatch each vehicle with a route
    availableVehicles.forEach((vehicle, index) => {
      if (this.availableRoutes[index]) {
        this.dispatchVehicle(vehicle.id);
      }
    });
  }

  onVehicleUnloading(vehicleId: string) {
    this.unloadingVehicles.add(vehicleId);
    console.log(`🏭 Vehicle ${vehicleId} started unloading at depot...`);
  }

  private setupWebSocketListeners() {
    this.routeProgressSub = this.webSocketService.getRouteProgressUpdates().subscribe(
      (update: RouteProgressUpdate) => {
        console.log('📊 Route progress update:', update);

        this.vehicleProgress.set(update.vehicleId, {
          currentStop: update.currentStop,
          totalStops: update.totalStops,
          binId: update.binId,
          fillLevel: update.vehicleFillLevel
        });

        this.updateVehicleFillLevel(update.vehicleId, update.vehicleFillLevel);

        const progress = (update.currentStop / update.totalStops) * 100;
        this.activeTrucks.set(update.vehicleId, {
          vehicleId: update.vehicleId,
          progress: progress,
          currentStop: update.currentStop,
          totalStops: update.totalStops
        });

        this.cdr.detectChanges();
      }
    );

    this.routeCompletionSub = this.webSocketService.getRouteCompletionUpdates().subscribe(
      (event: any) => {
        console.log('✅ Route completed:', event);
        this.onRouteCompleted(event.vehicleId, event.binsCollected);
        
        // ✅ Reload available routes after completion
        this.loadAvailableRoutes();
        
        this.cdr.detectChanges();
      }
    );

    this.vehicleUpdateSub = this.webSocketService.getVehicleUpdates().subscribe(
      (update: any) => {
        console.log('🚛 Vehicle update:', update);

        if (update.status === 'UNLOADING') {
          this.onVehicleUnloading(update.vehicleId);
        }

        if (update.status === 'AVAILABLE' && this.unloadingVehicles.has(update.vehicleId)) {
          this.unloadingVehicles.delete(update.vehicleId);
          console.log(`✅ Vehicle ${update.vehicleId} finished unloading!`);
        }

        if (update.vehicleId && update.fillLevel !== undefined) {
          this.updateVehicleFillLevel(update.vehicleId, update.fillLevel);
        }

        if (update.vehicleId && update.available !== undefined) {
          this.updateVehicleAvailability(update.vehicleId, update.available);
        }

        this.cdr.detectChanges();
      }
    );
  }

  private updateVehicleFillLevel(vehicleId: string, fillLevel: number) {
    const vehicleIndex = this.selectedDeptVehicles.findIndex(v => v.id === vehicleId);
    if (vehicleIndex !== -1) {
      this.selectedDeptVehicles[vehicleIndex].fillLevel = fillLevel;
      console.log(`Updated vehicle ${vehicleId} fill to ${fillLevel}%`);
      this.cdr.detectChanges();
    }
  }

  private updateVehicleAvailability(vehicleId: string, available: boolean) {
    const vehicleIndex = this.selectedDeptVehicles.findIndex(v => v.id === vehicleId);
    if (vehicleIndex !== -1) {
      this.selectedDeptVehicles[vehicleIndex].available = available;
      console.log(`Updated vehicle ${vehicleId} availability: ${available ? 'READY' : 'BUSY'}`);
    }
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.routeProgressSub?.unsubscribe();
    this.routeCompletionSub?.unsubscribe();
    this.vehicleUpdateSub?.unsubscribe();
  }

  getVehicleProgress(vehicleId: string): string {
    const progress = this.vehicleProgress.get(vehicleId);
    if (progress) {
      return `🚛 Stop ${progress.currentStop}/${progress.totalStops} (${Math.round(progress.fillLevel)}% full)`;
    }
    return '';
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

  loadAnalytics() {
    if (!this.selectedDepartment) return;

    this.loadingAnalytics = true;

    this.analyticsService.getDepartmentSummary(this.selectedDepartment.departmentId).subscribe({
      next: (data) => {
        this.analyticsData = data;
        this.loadingAnalytics = false;
        console.log('📊 Analytics loaded:', data);
      },
      error: (error) => {
        console.error('Error loading analytics:', error);
        this.loadingAnalytics = false;
      }
    });

    this.analyticsService.getRecentRoutes(this.selectedDepartment.departmentId, 3).subscribe({
      next: (routes) => {
        this.recentRoutes = routes;
        console.log('📜 Recent routes:', routes);
      },
      error: (error) => {
        console.error('Error loading routes:', error);
      }
    });
  }

  loadDepartmentVehicles() {
    this.dashboardService.getDepartmentVehicles(this.CURRENT_DEPARTMENT_ID).subscribe({
      next: (vehicles) => {
        console.log('🚛 Vehicles loaded:', vehicles.length);
        this.selectedDeptVehicles = vehicles;
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

        const deptId = dept.id || dept._id || this.CURRENT_DEPARTMENT_ID;
        console.log('🆔 Using department ID:', deptId);

        this.selectedDepartment = {
          departmentId: deptId,
          departmentName: dept.name,
          totalVehicles: 0,
          availableVehicles: 0,
          activeVehicles: 0,
          totalEmployees: 0,
          availableEmployees: 0,
          totalBins: 0,
          criticalBins: 0,
          binsCollectedToday: 0,
          averageFillLevel: 0,
          co2Saved: 0
        };

        this.loading = false;
        this.loadDepartmentVehicles();
        this.loadDepartmentEmployees();
        this.loadAnalytics();
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

  trackActiveRoute(vehicleId: string) {
    this.activeRoutes.add(vehicleId);
    console.log(`📍 Tracking ${this.activeRoutes.size} active routes`);
  }

  updateVehicleProgress(vehicleId: string, currentStop: number, totalStops: number, binId: string, fillLevel: number = 0) {
    this.vehicleProgress.set(vehicleId, {
      currentStop,
      totalStops,
      binId,
      fillLevel
    });
    console.log(`📊 Vehicle ${vehicleId}: Stop ${currentStop}/${totalStops} at bin ${binId} - Fill: ${fillLevel}%`);
  }

  showAllRoutes() {
    console.log('🗺️ Show all routes clicked from dashboard');
    window.dispatchEvent(new CustomEvent('show-all-routes', {
      detail: { departmentId: this.CURRENT_DEPARTMENT_ID }
    }));
  }

  clearAllRoutes() {
    console.log('🧹 Clear routes clicked from dashboard');
    window.dispatchEvent(new CustomEvent('clear-all-routes'));
    this.departmentRoutes = [];
    this.activeTrucks.clear();
    this.activeRoutes.clear();
    this.vehicleProgress.clear();
  }

  onRouteCompleted(vehicleId: string, binsCollected: number) {
    this.activeRoutes.delete(vehicleId);
    this.vehicleProgress.delete(vehicleId);
    this.activeTrucks.delete(vehicleId);

    console.log(`✅ Route completed! ${this.activeRoutes.size} routes remaining`);

    const vehicle = this.selectedDeptVehicles.find(v => v.id === vehicleId);
    const vehicleName = vehicle?.reference || 'Vehicle';

    alert(`✅ ${vehicleName} completed route!\nCollected ${binsCollected} bins`);

    this.loadDepartmentVehicles();
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
    if (this.activeTrucks.size > 0) {
      alert('❌ Routes are already executing! Clear them first.');
      return;
    }

    this.loadingRoutes = true;
    console.log('🗺️ Loading routes...');

    this.dashboardService.getDepartmentRoutes(this.CURRENT_DEPARTMENT_ID)
      .subscribe({
        next: (routes) => {
          this.departmentRoutes = routes;
          console.log('✅ Routes loaded:', routes);
          this.loadingRoutes = false;

          window.dispatchEvent(new CustomEvent('show-department-routes', {
            detail: { departmentId: this.CURRENT_DEPARTMENT_ID }
          }));
        },
        error: (err) => {
          console.error('❌ Route load failed:', err);
          this.loadingRoutes = false;
          alert('Failed to load routes');
        }
      });
  }

  clearRoutes() {
    window.dispatchEvent(new CustomEvent('clear-routes'));
    this.departmentRoutes = [];
    this.activeTrucks.clear();
    this.activeRoutes.clear();
    this.vehicleProgress.clear();
    console.log('🧹 Routes and active trucks cleared');
  }

  getVehicleName(vehicleId: string): string {
    const vehicle = this.selectedDeptVehicles.find(v => v.id === vehicleId);
    return vehicle?.reference || `Vehicle ${vehicleId.substring(0, 8)}`;
  }

  getActiveTrucksArray(): any[] {
    return Array.from(this.activeTrucks.values());
  }

  getProgressGradient(progress: number): string {
    if (progress < 33) {
      return 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)';
    } else if (progress < 66) {
      return 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)';
    } else {
      return 'linear-gradient(90deg, #10b981 0%, #34d399 100%)';
    }
  }

  getTruckFillLevel(vehicleId: string): number {
    const progress = this.vehicleProgress.get(vehicleId);
    return progress ? Math.round(progress.fillLevel) : 0;
  }

  getVehicleStatusClass(vehicleId: string, available: boolean): string {
    if (this.activeTrucks.has(vehicleId)) {
      return 'active';
    }
    return available ? 'ready' : 'busy';
  }

  getVehicleStatusText(vehicleId: string, available: boolean): string {
    if (this.activeTrucks.has(vehicleId)) {
      return '🔄 In Route';
    }
    return available ? '✓ Ready' : '⏸️ Busy';
  }
}
