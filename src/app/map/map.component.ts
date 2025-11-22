import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { BinService } from '../services/bin-service';
import { DepartmentService } from '../services/department.service';
import { WebSocketService } from '../services/web-socket-service';
import { FormsModule } from '@angular/forms'; 
import {
  Bin,
  Department,
  TruckPositionUpdate,
  RouteProgressUpdate,
  RouteCompletionEvent
} from '../models/websocket-dtos';
import { RouteService } from '../services/route.service';  // ✅ ADD THIS


@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class MapComponent implements OnInit, OnDestroy {
  private map: any;
  private markers: Map<string, any> = new Map();
  private departmentMarkers: Map<string, any> = new Map();
  private L: any;
  availableVehicles: any[] = [];
  selectedVehicleId: string = '';
  // WebSocket subscriptions
  private wsSubscription?: Subscription;
  private truckPositionSub?: Subscription;
  private routeProgressSub?: Subscription;
  private routeCompletionSub?: Subscription;

  // Visual elements
  private routePolylines: Map<string, any> = new Map();
  activeTrucks: Map<string, any> = new Map();
  private routeMarkers: any[] = [];

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private binService: BinService,
    private webSocketService: WebSocketService,
    private departmentService: DepartmentService,
    private routeService: RouteService  // ✅ ADD THIS LINE
  ) { }

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.L = await import('leaflet');
      this.initMap(this.L);
      this.loadDepartments(this.L);
      this.loadBins(this.L);

      this.webSocketService.connect('http://localhost:8080/ws');
      this.setupWebSocketListeners();
    }
  }

  ngOnDestroy() {
    this.wsSubscription?.unsubscribe();
    this.truckPositionSub?.unsubscribe();
    this.routeProgressSub?.unsubscribe();
    this.routeCompletionSub?.unsubscribe();
    this.webSocketService.disconnect();
  }

  // ============ WEBSOCKET LISTENERS ============

  private setupWebSocketListeners() {
    this.wsSubscription = this.webSocketService.getBinUpdates().subscribe(
      (updatedBin: Bin) => this.updateBinMarker(updatedBin)
    );

    this.truckPositionSub = this.webSocketService.getTruckPositionUpdates().subscribe(
      (update: TruckPositionUpdate) => {
        this.updateTruckPosition(update.vehicleId, update.latitude, update.longitude, update.progressPercent);
      }
    );

    this.routeProgressSub = this.webSocketService.getRouteProgressUpdates().subscribe(
      (update: RouteProgressUpdate) => {
        this.showRouteProgress(update.vehicleId, update.currentStop, update.totalStops, update.vehicleFillLevel);
      }
    );

    this.routeCompletionSub = this.webSocketService.getRouteCompletionUpdates().subscribe(
      (event: RouteCompletionEvent) => {
        this.onRouteComplete(event.vehicleId, event.binsCollected);
      }
    );
  }
  // ============ BACKEND-MANAGED ROUTE EXECUTION ============

  executeManagedRoute(departmentId: string, vehicleId: string) {
    console.log(`🚀 Executing managed route for vehicle ${vehicleId}`);

    this.routeService.executeManagedRoute(departmentId, vehicleId).subscribe({
      next: (data: any) => {  // ✅ ADD : any
        console.log('✅ Route started:', data);
        this.showNotification(`Route started for vehicle ${vehicleId}`);
      },
      error: (error: any) => {  // ✅ ADD : any
        console.error('❌ Failed to start route:', error);
        this.showNotification('Failed to start route');
      }
    });
  }


  // ✅ Helper to convert Map to Array for *ngFor
  getActiveTrucksArray() {
    return Array.from(this.activeTrucks.entries()).map(([vehicleId, truck]) => ({
      vehicleId,
      progress: truck.progress || 0
    }));
  }

  // ============ TRUCK VISUALIZATION ============

  private updateTruckPosition(vehicleId: string, lat: number, lng: number, progress: number) {
    let truck = this.activeTrucks.get(vehicleId);

    if (!truck) {
      truck = this.createTruckMarker(vehicleId, lat, lng);
      this.activeTrucks.set(vehicleId, truck);
    } else {
      truck.marker.setLatLng([lat, lng]);
    }

    this.updateTruckProgressIndicator(vehicleId, progress);
  }

  private createTruckMarker(vehicleId: string, lat: number, lng: number) {
    const truckIcon = this.L.divIcon({
      html: `
        <div class="truck-marker" style="
          width: 52px; height: 52px; border-radius: 50%;
          background: linear-gradient(145deg, #2563eb 0%, #3b82f6 100%);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 8px 20px rgba(37,99,235,0.25);
          border: 3px solid white;
          position: relative;
        ">
          <div style="font-size:28px; z-index:2;">🚛</div>
          <div class="truck-fill-indicator" style="
            position: absolute; bottom: 7px; left: 11px; right: 11px;
            height: 0px;
            background: linear-gradient(180deg, #4ade80 0%, #22d3ee 100%);
            border-radius: 3px;
            transition: height 0.7s, background 0.7s;
            z-index:1;
          "></div>
          <div class="truck-fill-percent" style="
            position: absolute; top: 5px; right: 5px;
            font-size: 10px; color: white; font-weight: 800;
            background: rgba(0,0,0,0.75);
            padding: 3px 4px; border-radius: 4px;
            z-index:3;
          ">0%</div>
        </div>
      `,
      className: '',
      iconSize: [52, 52],
      iconAnchor: [26, 26]
    });

    const marker = this.L.marker([lat, lng], { icon: truckIcon }).addTo(this.map);
    marker.bindPopup(`Vehicle ${vehicleId}<br>Progress: 0%`);

    return { marker, vehicleId };
  }

  private updateTruckProgressIndicator(vehicleId: string, progress: number) {
    const truck = this.activeTrucks.get(vehicleId);
    if (!truck) return;

    const fillLevel = progress;
    const fillHeight = Math.max(0, fillLevel * 0.24);

    const element = truck.marker.getElement();
    if (element) {
      const indicator = element.querySelector('.truck-fill-indicator') as HTMLElement;
      const percent = element.querySelector('.truck-fill-percent') as HTMLElement;

      if (indicator) {
        indicator.style.height = `${fillHeight}px`;

        if (fillLevel < 50) {
          indicator.style.background = 'linear-gradient(180deg, #4ade80 0%, #22d3ee 100%)';
        } else if (fillLevel < 80) {
          indicator.style.background = 'linear-gradient(180deg, #facc15 0%, #f97316 100%)';
        } else {
          indicator.style.background = 'linear-gradient(180deg, #fb7185 0%, #ef4444 100%)';
        }
      }

      if (percent) {
        percent.textContent = `${Math.round(fillLevel)}%`;
      }
    }

    truck.marker.setPopupContent(`Vehicle ${vehicleId}<br>Progress: ${progress.toFixed(1)}%`);
  }

  private showRouteProgress(vehicleId: string, currentStop: number, totalStops: number, fillLevel: number) {
    console.log(`📊 Vehicle ${vehicleId}: Stop ${currentStop}/${totalStops} (Fill: ${fillLevel}%)`);
    this.updateTruckProgressIndicator(vehicleId, fillLevel);
    this.showNotification(`🚛 Vehicle ${vehicleId} collected bin (${currentStop}/${totalStops})`);
  }

  private onRouteComplete(vehicleId: string, binsCollected: number) {
    console.log(`✅ Vehicle ${vehicleId} completed route: ${binsCollected} bins`);

    const truck = this.activeTrucks.get(vehicleId);
    if (truck) {
      const element = truck.marker.getElement();
      if (element) {
        element.style.animation = 'pulse 1s';
      }

      setTimeout(() => {
        if (this.map.hasLayer(truck.marker)) {
          this.map.removeLayer(truck.marker);
        }
        this.activeTrucks.delete(vehicleId);
      }, 5000);
    }

    this.showNotification(`✅ Route completed: ${binsCollected} bins collected!`);
  }

  clearAllRoutes() {
    this.routePolylines.forEach(p => this.map.removeLayer(p));
    this.routePolylines.clear();
    this.routeMarkers.forEach(m => this.map.removeLayer(m));
    this.routeMarkers = [];
    this.activeTrucks.forEach(t => this.map.removeLayer(t.marker));
    this.activeTrucks.clear();
  }

  private showNotification(message: string) {
    console.log(`🔔 ${message}`);
  }

  // ============ MAP INITIALIZATION ============

  private initMap(L: any) {
    const tunisiaBounds = L.latLngBounds(L.latLng(30.0, 7.5), L.latLng(37.5, 12.0));
    this.map = L.map('map', {
      maxBounds: tunisiaBounds,
      maxBoundsViscosity: 1.0,
      minZoom: 6,
      maxZoom: 18
    }).setView([34.0, 9.0], 7);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);
  }

  // ============ BIN VISUALIZATION ============

  private loadBins(L: any) {
    this.binService.getAllBins().subscribe((bins: Bin[]) => {
      bins.forEach(bin => this.addBinMarker(L, bin));
    });
  }

  private addBinMarker(L: any, bin: Bin) {
    const color = this.getColorForFillLevel(bin.fillLevel);
    const icon = this.createBinIcon(L, color, bin.fillLevel);
    const marker = L.marker([bin.latitude, bin.longitude], { icon }).addTo(this.map);
    marker.bindPopup(this.createPopupContent(bin, color));
    this.markers.set(bin.id, marker);
  }

  private updateBinMarker(bin: Bin) {
    const existingMarker = this.markers.get(bin.id);
    if (existingMarker) {
      const color = this.getColorForFillLevel(bin.fillLevel);
      const icon = this.createBinIcon(this.L, color, bin.fillLevel);
      existingMarker.setIcon(icon);
      existingMarker.setPopupContent(this.createPopupContent(bin, color));
      const element = existingMarker.getElement();
      if (element) {
        element.style.animation = 'pulse 0.5s';
        setTimeout(() => { element.style.animation = ''; }, 500);
      }
    } else {
      this.addBinMarker(this.L, bin);
    }
  }

  private createPopupContent(bin: Bin, color: string): string {
    return `
      <div style="text-align: center;">
        <strong>Bin ID: ${bin.id}</strong><br>
        <div style="margin: 8px 0;">
          <div style="background: #e0e0e0; border-radius: 10px; height: 20px; width: 100%; position: relative;">
            <div style="background: ${color}; border-radius: 10px; height: 100%; width: ${bin.fillLevel}%; transition: width 0.3s;"></div>
          </div>
          <strong>${bin.fillLevel}%</strong> Full
        </div>
        Status: <span style="color: ${color}; font-weight: bold;">${bin.status}</span>
        <br><small style="color: #666;">Last updated: ${new Date().toLocaleTimeString()}</small>
      </div>
    `;
  }

  private createBinIcon(L: any, color: string, fillLevel: number) {
    const svgIcon = `
      <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="20" cy="48" rx="8" ry="2" fill="rgba(0,0,0,0.3)"/>
        <path d="M 12 18 L 10 45 Q 10 47 12 47 L 28 47 Q 30 47 30 45 L 28 18 Z"
              fill="${color}" stroke="#333" stroke-width="1.5"/>
        <rect x="8" y="15" width="24" height="4" rx="2"
              fill="${color}" stroke="#333" stroke-width="1.5"/>
        <rect x="16" y="12" width="8" height="3" rx="1.5"
              fill="#666" stroke="#333" stroke-width="1"/>
        <path d="M 12.5 ${45 - (fillLevel * 0.25)} L 11 45 Q 11 46 12 46 L 28 46 Q 29 46 29 45 L 27.5 ${45 - (fillLevel * 0.25)} Z"
              fill="${this.getDarkerColor(color)}" opacity="0.7"/>
        <text x="20" y="32" font-size="12" text-anchor="middle" fill="white" font-weight="bold">♻</text>
        <circle cx="32" cy="10" r="8" fill="white" stroke="${color}" stroke-width="2"/>
        <text x="32" y="13" font-size="8" text-anchor="middle" fill="${color}" font-weight="bold">${fillLevel}%</text>
      </svg>
    `;
    return this.L.divIcon({
      html: svgIcon,
      className: 'custom-bin-icon',
      iconSize: [40, 50],
      iconAnchor: [20, 50],
      popupAnchor: [0, -50]
    });
  }

  // ============ DEPARTMENT VISUALIZATION ============

  private loadDepartments(L: any) {
    this.departmentService.getAllDepartments().subscribe((depts: Department[]) => {
      depts.forEach((dept) => {
        const deptIcon = this.createDepartmentIcon(L);
        const marker = L.marker([dept.latitude, dept.longitude], { icon: deptIcon }).addTo(this.map);
        marker.on('click', () => this.loadDepartmentDetails(dept.id, marker));
        marker.bindPopup(this.createDepartmentLoadingPopup(dept));
        this.departmentMarkers.set(dept.id, marker);
      });
    });
  }

  private loadDepartmentDetails(deptId: string, marker: any) {
    this.departmentService.getDepartmentEmployees(deptId).subscribe(employees => {
      this.departmentService.getDepartmentVehicles(deptId).subscribe(vehicles => {
        this.departmentService.getDepartmentById(deptId).subscribe(dept => {
          marker.setPopupContent(this.createDepartmentDetailPopup(dept, employees, vehicles));
        });
      });
    });
  }

  private createDepartmentLoadingPopup(dept: Department): string {
    return `
      <div style="text-align:center; min-width: 280px;">
        <strong style="font-size: 16px; color: #2563eb;">${dept.name}</strong><br>
        <span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">DEPARTMENT</span><br><br>
        <div style="color: #666; font-size: 14px;">
          <div style="padding: 10px;">Loading details...</div>
        </div>
      </div>
    `;
  }

  private createDepartmentDetailPopup(dept: Department, employees: any[], vehicles: any[]): string {
    const availableEmployees = employees.filter((e: any) => e.available);
    const availableVehicles = vehicles.filter((v: any) => v.available);

    const employeesList = employees.length > 0
      ? employees.map((e: any) => `
          <div style="padding: 4px 0; border-bottom: 1px solid #e5e7eb;">
            <span style="font-weight: 500;">${e.firstName} ${e.lastName}</span>
            <span style="float: right; font-size: 11px; padding: 2px 6px; border-radius: 8px; background: ${e.available ? '#dcfce7' : '#fee2e2'}; color: ${e.available ? '#166534' : '#991b1b'};">
              ${e.available ? '✓ Available' : '✗ Busy'}
            </span>
          </div>
        `).join('')
      : '<div style="color: #9ca3af; font-style: italic;">No employees</div>';

    const vehiclesList = vehicles.length > 0
      ? vehicles.map((v: any) => `
          <div style="padding: 4px 0; border-bottom: 1px solid #e5e7eb;">
            <div style="font-weight: 500;">🚛 ${v.reference}</div>
            <div style="font-size: 12px; color: #6b7280;">
              Plate: ${v.plate} | Fill: ${v.fillLevel}%
            </div>
            <span style="font-size: 11px; padding: 2px 6px; border-radius: 8px; background: ${v.available ? '#dcfce7' : '#fee2e2'}; color: ${v.available ? '#166534' : '#991b1b'};">
              ${v.available ? '✓ Available' : '✗ In Use'}
            </span>
          </div>
        `).join('')
      : '<div style="color: #9ca3af; font-style: italic;">No vehicles</div>';

    return `
      <div style="text-align:center; min-width: 320px; max-width: 400px;">
        <strong style="font-size: 16px; color: #2563eb;">${dept.name}</strong><br>
        <span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">DEPARTMENT</span>
        <br><br>
        <div style="display: flex; gap: 10px; margin: 10px 0; justify-content: center;">
          <div style="background: #f3f4f6; padding: 8px 12px; border-radius: 8px; flex: 1;">
            <div style="font-size: 20px; font-weight: bold; color: #2563eb;">${availableEmployees.length}/${employees.length}</div>
            <div style="font-size: 11px; color: #6b7280;">Available Staff</div>
          </div>
          <div style="background: #f3f4f6; padding: 8px 12px; border-radius: 8px; flex: 1;">
            <div style="font-size: 20px; font-weight: bold; color: #16a34a;">${availableVehicles.length}/${vehicles.length}</div>
            <div style="font-size: 11px; color: #6b7280;">Available Vehicles</div>
          </div>
        </div>
        <div style="text-align: left; margin-top: 12px;">
          <div style="font-weight: 600; color: #374151; margin-bottom: 6px; font-size: 13px;">
            👥 Employees (${employees.length})
          </div>
          <div style="max-height: 150px; overflow-y: auto; font-size: 12px;">
            ${employeesList}
          </div>
        </div>
        <div style="text-align: left; margin-top: 12px;">
          <div style="font-weight: 600; color: #374151; margin-bottom: 6px; font-size: 13px;">
            🚛 Vehicles (${vehicles.length})
          </div>
          <div style="max-height: 150px; overflow-y: auto; font-size: 12px;">
            ${vehiclesList}
          </div>
        </div>
        <div style="text-align: left; margin-top: 12px; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px;">
          📍 ${dept.latitude?.toFixed(4)}, ${dept.longitude?.toFixed(4)}
        </div>
      </div>
    `;
  }

  private createDepartmentIcon(L: any) {
    const svgIcon = `
      <svg width="50" height="60" viewBox="0 0 50 60" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="25" cy="57" rx="10" ry="3" fill="rgba(0,0,0,0.3)"/>
        <rect x="10" y="20" width="30" height="35" rx="2" fill="#2563eb" stroke="#1e40af" stroke-width="2"/>
        <rect x="13" y="23" width="5" height="5" rx="1" fill="#dbeafe"/>
        <rect x="22.5" y="23" width="5" height="5" rx="1" fill="#dbeafe"/>
        <rect x="32" y="23" width="5" height="5" rx="1" fill="#dbeafe"/>
        <rect x="13" y="31" width="5" height="5" rx="1" fill="#dbeafe"/>
        <rect x="22.5" y="31" width="5" height="5" rx="1" fill="#dbeafe"/>
        <rect x="32" y="31" width="5" height="5" rx="1" fill="#dbeafe"/>
        <rect x="13" y="39" width="5" height="5" rx="1" fill="#dbeafe"/>
        <rect x="22.5" y="39" width="5" height="5" rx="1" fill="#dbeafe"/>
        <rect x="32" y="39" width="5" height="5" rx="1" fill="#dbeafe"/>
        <rect x="20" y="47" width="10" height="8" rx="1" fill="#1e40af"/>
        <circle cx="27" cy="51" r="0.8" fill="#fbbf24"/>
        <path d="M 8 20 L 25 8 L 42 20 Z" fill="#1e40af" stroke="#1e3a8a" stroke-width="1.5"/>
        <line x1="25" y1="8" x2="25" y2="2" stroke="#475569" stroke-width="1.5"/>
        <path d="M 25 2 L 32 4 L 32 7 L 25 5 Z" fill="#ef4444" stroke="#dc2626" stroke-width="0.5"/>
        <circle cx="40" cy="12" r="8" fill="white" stroke="#2563eb" stroke-width="2"/>
        <text x="40" y="16" font-size="10" text-anchor="middle" fill="#2563eb" font-weight="bold">D</text>
      </svg>
    `;
    return this.L.divIcon({
      html: svgIcon,
      className: 'custom-department-icon',
      iconSize: [50, 60],
      iconAnchor: [25, 60],
      popupAnchor: [0, -60]
    });
  }

  // ============ COLOR HELPERS ============

  private getColorForFillLevel(fillLevel: number): string {
    if (fillLevel < 25) {
      return this.interpolateColor('#10b981', '#22c55e', fillLevel / 25);
    } else if (fillLevel < 50) {
      return this.interpolateColor('#22c55e', '#eab308', (fillLevel - 25) / 25);
    } else if (fillLevel < 75) {
      return this.interpolateColor('#eab308', '#f97316', (fillLevel - 50) / 25);
    } else {
      return this.interpolateColor('#f97316', '#ef4444', (fillLevel - 75) / 25);
    }
  }

  private interpolateColor(color1: string, color2: string, factor: number): string {
    const c1 = this.hexToRgb(color1);
    const c2 = this.hexToRgb(color2);
    const r = Math.round(c1.r + factor * (c2.r - c1.r));
    const g = Math.round(c1.g + factor * (c2.g - c1.g));
    const b = Math.round(c1.b + factor * (c2.b - c1.b));
    return `rgb(${r}, ${g}, ${b})`;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  private getDarkerColor(color: string): string {
    if (color.startsWith('rgb')) {
      const matches = color.match(/\d+/g);
      if (matches && matches.length >= 3) {
        const r = Math.max(0, parseInt(matches[0]) - 40);
        const g = Math.max(0, parseInt(matches[1]) - 40);
        const b = Math.max(0, parseInt(matches[2]) - 40);
        return `rgb(${r}, ${g}, ${b})`;
      }
    }
    return color;
  }
  showDepartmentRoutesWithPolylines(departmentId: string) {
  console.log(`🗺️ Loading all vehicle routes for department ${departmentId}`);
  
  this.routeService.getDepartmentRoutesWithPolylines(departmentId).subscribe({
    next: (routesData: any[]) => {
      console.log('✅ Received routes:', routesData);
      this.drawAllVehicleRoutes(routesData);
      
      // ✅ ALSO load available vehicles
      this.availableVehicles = routesData.map(route => ({
        vehicleId: route.vehicleId,
        binCount: route.bins.length
      }));
      
      if (this.availableVehicles.length > 0) {
        this.selectedVehicleId = this.availableVehicles[0].vehicleId;
      }
    },
    error: (error: any) => {
      console.error('❌ Failed to load routes:', error);
      this.showNotification('Failed to load routes');
    }
  });
}


  private drawAllVehicleRoutes(routesData: any[]) {
    this.clearAllRoutes();

    if (routesData.length === 0) {
      this.showNotification('No routes available');
      return;
    }

    const colors = ['#2563eb', '#ef4444', '#16a34a', '#f97316', '#8b5cf6', '#ec4899'];

    routesData.forEach((routeData, index) => {
      const vehicleId = routeData.vehicleId;
      const bins = routeData.bins;
      const polyline = routeData.polyline;
      const color = colors[index % colors.length];

      console.log(`🚛 Drawing route for vehicle ${vehicleId}: ${bins.length} bins`);

      // Draw polyline
      if (polyline && polyline.length > 0) {
        const latLngs = polyline.map((point: any) => [point[0], point[1]]);

        const line = this.L.polyline(latLngs, {
          color: color,
          weight: 5,
          opacity: 0.7,
          dashArray: '5, 5'
        }).addTo(this.map);

        this.routePolylines.set(vehicleId, line);
      }

      // Add bin markers
      bins.forEach((bin: any, stopIndex: number) => {
        const marker = this.L.marker([bin.latitude, bin.longitude], {
          title: `Stop ${stopIndex + 1} - Vehicle ${vehicleId}`
        })
          .bindPopup(`🚛 Vehicle: ${vehicleId}<br>Stop #${stopIndex + 1}<br>Bin: ${bin.id}`)
          .addTo(this.map);

        this.routeMarkers.push(marker);
      });
    });

    // Fit map to all routes
    if (this.routePolylines.size > 0) {
      const allBounds = Array.from(this.routePolylines.values())
        .map((p: any) => p.getBounds());

      if (allBounds.length > 0) {
        const combinedBounds = allBounds[0];
        allBounds.slice(1).forEach(b => combinedBounds.extend(b));
        this.map.fitBounds(combinedBounds);
      }
    }

    this.showNotification(`📍 Showing ${routesData.length} vehicle routes`);
  }
  loadAvailableVehicles(departmentId: string) {
    console.log('🚛 Loading available vehicles...');

    // We'll get vehicles from the routes endpoint
    this.routeService.getDepartmentRoutesWithPolylines(departmentId).subscribe({
      next: (routesData: any[]) => {
        this.availableVehicles = routesData.map(route => ({
          vehicleId: route.vehicleId,
          binCount: route.bins.length
        }));

        if (this.availableVehicles.length > 0) {
          this.selectedVehicleId = this.availableVehicles[0].vehicleId;
        }

        console.log('✅ Loaded vehicles:', this.availableVehicles);
      },
      error: (error: any) => {
        console.error('❌ Failed to load vehicles:', error);
      }
    });
  }

  executeSelectedVehicle() {
    if (!this.selectedVehicleId) {
      this.showNotification('Please select a vehicle');
      return;
    }

    console.log(`🚀 Executing route for vehicle ${this.selectedVehicleId}`);

    this.routeService.executeManagedRoute('6920266d0b737026e2496c54', this.selectedVehicleId).subscribe({
      next: (data: any) => {
        console.log('✅ Route started:', data);
        this.showNotification(`Route started for vehicle ${this.selectedVehicleId}`);
      },
      error: (error: any) => {
        console.error('❌ Failed to start route:', error);
        this.showNotification('Failed to start route');
      }
    });
  }

  executeAllVehicles() {
    console.log('🚀🚀 Executing routes for ALL vehicles');

    this.routeService.executeAllManagedRoutes('6920266d0b737026e2496c54').subscribe({
      next: (data: any) => {
        console.log('✅ All routes started:', data);
        const count = data.totalVehicles || 0;
        this.showNotification(`Started routes for ${count} vehicles!`);
      },
      error: (error: any) => {
        console.error('❌ Failed to start routes:', error);
        this.showNotification('Failed to start routes');
      }
    });
  }
}
