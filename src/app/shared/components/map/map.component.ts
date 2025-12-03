import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { BinService } from '../../../services/bin-service';
import { DepartmentService } from '../../../services/department.service';
import { WebSocketService } from '../../../core/services';
import { FormsModule } from '@angular/forms';
import {
  Bin,
  Department,
  TruckPositionUpdate,
  RouteProgressUpdate,
  RouteCompletionEvent
} from '../../../models/websocket-dtos';
import { RouteService } from '../../../services/route.service';
import { IncidentService, Incident } from '../../../services/incident.service';

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
  private routeGenerationSub?: Subscription;

  // WebSocket subscriptions
  private wsSubscription?: Subscription;
  private truckPositionSub?: Subscription;
  private routeProgressSub?: Subscription;
  private routeCompletionSub?: Subscription;
  private incidentSub?: Subscription;
  isAddingBin: boolean = false;

  private vehicleMarkers: Map<string, any> = new Map();
  private routePolylines: Map<string, any> = new Map();
  activeTrucks: Map<string, any> = new Map();
  private routeMarkers: any[] = [];

  private incidentMarkers: Map<string, any> = new Map();
  private incidentCircles: Map<string, any> = new Map();
  incidents: Incident[] = [];
  isReportingIncident: boolean = false;
  private routeUpdateSub?: Subscription;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private binService: BinService,
    private webSocketService: WebSocketService,
    private departmentService: DepartmentService,
    private routeService: RouteService,
    private incidentService: IncidentService
  ) { }

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.L = await import('leaflet');
      this.initMap(this.L);
      this.loadDepartments(this.L);
      this.loadBins(this.L);

      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
        }
      }, 300);

      this.webSocketService.connect('http://localhost:8080/ws');
      this.setupWebSocketListeners();
      this.loadActiveVehicles();
      this.loadActiveIncidents();
      this.subscribeToRouteGeneration();

      // Event listeners
      window.addEventListener('vehicle-started', (e: any) => {
        const { vehicleId } = e.detail;
        this.activeTrucks.set(vehicleId, {
          vehicleId: vehicleId,
          progress: 0
        });
      });

      window.addEventListener('show-all-routes', (e: any) => {
        const departmentId = e.detail?.departmentId;
        if (departmentId) {
          this.loadAvailableRoutes(departmentId);
        }
      });

      window.addEventListener('clear-all-routes', () => {
        this.clearAllRoutes();
      });

      window.addEventListener('routes-generated', (e: any) => {
        const departmentId = e.detail?.departmentId || '6920266d0b737026e2496c54';
        this.loadAvailableRoutes(departmentId);
      });

      window.addEventListener('map-modal-opened', () => {
        setTimeout(() => {
          if (this.map) {
            this.map.invalidateSize();
          }
        }, 100);
        setTimeout(() => {
          if (this.map) {
            this.map.invalidateSize();
          }
        }, 300);
        setTimeout(() => {
          if (this.map) {
            this.map.invalidateSize();
          }
        }, 500);
      });

      window.addEventListener('resolve-incident', (e: any) => {
        const incidentId = e.detail?.id;
        if (incidentId) {
          this.resolveIncident(incidentId);
        }
      });
    }
  }

  ngOnDestroy() {
    this.wsSubscription?.unsubscribe();
    this.truckPositionSub?.unsubscribe();
    this.routeProgressSub?.unsubscribe();
    this.routeCompletionSub?.unsubscribe();
    this.incidentSub?.unsubscribe();
    this.webSocketService.disconnect();
    this.routeGenerationSub?.unsubscribe();
    this.routeUpdateSub?.unsubscribe();
  }

  getVehicleName(vehicleId: string): string {
    const vehicle = this.availableVehicles.find((v: any) => v.id === vehicleId || v.vehicleId === vehicleId || v.routeId === vehicleId);
    return vehicle?.reference || `Route ${vehicleId.substring(vehicleId.lastIndexOf('-') + 1)}`;
  }

  // ============ WEBSOCKET LISTENERS ============
  private setupWebSocketListeners() {
    this.wsSubscription = this.webSocketService.getBinUpdates().subscribe(
      (updatedBin: Bin) => this.updateBinMarker(updatedBin)
    );

        this.truckPositionSub = this.webSocketService.getTruckPositionUpdates().subscribe(
      (update: TruckPositionUpdate) => {
        // Auto-register vehicle if not already in activeTrucks (handles page refresh)
        if (!this.activeTrucks.has(update.vehicleId)) {
          this.activeTrucks.set(update.vehicleId, {
            vehicleId: update.vehicleId,
            progress: update.progressPercent || 0,
            latitude: update.latitude,
            longitude: update.longitude,
            lastPolylineRefresh: 0
          });
          // Load the route polyline for this vehicle
          this.routeService.getActiveRoute(update.vehicleId).subscribe({
            next: (route: any) => {
              if (route && route.fullRoutePolyline) {
                this.drawRoutePolyline(route.fullRoutePolyline, update.vehicleId);
              }
            },
            error: () => { /* Handle silently */ }
          });
        }
        this.updateTruckPosition(update.vehicleId, update.latitude, update.longitude, update.progressPercent);
        this.refreshActiveRoutePolyline(update.vehicleId);
      }
    );


    this.routeProgressSub = this.webSocketService.getRouteProgressUpdates().subscribe(
      (update: RouteProgressUpdate) => {
        // Auto-register vehicle if not already in activeTrucks
        if (!this.activeTrucks.has(update.vehicleId)) {
          this.activeTrucks.set(update.vehicleId, {
            vehicleId: update.vehicleId,
            progress: 0,
            lastPolylineRefresh: 0
          });
        }
        this.showRouteProgress(update.vehicleId, update.currentStop, update.totalStops, update.vehicleFillLevel);
      }
    );

    this.routeCompletionSub = this.webSocketService.getRouteCompletionUpdates().subscribe(
      (event: RouteCompletionEvent) => {
        this.onRouteComplete(event.vehicleId, event.binsCollected);
      }
    );

    this.incidentSub = this.webSocketService.getIncidentUpdates().subscribe(
      (incident) => {
        this.updateIncidentMarker(incident as unknown as Incident);
      }
    );

    this.routeUpdateSub = this.webSocketService.getRouteUpdates().subscribe(
      (routeUpdate) => {
        this.handleRouteUpdate(routeUpdate);
      }
    );
  }

  private subscribeToRouteGeneration(): void {
    this.routeGenerationSub = this.webSocketService.getRouteGenerationUpdates().subscribe({
      next: (event) => {
        const departmentId = event.departmentId || '6920266d0b737026e2496c54';
        const routeCount = event.routeCount || 0;
        if (routeCount > 0) {
          this.loadAvailableRoutes(departmentId);
          this.showNotification(`${routeCount} new route(s) available!`);
        }
      },
      error: () => { /* Handle silently */ }
    });
  }

  getActiveTrucksArray() {
    return Array.from(this.activeTrucks.entries()).map(([vehicleId, truck]) => ({
      vehicleId,
      progress: truck.progress || 0
    }));
  }

  // ============ TRUCK VISUALIZATION ============
  private updateTruckPosition(vehicleId: string, lat: number, lng: number, progress: number) {
    const truck = this.activeTrucks.get(vehicleId);
    if (truck) {
      truck.progress = progress;
      truck.latitude = lat;
      truck.longitude = lng;
    }

    let marker = this.vehicleMarkers.get(vehicleId);
    if (!marker) {
      const truckIcon = this.L.divIcon({
        html: `
          <div style="width: 52px; height: 52px; border-radius: 50%; background: linear-gradient(145deg, #2563eb 0%, #3b82f6 100%); display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px rgba(37,99,235,0.25); border: 3px solid white; position: relative;">
            <div style="font-size:28px; z-index:2;">🚛</div>
            <div class="truck-fill-indicator" style="position: absolute; bottom: 7px; left: 11px; right: 11px; height: 0px; background: linear-gradient(180deg, #4ade80 0%, #22d3ee 100%); border-radius: 3px; transition: height 0.7s, background 0.7s; z-index:1;"></div>
            <div class="truck-fill-percent" style="position: absolute; top: 5px; right: 5px; font-size: 10px; color: white; font-weight: 800; background: rgba(0,0,0,0.75); padding: 3px 4px; border-radius: 4px; z-index:3;">0%</div>
          </div>
        `,
        className: '',
        iconSize: [52, 52],
        iconAnchor: [26, 26]
      });
      marker = this.L.marker([lat, lng], { icon: truckIcon }).addTo(this.map);
      marker.bindPopup(`🚛 Vehicle ${vehicleId.substring(0, 8)}<br>Progress: 0%`);
      this.vehicleMarkers.set(vehicleId, marker);
    } else {
      marker.setLatLng([lat, lng]);
    }

    this.updateTruckProgressIndicator(vehicleId, progress);
  }

  private updateTruckProgressIndicator(vehicleId: string, progress: number) {
    const marker = this.vehicleMarkers.get(vehicleId);
    if (!marker) return;

    const fillLevel = progress;
    const fillHeight = Math.max(0, fillLevel * 0.24);
    const element = marker.getElement();

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

      marker.setPopupContent(`🚛 Vehicle ${vehicleId.substring(0, 8)}<br>Progress: ${progress.toFixed(1)}%`);
    }
  }

  private showRouteProgress(vehicleId: string, currentStop: number, totalStops: number, fillLevel: number) {
    this.updateTruckProgressIndicator(vehicleId, fillLevel);
  }

  private onRouteComplete(vehicleId: string, binsCollected: number) {
    const marker = this.vehicleMarkers.get(vehicleId);
    if (marker) {
      const element = marker.getElement();
      if (element) {
        element.style.animation = 'bounce 1s ease-out';
      }

      // ✅ NEW: Move truck to department
      const truck = this.activeTrucks.get(vehicleId);
      if (truck) {
        this.routeService.getActiveVehicles().subscribe({
          next: (vehicles: any[]) => {
            const activeVehicle = vehicles.find(v => v.vehicleId === vehicleId);
            if (activeVehicle && activeVehicle.departmentId) {
              this.departmentService.getDepartmentById(activeVehicle.departmentId).subscribe({
                next: (dept: any) => {
                  marker.setLatLng([dept.latitude, dept.longitude]);
                  truck.latitude = dept.latitude;
                  truck.longitude = dept.longitude;
                  truck.progress = 100;
                },
                error: () => {
                  console.warn(`Could not find department for ${vehicleId}`);
                }
              });
            }
          }
        });
      }

      setTimeout(() => {
        if (element) element.style.animation = 'none';

        setTimeout(() => {
          if (this.map.hasLayer(marker)) {
            this.map.removeLayer(marker);
          }
          this.vehicleMarkers.delete(vehicleId);
          this.activeTrucks.delete(vehicleId);
          this.clearAllRoutes();
        }, 10000);
      }, 1000);
    }

    this.showNotification(`✅ Route completed: ${binsCollected} bins collected! Truck returned to department.`);
}


  clearAllRoutes() {
    this.vehicleMarkers.forEach(marker => {
      this.map.removeLayer(marker);
    });
    this.vehicleMarkers.clear();

    this.routePolylines.forEach(p => this.map.removeLayer(p));
    this.routePolylines.clear();

    this.routeMarkers.forEach(m => this.map.removeLayer(m));
    this.routeMarkers = [];

    this.activeTrucks.clear();
  }

  private showNotification(message: string) {
    // Could implement toast notification UI here
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

    this.map.on('click', (e: any) => {
      if (this.isReportingIncident) {
        this.reportIncidentAt(e.latlng.lat, e.latlng.lng);
      } else if (this.isAddingBin) {
        this.addNewBinAt(e.latlng.lat, e.latlng.lng);
      }
    });
  }

  private addNewBinAt(lat: number, lng: number) {
    const newBinId = `BIN-${Date.now()}`;
    const newBin: Bin = {
      id: newBinId,
      latitude: lat,
      longitude: lng,
      fillLevel: Math.random() * 100,
      status: 'normal'
    };

    this.binService.createBin(newBin).subscribe({
      next: (createdBin: Bin) => {
        this.addBinMarker(this.L, createdBin);
        this.showNotification(`Bin created at (${lat.toFixed(2)}, ${lng.toFixed(2)})`);
      },
      error: () => {
        this.showNotification('Failed to create bin');
      }
    });
  }

  private saveDepartmentLocation(dept: Department) {
    this.departmentService.updateDepartment(dept.id, dept).subscribe({
      next: (updated: Department) => {
        this.showNotification(`Saved ${dept.name} at (${dept.latitude?.toFixed(4)}, ${dept.longitude?.toFixed(4)})`);
      },
      error: () => {
        this.showNotification('Failed to save department location');
      }
    });
  }

  isMovingDepartment: boolean = false;
  selectedDepartmentId: string | null = null;
  selectedDepartmentMarker: any = null;

  toggleMovingDepartment() {
    this.isMovingDepartment = !this.isMovingDepartment;
    if (this.isMovingDepartment) {
      this.isAddingBin = false;
      this.isReportingIncident = false;
      this.map.getContainer().style.cursor = 'move';
    } else {
      this.isMovingDepartment = false;
      this.selectedDepartmentId = null;
      this.map.getContainer().style.cursor = 'grab';
    }
  }

  // ============ BIN VISUALIZATION ============
  private loadBins(L: any) {
    this.binService.getAllBins().subscribe((bins: Bin[]) => {
      bins.forEach(bin => this.addBinMarker(L, bin));
    });
  }

  private addBinMarker(L: any, bin: Bin) {
    if (!bin.latitude || !bin.longitude ||
      isNaN(bin.latitude) || isNaN(bin.longitude)) {
      console.warn(`⚠️ Skipping bin ${bin.id} - invalid coordinates:`, bin.latitude, bin.longitude);
      return;
    }

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
      
      // Get element before updating to apply smooth transition
      const element = existingMarker.getElement();
      if (element) {
        // Add transition for smooth icon updates
        element.style.transition = 'opacity 0.15s ease-in-out, transform 0.15s ease-in-out';
      }
      
      // Update icon
      existingMarker.setIcon(icon);
      
      // Only update popup content if popup is not currently open (prevents flicker)
      if (!existingMarker.isPopupOpen()) {
        existingMarker.setPopupContent(this.createPopupContent(bin, color));
      }
      
      // Subtle pulse animation only for significant fill level changes
      const newElement = existingMarker.getElement();
      if (newElement) {
        newElement.style.transition = 'opacity 0.15s ease-in-out, transform 0.15s ease-in-out';
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
          <div style="background: e0e0e0; border-radius: 10px; height: 20px; width: 100%; position: relative;">
            <div style="background: ${color}; border-radius: 10px; height: 100%; width: ${bin.fillLevel}%; transition: width 0.3s;"></div>
          </div>
          <strong>${bin.fillLevel}%</strong> Full
        </div>
        Status: <span style="color: ${color}; font-weight: bold;">${bin.status}</span><br>
        <small style="color: #666;">Last updated: ${new Date().toLocaleTimeString()}</small>
      </div>
    `;
  }

  private createBinIcon(L: any, color: string, fillLevel: number) {
    const svgIcon = `
      <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="20" cy="48" rx="8" ry="2" fill="rgba(0,0,0,0.3)"/>
        <path d="M 12 18 L 10 45 Q 10 47 12 47 L 28 47 Q 30 47 30 45 L 28 18 Z" fill="${color}" stroke="#333" stroke-width="1.5"/>
        <rect x="8" y="15" width="24" height="4" rx="2" fill="${color}" stroke="#333" stroke-width="1.5"/>
        <rect x="16" y="12" width="8" height="3" rx="1.5" fill="#666" stroke="#333" stroke-width="1"/>
        <path d="M 12.5 45 - ${fillLevel * 0.25} L 11 45 Q 11 46 12 46 L 28 46 Q 29 46 29 45 L 27.5 45 - ${fillLevel * 0.25} Z" fill="${this.getDarkerColor(color)}" opacity="0.7"/>
        <text x="20" y="32" font-size="12" text-anchor="middle" fill="white" font-weight="bold">${fillLevel}</text>
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
        if (!dept.latitude || !dept.longitude ||
          isNaN(dept.latitude) || isNaN(dept.longitude)) {
          console.warn(`⚠️ Skipping department ${dept.id} - invalid coordinates:`, dept.latitude, dept.longitude);
          return;
        }

        const deptIcon = this.createDepartmentIcon(L);
        const marker = L.marker([dept.latitude, dept.longitude], {
          icon: deptIcon,
          draggable: true
        }).addTo(this.map);

        marker.on('dragstart', () => {
          if (this.isMovingDepartment) {
            this.selectedDepartmentId = dept.id;
            this.selectedDepartmentMarker = marker;
            this.map.getContainer().style.cursor = 'grabbing';
          }
        });

        marker.on('dragend', () => {
          if (this.isMovingDepartment && this.selectedDepartmentId === dept.id) {
            const newLatLng = marker.getLatLng();
            dept.latitude = newLatLng.lat;
            dept.longitude = newLatLng.lng;
            this.saveDepartmentLocation(dept);
            this.map.getContainer().style.cursor = 'move';
          }
        });

        marker.on('click', () => {
          this.loadDepartmentDetails(dept.id, marker);
        });

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
    const drivers = employees.filter((e: any) => e.role === 'DRIVER');
    const collectors = employees.filter((e: any) => e.role === 'COLLECTOR');
    const availableDrivers = drivers.filter((e: any) => e.available);
    const availableCollectors = collectors.filter((e: any) => e.available);
    
    const employeesList = employees.length > 0
      ? employees.map((e: any) => `
        <div style="padding: 4px 0; border-bottom: 1px solid #e5e7eb;">
          <span style="font-weight: 500;">${e.role === 'DRIVER' ? '🚛' : '🗑️'} ${e.firstName} ${e.lastName}</span>
          <span style="float: right; font-size: 10px; padding: 2px 6px; border-radius: 8px; background: ${e.role === 'DRIVER' ? '#dbeafe' : '#fef3c7'}; color: ${e.role === 'DRIVER' ? '#1e40af' : '#92400e'}; margin-right: 4px;">
            ${e.role}
          </span>
          <span style="float: right; font-size: 11px; padding: 2px 6px; border-radius: 8px; background: ${e.available ? '#dcfce7' : '#fee2e2'}; color: ${e.available ? '#166534' : '#991b1b'};">
            ${e.available ? 'Available' : 'Busy'}
          </span>
        </div>
      `).join('')
      : '<div style="color: #9ca3af; font-style: italic;">No employees</div>';

    const vehiclesList = vehicles.length > 0
      ? vehicles.map((v: any) => `
        <div style="padding: 4px 0; border-bottom: 1px solid #e5e7eb;">
          <div style="font-weight: 500;">🚛 ${v.reference}</div>
          <div style="font-size: 12px; color: #6b7280;">Plate: ${v.plate} | Fill: ${v.fillLevel || 0}%</div>
          <span style="font-size: 11px; padding: 2px 6px; border-radius: 8px; background: ${v.available ? '#dcfce7' : '#fee2e2'}; color: ${v.available ? '#166534' : '#991b1b'};">
            ${v.available ? 'Available' : 'In Use'}
          </span>
        </div>
      `).join('')
      : '<div style="color: #9ca3af; font-style: italic;">No vehicles</div>';

    const canDispatch = availableDrivers.length >= 1 && availableCollectors.length >= 1;

    return `
      <div style="text-align:center; min-width: 320px; max-width: 400px;">
        <strong style="font-size: 16px; color: #2563eb;">${dept.name}</strong><br>
        <span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">DEPARTMENT</span>
        <br><br>
        <div style="display: flex; gap: 8px; margin: 10px 0; justify-content: center; flex-wrap: wrap;">
          <div style="background: #f3f4f6; padding: 8px 12px; border-radius: 8px; flex: 1; min-width: 70px;">
            <div style="font-size: 18px; font-weight: bold; color: #2563eb;">${availableVehicles.length}/${vehicles.length}</div>
            <div style="font-size: 10px; color: #6b7280;">Vehicles</div>
          </div>
          <div style="background: #dbeafe; padding: 8px 12px; border-radius: 8px; flex: 1; min-width: 70px;">
            <div style="font-size: 18px; font-weight: bold; color: #1e40af;">${availableDrivers.length}/${drivers.length}</div>
            <div style="font-size: 10px; color: #6b7280;">🚛 Drivers</div>
          </div>
          <div style="background: #fef3c7; padding: 8px 12px; border-radius: 8px; flex: 1; min-width: 70px;">
            <div style="font-size: 18px; font-weight: bold; color: #92400e;">${availableCollectors.length}/${collectors.length}</div>
            <div style="font-size: 10px; color: #6b7280;">🗑️ Collectors</div>
          </div>
        </div>
        <div style="margin: 8px 0; padding: 6px; border-radius: 6px; background: ${canDispatch ? '#dcfce7' : '#fee2e2'}; color: ${canDispatch ? '#166534' : '#991b1b'}; font-size: 11px; font-weight: 600;">
          ${canDispatch ? '✅ Can dispatch (1+ driver, 1+ collector available)' : '⚠️ Need at least 1 driver + 1 collector to dispatch'}
        </div>
        <div style="text-align: left; margin-top: 12px;">
          <div style="font-weight: 600; color: #374151; margin-bottom: 6px; font-size: 13px;">👥 Employees (${employees.length})</div>
          <div style="max-height: 150px; overflow-y: auto; font-size: 12px;">${employeesList}</div>
        </div>
        <div style="text-align: left; margin-top: 12px;">
          <div style="font-weight: 600; color: #374151; margin-bottom: 6px; font-size: 13px;">🚛 Vehicles (${vehicles.length})</div>
          <div style="max-height: 150px; overflow-y: auto; font-size: 12px;">${vehiclesList}</div>
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
        <line x1="25" y1="18" x2="25" y2="22" stroke="#475569" stroke-width="1.5"/>
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

  // ============ ROUTE VISUALIZATION ============
  private loadAvailableRoutes(departmentId: string) {
    this.routeService.getAvailableRoutes(departmentId).subscribe({
      next: (routes: any[]) => {

        this.routePolylines.forEach((polyline, key) => {
          if (!this.activeTrucks.has(key)) {
            if (this.map.hasLayer(polyline)) {
              this.map.removeLayer(polyline);
            }
            this.routePolylines.delete(key);
          }
        });

        this.routeMarkers.forEach(m => {
          if (this.map.hasLayer(m)) {
            this.map.removeLayer(m);
          }
        });
        this.routeMarkers = [];

        if (routes.length === 0) {
          this.showNotification('No available routes');
          return;
        }

        this.drawAllVehicleRoutes(routes);

        this.availableVehicles = routes.map((route: any) => ({
          id: route.routeId,
          routeId: route.routeId,
          binCount: route.binCount || route.bins?.length || 0,
          reference: `Route ${route.routeId.substring(route.routeId.lastIndexOf('-') + 1)}`
        }));

        if (this.availableVehicles.length > 0) {
          this.selectedVehicleId = this.availableVehicles[0].id;
        }
      },
      error: () => {
        this.showNotification('Failed to load routes');
      }
    });
  }

  private drawAllVehicleRoutes(routesData: any[]) {
    this.routePolylines.forEach(p => {
      if (this.map.hasLayer(p)) {
        this.map.removeLayer(p);
      }
    });
    this.routePolylines.clear();

    this.routeMarkers.forEach(m => {
      if (this.map.hasLayer(m)) {
        this.map.removeLayer(m);
      }
    });
    this.routeMarkers = [];

    if (routesData.length === 0) {
      this.showNotification('No routes available');
      return;
    }

    const colors = ['#2563eb', '#ef4444', '#16a34a', '#f97316', '#8b5cf6', '#ec4899'];
    const routeNames = ['Route 1', 'Route 2', 'Route 3', 'Route 4', 'Route 5', 'Route 6'];

    routesData.forEach((routeData, index) => {
      const routeId = routeData.routeId;
      const bins = routeData.bins;
      const polyline = routeData.polyline;
      const color = colors[index % colors.length];
      const routeName = routeNames[index % routeNames.length];

      if (polyline && polyline.length > 0) {
        const latLngs = polyline.map((point: any) => {
          if (typeof point === 'object' && point.latitude !== undefined && point.longitude !== undefined) {
            return [point.latitude, point.longitude];
          } else if (Array.isArray(point) && point.length >= 2) {
            return [point[0], point[1]];
          }
          return null;
        }).filter((point: any) => point !== null);

        if (latLngs.length === 0) {
          return;
        }

        const line = this.L.polyline(latLngs, {
          color: color,
          weight: 5,
          opacity: 0.7,
          dashArray: '5, 5'
        }).addTo(this.map);

        this.routePolylines.set(routeId, line);

        if (latLngs.length > 0) {
          const startPoint = latLngs[0];
          const labelIcon = this.L.divIcon({
            html: `
              <div style="background: ${color}; color: white; padding: 6px 12px; border-radius: 20px; font-weight: bold; font-size: 13px; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.3); border: 2px solid white;">
                ${routeName} (${bins.length} bins)
              </div>
            `,
            className: '',
            iconSize: [120, 30],
            iconAnchor: [60, 15]
          });
          const labelMarker = this.L.marker(startPoint, { icon: labelIcon }).addTo(this.map);
          this.routeMarkers.push(labelMarker);
        }
      }

      bins.forEach((bin: any, stopIndex: number) => {
        const marker = this.L.marker([bin.latitude, bin.longitude], {
          title: `Stop ${stopIndex + 1} - ${routeName}`
        })
          .bindPopup(`📍 ${routeName}<br>Stop #${stopIndex + 1}/${bins.length}<br>Bin: ${bin.id}`)
          .addTo(this.map);
        this.routeMarkers.push(marker);
      });
    });

    this.showNotification(`📍 Showing ${routesData.length} routes`);
  }

  executeSelectedVehicle() {
    if (!this.selectedVehicleId) {
      this.showNotification('Please select a vehicle');
      return;
    }

    this.activeTrucks.set(this.selectedVehicleId, {
      vehicleId: this.selectedVehicleId,
      progress: 0
    });

    this.routeService.executeManagedRoute('6920266d0b737026e2496c54', this.selectedVehicleId).subscribe({
      next: () => {
        this.showNotification(`Route started for ${this.selectedVehicleId}`);
      },
      error: () => {
        this.activeTrucks.delete(this.selectedVehicleId);
        this.showNotification('Failed to start route');
      }
    });
  }

  executeAllAvailableVehicles() {
    const availableVehicles = this.getAvailableVehiclesOnly();
    if (availableVehicles.length === 0) {
      this.showNotification('No available vehicles!');
      return;
    }

    availableVehicles.forEach(vehicle => {
      const vId = vehicle.id || vehicle.routeId;
      this.activeTrucks.set(vId, {
        vehicleId: vId,
        progress: 0,
        lastPolylineRefresh: 0
      });

      this.routeService.executeManagedRoute('6920266d0b737026e2496c54', vId).subscribe({
        next: () => { /* Route started successfully */ },
        error: () => {
          this.activeTrucks.delete(vId);
        }
      });
    });

    this.showNotification(`Started routes for ${availableVehicles.length} vehicles!`);
  }

  getAvailableVehiclesOnly(): any[] {
    return this.availableVehicles.filter((vehicle: any) => {
      const vId = vehicle.id || vehicle.routeId;
      return !this.activeTrucks.has(vId);
    });
  }

  private loadActiveVehicles() {
    this.routeService.getActiveVehicles().subscribe({
      next: (activeVehicles: any[]) => {
        activeVehicles.forEach(vehicle => {
          const vehicleId = vehicle.vehicleId;

           this.activeTrucks.set(vehicleId, {
            vehicleId: vehicleId,
            progress: vehicle.fillLevel || 0,
            latitude: vehicle.latitude,
            longitude: vehicle.longitude,
            lastPolylineRefresh: 0
          });

          if (vehicle.latitude && vehicle.longitude) {
            this.updateTruckPosition(
              vehicleId,
              vehicle.latitude,
              vehicle.longitude,
              vehicle.fillLevel || 0
            );
          }

          if (vehicle.activeRouteId) {
            this.routeService.getActiveRoute(vehicleId).subscribe({
              next: (route: any) => {
                if (route && route.fullRoutePolyline) {
                  this.drawRoutePolyline(route.fullRoutePolyline, vehicleId);
                }
              },
              error: () => { /* Handle silently */ }
            });
          }
        });

        if (activeVehicles.length > 0) {
          this.showNotification(`Restored ${activeVehicles.length} active vehicle(s)`);
        }
      },
      error: () => { /* Handle silently */ }
    });
  }

  private drawRoutePolyline(polyline: any[], vehicleId?: string) {
    if (!polyline || polyline.length === 0) {
      return;
    }

    const latLngs = polyline.map((point: any) => {
      if (typeof point === 'object' && point.latitude !== undefined && point.longitude !== undefined) {
        return [point.latitude, point.longitude];
      } else if (Array.isArray(point) && point.length >= 2) {
        return [point[0], point[1]];
      }
      return null;
    }).filter((point: any) => point !== null);

    if (latLngs.length === 0) {
      return;
    }

    const routeLine = this.L.polyline(latLngs, {
      color: '#10b981',
      weight: 8,
      opacity: 1.0,
      dashArray: ''
    }).addTo(this.map);

    if (vehicleId) {
      this.routePolylines.set(vehicleId, routeLine);
    }

    if (latLngs.length > 0) {
      this.map.fitBounds(latLngs, { padding: [50, 50] });
    }
  }

  private getVehicleColor(vehicleId: string): string {
    const colors = ['#2563eb', '#ef4444', '#16a34a', '#f97316', '#8b5cf6', '#ec4899'];
    const hash = vehicleId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  // ============ INCIDENT MANAGEMENT ============
  private loadActiveIncidents() {
    this.incidentService.getActiveIncidents().subscribe({
      next: (incidents: Incident[]) => {
        this.incidents = incidents;
        incidents.forEach(incident => {
          this.addIncidentMarker(incident);
        });
      },
      error: () => { /* Handle silently */ }
    });
  }

  private addIncidentMarker(incident: Incident) {
    if (incident.type !== 'ROAD_BLOCK') {
      return;
    }

    if (!incident.latitude || !incident.longitude ||
      isNaN(incident.latitude) || isNaN(incident.longitude)) {
      console.warn(`⚠️ Skipping incident ${incident.id} - invalid coordinates:`, incident.latitude, incident.longitude);
      return;
    }

    const incidentIcon = this.L.divIcon({
      html: `
        <div style="width: 40px; height: 40px; border-radius: 50%; background: #ef4444; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(239,68,68,0.5); border: 3px solid white; animation: pulse 2s infinite;">
          <span style="font-size: 24px;">🚨</span>
        </div>
      `,
      className: 'incident-marker',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    const marker = this.L.marker([incident.latitude, incident.longitude], {
      icon: incidentIcon
    }).addTo(this.map);

    marker.bindPopup(`
      <div style="text-align: center; min-width: 200px;">
        <strong style="color: #ef4444;">🚨 Road Block</strong><br>
        <div style="margin: 8px 0; font-size: 12px; color: #666;">
          ${incident.description || 'Road blocked'}
        </div>
        <div style="font-size: 11px; color: #999;">
          Radius: ${incident.radiusKm}km<br>
          Reported: ${new Date(incident.createdAt!).toLocaleTimeString()}
        </div>
        <button onclick="resolveIncident('${incident.id}')" style="margin-top: 8px; padding: 6px 12px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">
          Resolve ✓
        </button>
      </div>
    `);

    this.incidentMarkers.set(incident.id!, marker);

    const radiusMeters = Math.min(incident.radiusKm, 0.08) * 1000;
    const circle = this.L.circle(
      [incident.latitude, incident.longitude],
      {
        radius: radiusMeters,
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.15,
        weight: 3,
        dashArray: '5, 5'
      }
    ).addTo(this.map);

    marker.bindPopup(`
      <div style="text-align: center; min-width: 200px;">
        <strong style="color: #ef4444;">🚧 Road Block</strong><br>
        <div style="margin: 8px 0; font-size: 12px; color: #666;">
          ${incident.description || 'Road blocked'}
        </div>
        <div style="font-size: 11px; color: #999;">
          Effective Radius: ${Math.min(incident.radiusKm, 0.08).toFixed(2)}km (${(Math.min(incident.radiusKm, 0.08) * 1000).toFixed(0)}m)<br>
          Reported: ${new Date(incident.createdAt!).toLocaleTimeString()}
        </div>
        <button onclick="resolveIncident('${incident.id}')" style="margin-top: 8px; padding: 6px 12px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">
          Resolve ✓
        </button>
      </div>
    `);

    this.incidentCircles.set(incident.id!, circle);
  }

  private updateIncidentMarker(incident: Incident) {
    if (incident.status === 'RESOLVED') {
      const marker = this.incidentMarkers.get(incident.id!);
      const circle = this.incidentCircles.get(incident.id!);

      if (marker) {
        this.map.removeLayer(marker);
        this.incidentMarkers.delete(incident.id!);
      }

      if (circle) {
        this.map.removeLayer(circle);
        this.incidentCircles.delete(incident.id!);
      }

      this.incidents = this.incidents.filter(i => i.id !== incident.id);
      this.showNotification(`✅ Incident resolved!`);
    } else if (!this.incidentMarkers.has(incident.id!)) {
      this.incidents.push(incident);
      this.addIncidentMarker(incident);
      this.showNotification(`🚨 New road block reported!`);
    }
  }

  toggleIncidentReporting() {
    this.isReportingIncident = !this.isReportingIncident;
    if (this.isReportingIncident) {
      this.map.getContainer().style.cursor = 'crosshair';
      this.showNotification('Click on map to report road block');
    } else {
      this.map.getContainer().style.cursor = '';
    }
  }

  private reportIncidentAt(lat: number, lng: number) {
    const description = prompt('Describe the road block:', 'Road blocked due to construction');
    if (!description) {
      this.isReportingIncident = false;
      this.map.getContainer().style.cursor = '';
      return;
    }

    this.incidentService.reportRoadBlock(lat, lng, 0.5, description).subscribe({
      next: () => {
        this.showNotification('Road block reported successfully!');
        this.isReportingIncident = false;
        this.map.getContainer().style.cursor = '';
      },
      error: () => {
        this.showNotification('Failed to report incident');
        this.isReportingIncident = false;
        this.map.getContainer().style.cursor = '';
      }
    });
  }

  // ============ REROUTE HANDLING ============
  private handleRouteUpdate(routeUpdate: any): void {
    const vehicleId = routeUpdate.vehicleId;
    const newPolyline = routeUpdate.polyline;

    if (!newPolyline || newPolyline.length === 0) {
      return;
    }

    // Remove old polyline
    const oldPolyline = this.routePolylines.get(vehicleId);
    if (oldPolyline) {
      if (this.map && this.map.hasLayer(oldPolyline)) {
        this.map.removeLayer(oldPolyline);
      }
      this.routePolylines.delete(vehicleId);
    }

    // Draw new polyline
    this.drawRoutePolylineDebug(newPolyline, vehicleId);

    this.showNotification(`Vehicle ${vehicleId.substring(0, 8)} REROUTED!`);
  }

  private drawRoutePolylineDebug(polyline: any[], vehicleId?: string): void {
    if (!polyline || polyline.length === 0) {
      return;
    }

    // Transform with extreme robustness
    const latLngs: [number, number][] = [];

    polyline.forEach((point: any) => {
      let lat: number | null = null;
      let lng: number | null = null;

      if (point && typeof point === 'object') {
        // Try all possible field names
        lat = point.latitude ?? point.lat ?? point[1];
        lng = point.longitude ?? point.lng ?? point[0];
      } else if (Array.isArray(point) && point.length >= 2) {
        lat = point[0];
        lng = point[1];
      }

      if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
        latLngs.push([lat, lng]);
      }
    });

    if (latLngs.length === 0) {
      return;
    }

    // Draw with maximum visibility
    try {
      const routeLine = this.L.polyline(latLngs, {
        color: '#00ff00',        // Bright neon green
        weight: 10,              // Very thick
        opacity: 1.0,            // Fully opaque
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: ''            // Solid line
      }).addTo(this.map);

      // Store reference
      if (vehicleId) {
        this.routePolylines.set(vehicleId, routeLine);
      }

      // Fit map to show the route
      if (this.map && latLngs.length > 0) {
        setTimeout(() => {
          this.map.fitBounds(latLngs, {
            padding: [100, 100],
            maxZoom: 17
          });
        }, 100);
      }
    } catch {
      // Handle drawing error silently
    }
  }
  private refreshActiveRoutePolyline(vehicleId: string) {
  if (!this.activeTrucks.has(vehicleId)) return;
  const truck = this.activeTrucks.get(vehicleId);
  if (!truck) return;
  
  const now = Date.now();
  if (truck.lastPolylineRefresh && now - truck.lastPolylineRefresh < 5000) return;
  truck.lastPolylineRefresh = now;
  
  this.routeService.getActiveRoute(vehicleId).subscribe({
    next: (route: any) => {
      if (!route || !route.fullRoutePolyline) return;
      const oldPolyline = this.routePolylines.get(vehicleId);
      if (oldPolyline && this.map.hasLayer(oldPolyline)) {
        this.map.removeLayer(oldPolyline);
        this.routePolylines.delete(vehicleId);
      }
      this.drawActiveRoutePolyline(route.fullRoutePolyline, vehicleId);
    },
    error: () => {}
  });
}

/**
 * ✅ CRITICAL: Draw active vehicle route (SOLID GREEN)
 */
private drawActiveRoutePolyline(polyline: any[], vehicleId: string) {
  if (!polyline || polyline.length === 0) return;

  const latLngs = polyline.map((point: any) => {
    if (typeof point === 'object' && point.latitude !== undefined && point.longitude !== undefined) {
      return [point.latitude, point.longitude];
    } else if (Array.isArray(point) && point.length >= 2) {
      return [point, point];
    }
    return null;
  }).filter((p: any) => p !== null);

  if (latLngs.length === 0) return;

  const routeLine = this.L.polyline(latLngs, {
    color: '#10b981',
    weight: 8,
    opacity: 1.0,
    dashArray: '',
    className: 'active-vehicle-route'
  }).addTo(this.map);

  this.routePolylines.set(vehicleId, routeLine);
}

  resolveIncident(incidentId: string) {
    this.incidentService.resolveIncident(incidentId).subscribe({
      next: () => { /* Incident resolved successfully */ },
      error: () => { /* Handle error silently */ }
    });
  }

  toggleAddingBin() {
    this.isAddingBin = !this.isAddingBin;
    if (this.isAddingBin) {
      this.isReportingIncident = false;
      this.map.getContainer().style.cursor = 'crosshair';
    } else {
      this.map.getContainer().style.cursor = 'grab';
    }

    // Make resolveIncident available globally
    if (typeof window !== 'undefined') {
      (window as any).resolveIncident = (id: string) => {
        const event = new CustomEvent('resolve-incident', { detail: { id } });
        window.dispatchEvent(event);
      };
    }
  }
}