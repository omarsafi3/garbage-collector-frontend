import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VehicleInfo } from '../../../../services/dashboard.service';
import { Employee } from '../../../../models/employee';
import { AvailableRoute } from '../../../../services/route.service';

export interface ActiveTruckInfo {
  vehicleId: string;
  progress: number;
  currentStop?: number;
  totalStops?: number;
}

export interface VehicleCardConfig {
  vehicle: VehicleInfo;
  isActive: boolean;
  isBusy: boolean;
  isUnloading: boolean;
  activeProgress: number;
  progressText: string;
  assignedDriver: string | null;
  assignedCollector: string | null;
  driverName: string;
  collectorName: string;
  availableDrivers: Employee[];
  availableCollectors: Employee[];
  availableRoutes: AvailableRoute[];
  canDispatch: boolean;
}

@Component({
  selector: 'app-vehicle-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="vehicle-card" 
         [class.active]="config.isActive"
         [class.busy]="config.isBusy">
      
      <!-- Vehicle Header -->
      <div class="vehicle-header">
        <div class="vehicle-identity">
          <span class="vehicle-icon">🚛</span>
          <div class="vehicle-names">
            <span class="vehicle-ref">{{ config.vehicle.reference }}</span>
            <span class="vehicle-plate">{{ config.vehicle.plate }}</span>
          </div>
        </div>
        <div class="vehicle-status" [ngClass]="statusClass">
          {{ statusText }}
        </div>
      </div>

      <!-- Active Route Info (when in route) -->
      <div class="active-route-info" *ngIf="config.isActive">
        <div class="route-progress-bar">
          <div class="progress-track">
            <div class="progress-fill" 
                 [style.width.%]="config.activeProgress"
                 [style.background]="progressGradient">
            </div>
          </div>
          <span class="progress-percent">{{ config.activeProgress | number:'1.0-0' }}%</span>
        </div>

        <div class="crew-info" *ngIf="config.assignedDriver">
          <div class="crew-member">
            <span class="crew-icon">🚛</span>
            <span class="crew-name">{{ config.driverName }}</span>
            <span class="crew-role">Driver</span>
          </div>
          <div class="crew-member">
            <span class="crew-icon">🗑️</span>
            <span class="crew-name">{{ config.collectorName }}</span>
            <span class="crew-role">Collector</span>
          </div>
        </div>

        <div class="collection-stats">
          <div class="stat-item">
            <span class="stat-icon">📍</span>
            <span class="stat-value">{{ config.progressText || 'Starting...' }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">🗑️</span>
            <span class="stat-value">{{ config.vehicle.fillLevel | number:'1.0-0' }}% full</span>
          </div>
        </div>

        <div class="unloading-indicator" *ngIf="config.isUnloading">
          <span class="unloading-icon">🏭</span>
          <span>Unloading at depot...</span>
        </div>
      </div>

      <!-- Fill Level (when not in route) -->
      <div class="fill-gauge" *ngIf="!config.isActive">
        <div class="gauge-bar">
          <div class="gauge-fill" 
               [style.width.%]="config.vehicle.fillLevel"
               [style.background]="fillGradient"></div>
        </div>
        <span class="gauge-label">{{ config.vehicle.fillLevel | number:'1.0-0' }}% full</span>
      </div>

      <!-- Dispatch Controls (only when available) -->
      <div class="dispatch-controls" *ngIf="!config.isActive && config.vehicle.available">
        <div class="crew-selection">
          <div class="crew-slot">
            <label>🚛 Driver</label>
            <select [value]="config.assignedDriver || ''"
                    (change)="onDriverChange($event)">
              <option value="">Select driver...</option>
              <option *ngFor="let emp of config.availableDrivers" [value]="emp.id">
                {{ emp.firstName }} {{ emp.lastName }}
              </option>
            </select>
          </div>
          <div class="crew-slot">
            <label>🗑️ Collector</label>
            <select [value]="config.assignedCollector || ''"
                    (change)="onCollectorChange($event)">
              <option value="">Select collector...</option>
              <option *ngFor="let emp of config.availableCollectors" [value]="emp.id">
                {{ emp.firstName }} {{ emp.lastName }}
              </option>
            </select>
          </div>
        </div>

        <div class="route-selection">
          <select [value]="selectedRouteId" 
                  (change)="onRouteChange($event)"
                  [disabled]="config.availableRoutes.length === 0">
            <option value="">📍 Select route...</option>
            <option *ngFor="let route of config.availableRoutes; let i = index" [value]="route.routeId">
              {{ getRouteEmoji(i) }} Route {{ i + 1 }} ({{ route.binCount }} bins)
            </option>
          </select>
        </div>

        <button class="btn-dispatch"
                (click)="onDispatch()"
                [disabled]="!config.canDispatch">
          🚀 Dispatch
        </button>

        <div class="dispatch-hint" *ngIf="!config.canDispatch">
          Assign driver + collector & select route
        </div>
      </div>

      <!-- Busy Badge -->
      <div class="status-badge busy" *ngIf="config.isBusy">
        <span class="badge-icon">⏸️</span>
        <span>Unavailable</span>
      </div>
    </div>
  `,
  styleUrls: ['./vehicle-card.component.css']
})
export class VehicleCardComponent {
  @Input() config!: VehicleCardConfig;
  @Input() index: number = 0;
  
  @Output() driverChanged = new EventEmitter<{ vehicleId: string; driverId: string }>();
  @Output() collectorChanged = new EventEmitter<{ vehicleId: string; collectorId: string }>();
  @Output() routeChanged = new EventEmitter<{ vehicleId: string; routeId: string }>();
  @Output() dispatch = new EventEmitter<{ vehicleId: string; routeId: string }>();

  selectedRouteId = '';

  get statusClass(): string {
    if (this.config.isActive) return 'active';
    return this.config.vehicle.available ? 'ready' : 'busy';
  }

  get statusText(): string {
    if (this.config.isActive) return '🔄 In Route';
    return this.config.vehicle.available ? '✓ Ready' : '⏸️ Busy';
  }

  get progressGradient(): string {
    const progress = this.config.activeProgress;
    if (progress < 33) return 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)';
    if (progress < 66) return 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)';
    return 'linear-gradient(90deg, #10b981 0%, #34d399 100%)';
  }

  get fillGradient(): string {
    const fill = this.config.vehicle.fillLevel;
    if (fill < 50) return 'linear-gradient(90deg, #10b981 0%, #34d399 100%)';
    if (fill < 80) return 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)';
    return 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)';
  }

  getRouteEmoji(index: number): string {
    const emojis = ['🔴', '🟢', '🔵', '🟡', '🟣', '🟠'];
    return emojis[index % emojis.length];
  }

  onDriverChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.driverChanged.emit({ vehicleId: this.config.vehicle.id, driverId: value });
  }

  onCollectorChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.collectorChanged.emit({ vehicleId: this.config.vehicle.id, collectorId: value });
  }

  onRouteChange(event: Event): void {
    this.selectedRouteId = (event.target as HTMLSelectElement).value;
    this.routeChanged.emit({ vehicleId: this.config.vehicle.id, routeId: this.selectedRouteId });
  }

  onDispatch(): void {
    this.dispatch.emit({ vehicleId: this.config.vehicle.id, routeId: this.selectedRouteId });
  }
}
