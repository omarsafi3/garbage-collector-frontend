import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';

import { RouteService } from '../services/route.service';
import { RouteBin } from '../models/route';
import { DepartmentRoute } from '../models/department-route';
import { BinService } from '../services/bin-service.service';
import { WebSocketService } from '../services/web-socket-service.service';
import { DepartmentService } from '../services/department.service';
import { Bin } from '../models/bin';
import { Department } from '../models/department';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css'],
  standalone: true,
  imports: []
})
export class MapComponent implements OnInit, OnDestroy {
  private map: any;
  private markers: Map<string, any> = new Map();
  private departmentMarkers: Map<string, any> = new Map();
  private L: any;
  private wsSubscription?: Subscription;

  // Single-vehicle route state
  private routePolyline?: any;
  private routeMarkers: any[] = [];
  private routeSub?: Subscription;

  // Multi-vehicle (department) routes
  private routePolylines: any[] = [];

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private binService: BinService,
    private webSocketService: WebSocketService,
    private departmentService: DepartmentService,
    private routeService: RouteService
  ) {}

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.L = await import('leaflet');
      this.initMap(this.L);

      this.webSocketService.connect('http://localhost:8080/ws');
      this.wsSubscription = this.webSocketService.getBinUpdates().subscribe(
        (updatedBin: Bin) => {
          this.updateBinMarker(updatedBin);
        }
      );
    }
  }

  ngOnDestroy() {
    if (this.wsSubscription) {
      this.wsSubscription.unsubscribe();
    }
    if (this.routeSub) {
      this.routeSub.unsubscribe();
    }
    this.webSocketService.disconnect();
  }

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

    this.loadDepartments(L);
    this.loadBins(L);

    // Bin placement on click
    this.map.on('click', async (e: any) => {
      const { lat, lng } = e.latlng;
      const snappedCoords = await this.snapToRoad(lng, lat);

      if (!snappedCoords) {
        alert('Cannot place a bin here. Please click closer to a road.');
        return;
      }
      const fillLevel = prompt('Enter initial fill level (0-100):', '0');
      if (fillLevel === null) return;

      const bin: Partial<Bin> = {
        latitude: snappedCoords.lat,
        longitude: snappedCoords.lng,
        fillLevel: Number(fillLevel),
        status: 'normal'
      };

      this.binService.addBin(bin).subscribe((savedBin: Bin) => {
        this.addBinMarker(L, savedBin);
      });
    });
  }

  /** Snap to nearest road segment using OSRM */
  private async snapToRoad(lng: number, lat: number): Promise<{ lat: number; lng: number } | null> {
    try {
      const response = await fetch(
        `https://router.project-osrm.org/nearest/v1/driving/${lng},${lat}?number=1`
      );
      const data = await response.json();
      if (data.code === 'Ok' && data.waypoints && data.waypoints.length > 0) {
        const snapped = data.waypoints[0].location;
        return { lng: snapped[0], lat: snapped[1] };
      }
      return null;
    } catch (error) {
      console.error('Error snapping to road:', error);
      return null;
    }
  }

  // ---------------- ROUTE LOGIC --------------------

  /** Single vehicle: draw the optimal route for given departmentId and vehicleId */
  showRoute(departmentId: string, vehicleId: string) {
    if (this.routeSub) this.routeSub.unsubscribe();
    this.routeSub = this.routeService
      .getOptimizedRoute(departmentId, vehicleId)
      .subscribe(routeBins => {
        console.log('optimized route from backend', routeBins);
        this.drawRoute(routeBins);
      });
    console.log('showRoute called with', departmentId, vehicleId);
  }

  /** NEW: show all routes for a department (multi-vehicle) */
  showDepartmentRoutes(departmentId: string) {
    if (this.routeSub) this.routeSub.unsubscribe();
    this.routeSub = this.routeService
      .getDepartmentRoutes(departmentId)
      .subscribe(routes => {
        console.log('department routes', routes);
        this.drawDepartmentRoutes(routes);
      });
    console.log('showDepartmentRoutes called with', departmentId);
  }

  /** Single-vehicle: road-following route including depot → bins → depot */
  private async drawRoute(route: RouteBin[]) {
    if (!this.map) return;

    const depotLat = 34.0;  // TODO: replace with real department lat
    const depotLng = 9.0;   // TODO: replace with real department lng

    console.log('[Map] drawRoute road-based, bins:', route);

    // clear previous single-vehicle polyline and markers
    if (this.routePolyline) {
      this.map.removeLayer(this.routePolyline);
      this.routePolyline = undefined;
    }
    this.routeMarkers.forEach(m => this.map.removeLayer(m));
    this.routeMarkers = [];

    // also clear multi-vehicle polylines when switching mode
    this.routePolylines.forEach(p => this.map.removeLayer(p));
    this.routePolylines = [];

    const stops: { lat: number; lng: number }[] = [
      { lat: depotLat, lng: depotLng },
      ...route.map(b => ({ lat: b.latitude, lng: b.longitude })),
      { lat: depotLat, lng: depotLng }
    ];

    let fullCoords: [number, number][] = [];
    for (let i = 0; i < stops.length - 1; i++) {
      const from = stops[i];
      const to = stops[i + 1];
      const seg = await this.getRoadPolyline(from.lat, from.lng, to.lat, to.lng);
      if (seg.length > 0) {
        if (fullCoords.length > 0) {
          fullCoords = fullCoords.concat(seg.slice(1));
        } else {
          fullCoords = fullCoords.concat(seg);
        }
      }
    }

    if (fullCoords.length === 0) {
      console.warn('[Map] No OSRM geometry, falling back to straight lines');
      const straight = stops.map(p => [p.lat, p.lng] as [number, number]);
      this.routePolyline = this.L.polyline(straight, { color: 'blue', weight: 7, opacity: 0.75 }).addTo(this.map);
    } else {
      this.routePolyline = this.L.polyline(fullCoords, { color: 'blue', weight: 7, opacity: 0.75 }).addTo(this.map);
    }

    const depotMarker = this.L.marker([depotLat, depotLng]).bindPopup('Depot');
    depotMarker.addTo(this.map);
    this.routeMarkers.push(depotMarker);

    route.forEach((bin, idx) => {
      const marker = this.L.marker([bin.latitude, bin.longitude])
        .bindPopup(`Stop #${idx + 1}<br>Bin ${bin.id}`);
      marker.addTo(this.map);
      this.routeMarkers.push(marker);
    });

    this.map.fitBounds(this.routePolyline.getBounds());
  }

  /** NEW: draw multiple routes for a department (one polyline per vehicle, straight for now) */
  /** NEW: draw multiple road-following routes for a department (one polyline per vehicle) */
