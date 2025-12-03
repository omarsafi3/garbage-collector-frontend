import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import {
  Bin,
  TruckPositionUpdate,
  RouteProgressUpdate,
  RouteCompletionEvent,
  VehicleStatusUpdate
} from '../../models/websocket-dtos';
import { environment } from '../../../environments/environment';

declare const SockJS: new (url: string) => WebSocket;
declare const Stomp: { over: (socket: WebSocket) => StompClient };

interface StompClient {
  connect: (headers: Record<string, string>, successCallback: (frame: unknown) => void, errorCallback: (error: unknown) => void) => void;
  disconnect: (callback: () => void) => void;
  subscribe: (destination: string, callback: (message: StompMessage) => void) => void;
}

interface StompMessage {
  body: string;
}

export interface RouteGenerationEvent {
  event: 'ROUTES_GENERATED';
  departmentId: string;
  routeCount: number;
}

export interface RouteUpdateEvent {
  vehicleId: string;
  polyline: Array<{ latitude: number; longitude: number }>;
  reason?: string;
}

export interface AutoDispatchEvent {
  event: 'AUTO_DISPATCH';
  vehicleId: string;
  vehicleReference: string;
  routeId: string;
  binCount: number;
  driverName: string;
  collectorName: string;
  departmentId: string;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private stompClient: StompClient | null = null;
  private isConnected = false;

  // Typed Subjects
  private binUpdateSubject = new Subject<Bin>();
  private vehicleUpdateSubject = new Subject<VehicleStatusUpdate>();
  private truckPositionSubject = new Subject<TruckPositionUpdate>();
  private routeProgressSubject = new Subject<RouteProgressUpdate>();
  private routeCompletionSubject = new Subject<RouteCompletionEvent>();
  private routeGenerationSubject = new Subject<RouteGenerationEvent>();
  private incidentSubject = new Subject<{ id: string; type: string; status: string; latitude: number; longitude: number; radiusKm: number; description?: string }>();
  private routeUpdateSubject = new Subject<RouteUpdateEvent>();
  private autoDispatchSubject = new Subject<AutoDispatchEvent>();

  connect(serverUrl: string = environment.wsUrl): void {
    if (this.isConnected) {
      return;
    }

    const socket = new SockJS(serverUrl);
    this.stompClient = Stomp.over(socket);

    this.stompClient.connect({},
      () => {
        this.isConnected = true;

        // Subscribe to bin updates
        this.stompClient!.subscribe('/topic/bins', (message: StompMessage) => {
          const bin: Bin = JSON.parse(message.body);
          this.binUpdateSubject.next(bin);
        });

        // Subscribe to vehicle updates
        this.stompClient!.subscribe('/topic/vehicles', (message: StompMessage) => {
          const vehicleUpdate: VehicleStatusUpdate = JSON.parse(message.body);
          this.vehicleUpdateSubject.next(vehicleUpdate);
        });

        // Subscribe to truck position updates
        this.stompClient!.subscribe('/topic/truck-position', (message: StompMessage) => {
          const update: TruckPositionUpdate = JSON.parse(message.body);
          this.truckPositionSubject.next(update);
        });

        // Subscribe to route progress updates
        this.stompClient!.subscribe('/topic/route-progress', (message: StompMessage) => {
          const update: RouteProgressUpdate = JSON.parse(message.body);
          this.routeProgressSubject.next(update);
        });

        // Subscribe to route completion events
        this.stompClient!.subscribe('/topic/route-completion', (message: StompMessage) => {
          const event: RouteCompletionEvent = JSON.parse(message.body);
          this.routeCompletionSubject.next(event);
        });

        this.stompClient!.subscribe('/topic/routes', (message: StompMessage) => {
          const event = JSON.parse(message.body);
          if (event.event === 'ROUTES_GENERATED') {
            this.routeGenerationSubject.next(event as RouteGenerationEvent);
          } else if (event.vehicleId && event.polyline) {
            this.routeUpdateSubject.next(event as RouteUpdateEvent);
          }
        });

        // Subscribe to route updates (rerouting)
        this.stompClient!.subscribe('/topic/route-update', (message: StompMessage) => {
          const routeUpdate: RouteUpdateEvent = JSON.parse(message.body);
          this.routeUpdateSubject.next(routeUpdate);
        });

        this.stompClient!.subscribe('/topic/incidents', (message: StompMessage) => {
          const incident = JSON.parse(message.body);
          this.incidentSubject.next(incident);
        });

        // Subscribe to auto-dispatch events
        this.stompClient!.subscribe('/topic/auto-dispatch', (message: StompMessage) => {
          const autoDispatchEvent: AutoDispatchEvent = JSON.parse(message.body);
          this.autoDispatchSubject.next(autoDispatchEvent);
        });
      },
      () => {
        this.isConnected = false;
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          this.connect(serverUrl);
        }, 5000);
      }
    );
  }

  disconnect(): void {
    if (this.stompClient && this.isConnected) {
      this.stompClient.disconnect(() => {
        this.isConnected = false;
      });
    }
  }

  getRouteUpdates(): Observable<RouteUpdateEvent> {
    return this.routeUpdateSubject.asObservable();
  }

  getBinUpdates(): Observable<Bin> {
    return this.binUpdateSubject.asObservable();
  }

  getVehicleUpdates(): Observable<VehicleStatusUpdate> {
    return this.vehicleUpdateSubject.asObservable();
  }

  getRouteGenerationUpdates(): Observable<RouteGenerationEvent> {
    return this.routeGenerationSubject.asObservable();
  }

  getTruckPositionUpdates(): Observable<TruckPositionUpdate> {
    return this.truckPositionSubject.asObservable();
  }

  getRouteProgressUpdates(): Observable<RouteProgressUpdate> {
    return this.routeProgressSubject.asObservable();
  }

  getRouteCompletionUpdates(): Observable<RouteCompletionEvent> {
    return this.routeCompletionSubject.asObservable();
  }

  isWebSocketConnected(): boolean {
    return this.isConnected;
  }

  getIncidentUpdates(): Observable<{ id: string; type: string; status: string; latitude: number; longitude: number; radiusKm: number; description?: string }> {
    return this.incidentSubject.asObservable();
  }

  getAutoDispatchUpdates(): Observable<AutoDispatchEvent> {
    return this.autoDispatchSubject.asObservable();
  }
}
