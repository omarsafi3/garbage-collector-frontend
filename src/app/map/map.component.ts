import { Component, OnInit, OnDestroy, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BinService } from '../services/bin-service.service';
import { WebSocketService } from '../services/web-socket-service.service';
import { Bin } from '../models/bin';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css'],
  standalone: true
})
export class MapComponent implements OnInit, OnDestroy {
  private map: any;
  private markers: Map<string, any> = new Map();
  private L: any;
  private wsSubscription?: Subscription;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private binService: BinService,
    private webSocketService: WebSocketService
  ) {}

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.L = await import('leaflet');
      this.initMap(this.L);

      // Connect to WebSocket
      this.webSocketService.connect('http://localhost:8080/ws');

      // Subscribe to real-time bin updates
      this.wsSubscription = this.webSocketService.getBinUpdates().subscribe(
        (updatedBin: Bin) => this.updateBinMarker(updatedBin)
      );
    }
  }

  ngOnDestroy() {
    if (this.wsSubscription) this.wsSubscription.unsubscribe();
    this.webSocketService.disconnect();
  }

  private initMap(L: any) {
    // Tunisia bounds
    const tunisiaBounds = L.latLngBounds(
      L.latLng(30.0, 7.5),  // SW
      L.latLng(37.5, 12.0)  // NE
    );

    this.map = L.map('map', {
      maxBounds: tunisiaBounds,
      maxBoundsViscosity: 1.0,
      minZoom: 6,
      maxZoom: 15
    }).setView([34.0, 9.0], 7);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    this.loadBins(L);

    // Click on map to add new bin
    this.map.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      const fillLevel = prompt('Enter initial fill level (0-100):', '0');
      if (fillLevel === null) return;

      const bin: Partial<Bin> = {
        latitude: lat,
        longitude: lng,
        fillLevel: Number(fillLevel),
        status: 'normal'
      };

      this.binService.addBin(bin).subscribe((savedBin: Bin) => {
        this.addBinMarker(L, savedBin);
      });
    });
  }

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
        setTimeout(() => { element.style.animation = ''; }, 500);
      }
    } else {
      this.addBinMarker(this.L, bin);
    }
  }

  private createPopupContent(bin: Bin, color: string): string {
    return `
      <div style="text-align:center;">
        <strong>Bin ID: ${bin.id}</strong><br>
        <div style="margin:8px 0;">
          <div style="background:#e0e0e0; border-radius:10px; height:20px; width:100%; position:relative;">
            <div style="background:${color}; border-radius:10px; height:100%; width:${bin.fillLevel}%; transition:width 0.3s;"></div>
          </div>
          <strong>${bin.fillLevel}%</strong> Full
        </div>
        Status: <span style="color:${color}; font-weight:bold;">${bin.status}</span><br>
        <small style="color:#666;">Last updated: ${new Date().toLocaleTimeString()}</small>
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
        <path d="M 12.5 ${45 - (fillLevel * 0.25)} L 11 45 Q 11 46 12 46 L 28 46 Q 29 46 29 45 L 27.5 ${45 - (fillLevel * 0.25)} Z" fill="${this.getDarkerColor(color)}" opacity="0.7"/>
        <text x="20" y="32" font-size="12" text-anchor="middle" fill="white" font-weight="bold">♻</text>
        <circle cx="32" cy="10" r="8" fill="white" stroke="${color}" stroke-width="2"/>
        <text x="32" y="13" font-size="8" text-anchor="middle" fill="${color}" font-weight="bold">${fillLevel}%</text>
      </svg>
    `;
    return L.divIcon({
      html: svgIcon,
      className: 'custom-bin-icon',
      iconSize: [40, 50],
      iconAnchor: [20, 50],
      popupAnchor: [0, -50]
    });
  }

  private getColorForFillLevel(fillLevel: number): string {
    if (fillLevel < 25) return this.interpolateColor('#10b981', '#22c55e', fillLevel / 25);
    else if (fillLevel < 50) return this.interpolateColor('#22c55e', '#eab308', (fillLevel - 25) / 25);
    else if (fillLevel < 75) return this.interpolateColor('#eab308', '#f97316', (fillLevel - 50) / 25);
    else return this.interpolateColor('#f97316', '#ef4444', (fillLevel - 75) / 25);
  }

  private interpolateColor(color1: string, color2: string, factor: number): string {
    const c1 = this.hexToRgb(color1);
    const c2 = this.hexToRgb(color2);
    const r = Math.round(c1.r + factor * (c2.r - c1.r));
    const g = Math.round(c1.g + factor * (c2.g - c1.g));
    const b = Math.round(c1.b + factor * (c2.b - c1.b));
    return `rgb(${r}, ${g}, ${b})`;
  }

  private hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 0, g: 0, b: 0 };
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
