import { Component, OnInit, OnDestroy, ViewEncapsulation, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { DashboardService, DepartmentStats, VehicleInfo } from '../../services/dashboard.service';
import { MapComponent } from '../map/map.component';
import { DepartmentService } from '../../services/department.service';
import { WebSocketService } from '../../services/web-socket-service';
import { RouteProgressUpdate, VehicleStatusUpdate } from '../../models/websocket-dtos';
import { ChangeDetectorRef } from '@angular/core';
import { AnalyticsService, DepartmentSummary, RecentRoute } from '../../services/analytics.service';
import { RouteService, AvailableRoute } from '../../services/route.service';
import { FormsModule } from '@angular/forms';
import { EmployeeService, Employee } from '../../services/employee.service';
import { AuthService } from '../../services/auth.service';

interface ActiveTruck {
  vehicleId: string;
  progress: number;
  routeId?: string;
  currentStop?: number;
  totalStops?: number;
}

interface VehicleProgress {
  currentStop: number;
  totalStops: number;
  binId: string;
  fillLevel: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MapComponent, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class DashboardComponent implements OnInit, OnDestroy {
  departments: DepartmentStats[] = [];
  selectedDeptVehicles: VehicleInfo[] = [];
  loading = true;
  selectedDepartment: DepartmentStats | null = null;
  departmentRoutes: AvailableRoute[] = [];
  loadingRoutes = false;
  vehicleProgress: Map<string, VehicleProgress> = new Map();
  activeTrucks: Map<string, ActiveTruck> = new Map();
  departmentStats: DepartmentStats | null = null;
  department: DepartmentStats | null = null;
  employees: Employee[] = [];
  private activeRoutes: Set<string> = new Set();
  private refreshInterval?: ReturnType<typeof setInterval>;

  analyticsData: DepartmentSummary | null = null;
  recentRoutes: RecentRoute[] = [];
  loadingAnalytics = false;

  availableRoutes: AvailableRoute[] = [];

  availableEmployees: Employee[] = [];
  vehicleEmployees: Map<string, string[]> = new Map();

  private routeProgressSub?: Subscription;
  private routeCompletionSub?: Subscription;
  private vehicleUpdateSub?: Subscription;
  unloadingVehicles: Set<string> = new Set();

  private get currentDepartmentId(): string {
    return this.authService.getDepartmentId() || '';
  }

  constructor(
    private dashboardService: DashboardService,
    private departmentService: DepartmentService,
    private webSocketService: WebSocketService,
    private cdr: ChangeDetectorRef,
    private routeService: RouteService,
    private analyticsService: AnalyticsService,
    public authService: AuthService,
    private employeeService: EmployeeService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit(): void {
    this.loadCurrentDepartment();
    this.setupWebSocketListeners();
    this.loadAvailableRoutes();
    this.loadAvailableEmployees();

    setTimeout(() => {
      this.showAllRoutes();
    }, 1000);

    window.addEventListener('vehicle-route-completed', ((e: CustomEvent) => {
      const { vehicleId, binsCollected } = e.detail;
      this.onRouteCompleted(vehicleId, binsCollected);
    }) as EventListener);

    window.addEventListener('vehicle-at-bin', ((e: CustomEvent) => {
      const { vehicleId, binId, currentStop, totalStops, fillLevel } = e.detail;
      this.updateVehicleProgress(vehicleId, currentStop, totalStops, binId, fillLevel || 0);
    }) as EventListener);

    window.addEventListener('vehicle-started', ((e: CustomEvent) => {
      const { vehicleId } = e.detail;
      this.activeTrucks.set(vehicleId, { vehicleId, progress: 0 });
    }) as EventListener);

    this.refreshInterval = setInterval(() => {
      if (this.activeRoutes.size > 0 && this.selectedDepartment) {
        this.loadVehicles(this.selectedDepartment.departmentId);
      }
    }, 5000);
  }

  loadAvailableEmployees(): void {
    this.employeeService.getAvailableEmployees().subscribe({
      next: (employees: Employee[]) => {
        this.availableEmployees = employees;
        this.cdr.detectChanges();
      },
      error: () => { /* Handle silently */ }
    });
  }

  assignEmployee(vehicleId: string, _employeeSlot: number): void {
    if (!this.vehicleEmployees.has(vehicleId)) {
      this.vehicleEmployees.set(vehicleId, ['', '']);
    }
  }

  getAssignedEmployees(vehicleId: string): string[] {
    return this.vehicleEmployees.get(vehicleId) || ['', ''];
  }

  getEmployeeName(employeeId: string): string {
    const emp = this.availableEmployees.find(e => e.id === employeeId);
    return emp ? `${emp.firstName} ${emp.lastName}` : 'Select Employee';
  }

  canDispatch(vehicleId: string, selectedRouteId: string | undefined): boolean {
    const employees = this.getAssignedEmployees(vehicleId);
    const hasTwoEmployees = !!(employees[0] && employees[1] && employees[0] !== employees[1]);
    const hasRoute = !!(selectedRouteId && selectedRouteId !== '');
    return hasTwoEmployees && hasRoute;
  }

  showMapModal = false;

  openMapModal(): void {
    this.showMapModal = true;
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('map-modal-opened'));
    }, 100);
  }


  closeMapModal(): void {
    this.showMapModal = false;
  }

  // Get employees currently in active trucks
  getEmployeesInTrucks(): Employee[] {
    const inTruckEmployeeIds = new Set<string>();

    this.activeTrucks.forEach(truck => {
      const employeeIds = this.vehicleEmployees.get(truck.vehicleId) || [];
      employeeIds.forEach(id => {
        if (id) inTruckEmployeeIds.add(id);
      });
    });

    return this.availableEmployees.filter(emp =>
      inTruckEmployeeIds.has(emp.id)
    );
  }

  // Get truly available employees (not in trucks)
  getTrulyAvailableEmployees(): Employee[] {
    const inTruckEmployeeIds = new Set<string>();

    this.activeTrucks.forEach(truck => {
      const employeeIds = this.vehicleEmployees.get(truck.vehicleId) || [];
      employeeIds.forEach(id => {
        if (id) inTruckEmployeeIds.add(id);
      });
    });

    return this.availableEmployees.filter(emp =>
      !inTruckEmployeeIds.has(emp.id)
    );
  }

  getVehicleEmployees(vehicleId: string): string[] {
    if (!this.vehicleEmployees.has(vehicleId)) {
      this.vehicleEmployees.set(vehicleId, ['', '']);
    }
    return this.vehicleEmployees.get(vehicleId)!;
  }

  setVehicleEmployee(vehicleId: string, slotIndex: number, employeeId: string) {
    const employees = this.getVehicleEmployees(vehicleId);
    employees[slotIndex] = employeeId;
    this.vehicleEmployees.set(vehicleId, employees);
  }


  loadAvailableRoutes(): void {
    if (!this.currentDepartmentId) return;
    
    this.routeService.getAvailableRoutes(this.currentDepartmentId).subscribe({
      next: (routes: AvailableRoute[]) => {
        this.availableRoutes = routes;
        this.cdr.detectChanges();
      },
      error: () => { /* Handle silently */ }
    });
  }

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

  dispatchVehicleWithRoute(vehicleId: string, routeId: string | undefined): void {
    if (!routeId) {
      alert('Please select a route first!');
      return;
    }

    const employees = this.getAssignedEmployees(vehicleId);
    if (!employees[0] || !employees[1]) {
      alert('Please assign 2 employees before dispatching!');
      return;
    }

    if (employees[0] === employees[1]) {
      alert('Please select 2 different employees!');
      return;
    }

    this.employeeService.assignEmployeesToVehicle(vehicleId, employees).subscribe({
      next: () => {
        this.routeService.assignRouteToVehicle(routeId, vehicleId, this.currentDepartmentId).subscribe({
          next: () => {
            this.activeTrucks.set(vehicleId, {
              vehicleId: vehicleId,
              progress: 0,
              routeId: routeId
            });

            window.dispatchEvent(new CustomEvent('vehicle-started', {
              detail: { vehicleId: vehicleId }
            }));

            this.availableRoutes = this.availableRoutes.filter(r => r.routeId !== routeId);
            this.vehicleEmployees.delete(vehicleId);
            this.loadAvailableEmployees();

            const vehicle = this.selectedDeptVehicles.find(v => v.id === vehicleId);
            if (vehicle) {
              vehicle.selectedRouteId = '';
            }

            this.cdr.detectChanges();
          },
          error: (err: { error?: { error?: string }; message?: string }) => {
            alert(err.error?.error || 'Failed to assign route to vehicle');
          }
        });
      },
      error: (err: { error?: { error?: string }; message?: string }) => {
        alert(err.error?.error || 'Failed to assign employees to vehicle');
      }
    });
  }

  dispatchVehicle(vehicleId: string): void {
    if (this.availableRoutes.length === 0) {
      alert('No available routes! All routes are assigned or no bins need collection.');
      return;
    }

    const route = this.availableRoutes[0];

    this.routeService.assignRouteToVehicle(route.routeId, vehicleId, this.currentDepartmentId).subscribe({
      next: () => {
        this.activeTrucks.set(vehicleId, {
          vehicleId: vehicleId,
          progress: 0,
          routeId: route.routeId
        });
        this.availableRoutes = this.availableRoutes.filter(r => r.routeId !== route.routeId);
        this.cdr.detectChanges();
      },
      error: (err: { error?: { error?: string }; message?: string }) => {
        alert(err.error?.error || 'Failed to assign route to vehicle');
      }
    });
  }

  dispatchAllAvailable(): void {
    const availableVehicles = this.getAvailableVehiclesOnly();

    if (availableVehicles.length === 0) {
      alert('No available vehicles to dispatch!');
      return;
    }

    if (this.availableRoutes.length < availableVehicles.length) {
      alert(`Not enough routes! You have ${availableVehicles.length} vehicles but only ${this.availableRoutes.length} routes available.`);
      return;
    }

    availableVehicles.forEach((vehicle, index) => {
      if (this.availableRoutes[index]) {
        this.dispatchVehicle(vehicle.id);
      }
    });
  }

  onVehicleUnloading(vehicleId: string): void {
    this.unloadingVehicles.add(vehicleId);
  }

  private setupWebSocketListeners(): void {
    this.routeProgressSub = this.webSocketService.getRouteProgressUpdates().subscribe(
      (update: RouteProgressUpdate) => {
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
      (event) => {
        this.onRouteCompleted(event.vehicleId, event.binsCollected);
        this.loadAvailableRoutes();
        this.loadAvailableEmployees();
        this.cdr.detectChanges();
      }
    );

    this.vehicleUpdateSub = this.webSocketService.getVehicleUpdates().subscribe(
      (update: VehicleStatusUpdate) => {
        if (update.status === 'UNLOADING') {
          this.onVehicleUnloading(update.vehicleId);
        }
        if (update.status === 'AVAILABLE' && this.unloadingVehicles.has(update.vehicleId)) {
          this.unloadingVehicles.delete(update.vehicleId);
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


  private updateVehicleFillLevel(vehicleId: string, fillLevel: number): void {
    const vehicleIndex = this.selectedDeptVehicles.findIndex(v => v.id === vehicleId);
    if (vehicleIndex !== -1) {
      this.selectedDeptVehicles[vehicleIndex].fillLevel = fillLevel;
      this.cdr.detectChanges();
    }
  }

  private updateVehicleAvailability(vehicleId: string, available: boolean): void {
    const vehicleIndex = this.selectedDeptVehicles.findIndex(v => v.id === vehicleId);
    if (vehicleIndex !== -1) {
      this.selectedDeptVehicles[vehicleIndex].available = available;
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

  loadDepartmentEmployees(): void {
    if (!this.currentDepartmentId) return;
    
    this.departmentService.getDepartmentEmployees(this.currentDepartmentId).subscribe({
      next: (employees) => {
        this.employees = employees;
      },
      error: () => { /* Handle silently */ }
    });
  }

  loadAnalytics(): void {
    if (!this.selectedDepartment) return;
    this.loadingAnalytics = true;
    
    this.analyticsService.getDepartmentSummary(this.selectedDepartment.departmentId).subscribe({
      next: (data) => {
        this.analyticsData = data;
        this.loadingAnalytics = false;
      },
      error: () => {
        this.loadingAnalytics = false;
      }
    });
    this.analyticsService.getRecentRoutes(this.selectedDepartment.departmentId, 3).subscribe({
      next: (routes) => {
        this.recentRoutes = routes;
      },
      error: () => { /* Handle silently */ }
    });
  }

  loadDepartmentVehicles(): void {
    if (!this.currentDepartmentId) return;
    
    this.dashboardService.getDepartmentVehicles(this.currentDepartmentId).subscribe({
      next: (vehicles) => {
        this.selectedDeptVehicles = vehicles;
      },
      error: () => { /* Handle silently */ }
    });
  }

  loadCurrentDepartment(): void {
    if (!this.currentDepartmentId) {
      this.loading = false;
      return;
    }
    
    this.loading = true;
    this.departmentService.getDepartmentById(this.currentDepartmentId).subscribe({
      next: (dept) => {
        this.department = dept as unknown as DepartmentStats;
        this.departmentStats = dept as unknown as DepartmentStats;
        const deptId = dept.id || this.currentDepartmentId;
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
      error: () => {
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

  trackActiveRoute(vehicleId: string): void {
    this.activeRoutes.add(vehicleId);
  }

  updateVehicleProgress(vehicleId: string, currentStop: number, totalStops: number, binId: string, fillLevel = 0): void {
    this.vehicleProgress.set(vehicleId, {
      currentStop,
      totalStops,
      binId,
      fillLevel
    });
  }

  showAllRoutes(): void {
    window.dispatchEvent(new CustomEvent('show-all-routes', {
      detail: { departmentId: this.currentDepartmentId }
    }));
  }

  clearAllRoutes(): void {
    window.dispatchEvent(new CustomEvent('clear-all-routes'));
    this.departmentRoutes = [];
    this.activeTrucks.clear();
    this.activeRoutes.clear();
    this.vehicleProgress.clear();
  }

  onRouteCompleted(vehicleId: string, binsCollected: number): void {
    this.activeRoutes.delete(vehicleId);
    this.vehicleProgress.delete(vehicleId);
    this.activeTrucks.delete(vehicleId);
    const vehicle = this.selectedDeptVehicles.find(v => v.id === vehicleId);
    const vehicleName = vehicle?.reference || 'Vehicle';
    alert(`${vehicleName} completed route! Collected ${binsCollected} bins`);
    this.loadDepartmentVehicles();
  }

  loadDepartments(): void {
    this.loading = true;
    this.dashboardService.getDepartments().subscribe({
      next: (data) => {
        this.departments = data;
        this.loading = false;
        if (data.length > 0 && !this.selectedDepartment) {
          this.selectDepartment(data[0]);
        }
      },
      error: () => {
        this.loading = false;
        this.departments = [];
      }
    });
  }

  selectDepartment(dept: DepartmentStats): void {
    this.selectedDepartment = dept;
    this.loadVehicles(dept.departmentId);
  }

  loadVehicles(deptId: string): void {
    this.dashboardService.getDepartmentVehicles(deptId).subscribe(vehicles => {
      this.selectedDeptVehicles = vehicles;
    });
  }

  showDepartmentRoutes(): void {
    if (this.activeTrucks.size > 0) {
      alert('Routes are already executing! Clear them first.');
      return;
    }
    this.loadingRoutes = true;
    this.dashboardService.getDepartmentRoutes(this.currentDepartmentId)
      .subscribe({
        next: (routes) => {
          this.departmentRoutes = routes as unknown as AvailableRoute[];
          this.loadingRoutes = false;
          window.dispatchEvent(new CustomEvent('show-department-routes', {
            detail: { departmentId: this.currentDepartmentId }
          }));
        },
        error: () => {
          this.loadingRoutes = false;
          alert('Failed to load routes');
        }
      });
  }

  clearRoutes(): void {
    window.dispatchEvent(new CustomEvent('clear-routes'));
    this.departmentRoutes = [];
    this.activeTrucks.clear();
    this.activeRoutes.clear();
    this.vehicleProgress.clear();
  }

  getVehicleName(vehicleId: string): string {
    const vehicle = this.selectedDeptVehicles.find(v => v.id === vehicleId);
    return vehicle?.reference || `Vehicle ${vehicleId.substring(0, 8)}`;
  }

  getActiveTrucksArray(): ActiveTruck[] {
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
  manualGenerateRoutes(): void {
    if (!this.selectedDepartment) {
      return;
    }

    this.routeService.generateRoutes(this.currentDepartmentId).subscribe({
      next: (response) => {
        alert(`Generated ${response.routeCount} new routes!`);
        this.loadAvailableRoutes();
      },
      error: (err: { error?: { error?: string }; message?: string }) => {
        alert('Failed to generate routes: ' + (err.error?.error || err.message));
      }
    });
  }

  checkCriticalBins(): void {
    this.routeService.checkCriticalBins().subscribe({
      next: () => {
        alert('Critical bins check complete!');
        this.loadAvailableRoutes();
      },
      error: (err: { error?: { error?: string }; message?: string }) => {
        alert('Failed to check critical bins: ' + (err.error?.error || err.message));
      }
    });
  }

  dispatchAllAvailableWithEmployees(): void {
    const availableVehicles = this.getAvailableVehiclesOnly();

    if (availableVehicles.length === 0) {
      alert('No available vehicles to dispatch!');
      return;
    }

    if (this.availableRoutes.length < availableVehicles.length) {
      alert(`Not enough routes! You have ${availableVehicles.length} vehicles but only ${this.availableRoutes.length} routes available.`);
      return;
    }

    const vehiclesWithoutEmployees = availableVehicles.filter(vehicle => {
      const employees = this.getAssignedEmployees(vehicle.id);
      return !employees[0] || !employees[1] || employees[0] === employees[1];
    });

    if (vehiclesWithoutEmployees.length > 0) {
      alert(`${vehiclesWithoutEmployees.length} vehicle(s) don't have 2 employees assigned. Please assign employees to all vehicles first.`);
      return;
    }

    availableVehicles.forEach((vehicle, index) => {
      if (this.availableRoutes[index]) {
        const route = this.availableRoutes[index];
        setTimeout(() => {
          this.dispatchVehicleWithRoute(vehicle.id, route.routeId);
        }, index * 500);
      }
    });
  }
}