private async drawDepartmentRoutes(routes: DepartmentRoute[]) {
  if (!this.map) return;

  // clear single-vehicle polyline and markers
  if (this.routePolyline) {
    this.map.removeLayer(this.routePolyline);
    this.routePolyline = undefined;
  }
  this.routeMarkers.forEach(m => this.map.removeLayer(m));
  this.routeMarkers = [];

  // clear old department polylines
  this.routePolylines.forEach(p => this.map.removeLayer(p));
  this.routePolylines = [];

  if (!routes || routes.length === 0) return;

  const colors = ['blue', 'red', 'green', 'purple', 'orange', 'brown'];
  const allLatLngs: [number, number][][] = [];

  // For now: same fixed depot; later plug real dept coordinates
  const depotLat = 34.0;
  const depotLng = 9.0;

  for (let rIndex = 0; rIndex < routes.length; rIndex++) {
    const route = routes[rIndex];
    const bins = route.bins;
    if (!bins || bins.length === 0) continue;

    const color = colors[rIndex % colors.length];

    // Build stops: depot -> bins -> depot
    const stops: { lat: number; lng: number }[] = [
      { lat: depotLat, lng: depotLng },
      ...bins.map(b => ({ lat: b.latitude, lng: b.longitude })),
      { lat: depotLat, lng: depotLng }
    ];

    let fullCoords: [number, number][] = [];
    for (let i = 0; i < stops.length - 1; i++) {
      const from = stops[i];
      const to = stops[i + 1];
      const seg = await this.getRoadPolyline(from.lat, from.lng, to.lat, to.lng);
      if (seg.length > 0) {
        if (fullCoords.length > 0) {
          fullCoords = fullCoords.concat(seg.slice(1));
        } else {
          fullCoords = fullCoords.concat(seg);
        }
      }
    }

    if (fullCoords.length === 0) {
      // fallback: straight segments depot -> bins -> depot
      const straight = stops.map(p => [p.lat, p.lng] as [number, number]);
      fullCoords = straight;
    }

    allLatLngs.push(fullCoords);

    const polyline = this.L.polyline(fullCoords, {
      color,
      weight: 6,
      opacity: 0.8
    }).addTo(this.map);

    this.routePolylines.push(polyline);

    // markers for this vehicle’s bins
    bins.forEach((bin, i) => {
      const marker = this.L.marker([bin.latitude, bin.longitude])
        .bindPopup(`Vehicle ${route.vehicleId}<br>Stop #${i + 1}<br>Bin ${bin.id}`);
      marker.addTo(this.map);
      this.routeMarkers.push(marker);
    });
  }

  // fit map to all polylines
  const allPoints = allLatLngs.flat();
  if (allPoints.length > 0) {
    const bounds = this.L.latLngBounds(allPoints);
    this.map.fitBounds(bounds);
  }
}


  private async getRoadPolyline(
    fromLat: number, fromLng: number,
    toLat: number, toLng: number
  ): Promise<[number, number][]> {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;

    try {
      const resp = await fetch(url);
      const data = await resp.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        console.warn('OSRM returned no route for segment', { fromLat, fromLng, toLat, toLng, data });
        return [];
      }

      const coords: [number, number][] =
        data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
      return coords;
    } catch (e) {
      console.error('OSRM error for segment', e);
      return [];
    }
  }

  // ---------------- DEPARTMENTS --------------------

  private loadDepartments(L: any) {
    this.departmentService.getAllDepartments().subscribe((depts: Department[]) => {
      depts.forEach((dept) => {
        const deptIcon = this.createDepartmentIcon(L);
        const marker = L.marker([dept.latitude!, dept.longitude!], { icon: deptIcon }).addTo(this.map);
        marker.on('click', () => {
          this.loadDepartmentDetails(dept.id!, marker);
        });
        marker.bindPopup(this.createDepartmentLoadingPopup(dept));
        this.departmentMarkers.set(dept.id!, marker);
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

  private loadDepartmentDetails(deptId: string, marker: any) {
    this.departmentService.getDepartmentEmployees(deptId).subscribe(employees => {
      this.departmentService.getDepartmentVehicles(deptId).subscribe(vehicles => {
        this.departmentService.getDepartmentById(deptId).subscribe(dept => {
          marker.setPopupContent(this.createDepartmentDetailPopup(dept, employees, vehicles));
        });
      });
    });
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

  // ---------------- BINS ----------------

  private loadBins(L: any) {
    this.binService.getAllBins().subscribe((bins: Bin[]) => {
      bins.forEach(bin => {
        this.addBinMarker(L, bin);
      });
    });
  }

  private addBinMarker(L: any, bin: Bin) {
    const color = this.getColorForFillLevel(bin.fillLevel);
    const icon = this.createBinIcon(L, color, bin.fillLevel);

    const marker = L.marker([bin.latitude, bin.longitude], { icon }).addTo(this.map);
    marker.bindPopup(this.createPopupContent(bin, color));
    this.markers.set(bin.id!, marker);
  }

  private updateBinMarker(bin: Bin) {
    const existingMarker = this.markers.get(bin.id!);

    if (existingMarker) {
      const color = this.getColorForFillLevel(bin.fillLevel);
      const icon = this.createBinIcon(this.L, color, bin.fillLevel);

      existingMarker.setIcon(icon);
      existingMarker.setPopupContent(this.createPopupContent(bin, color));

      const element = existingMarker.getElement();
      if (element) {
        element.style.animation = 'pulse 0.5s';
        setTimeout(() => {
          element.style.animation = '';
        }, 500);
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
      if (matches) {
        const r = Math.max(0, parseInt(matches[0]) - 40);
        const g = Math.max(0, parseInt(matches[1]) - 40);
        const b = Math.max(0, parseInt(matches[2]) - 40);
        return `rgb(${r}, ${g}, ${b})`;
      }
    }
    return color;
  }
}
