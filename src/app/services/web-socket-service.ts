import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  Bin,
  TruckPositionUpdate,
  RouteProgressUpdate,
  RouteCompletionEvent
} from '../models/websocket-dtos';

declare var SockJS: any;
declare var Stomp: any;

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private stompClient: any;
  private isConnected = false;

  // Subjects for manual subscriptions
  private binUpdateSubject = new Subject<Bin>();
  private vehicleUpdateSubject = new Subject<any>();
  private truckPositionSubject = new Subject<TruckPositionUpdate>();
  private routeProgressSubject = new Subject<RouteProgressUpdate>();
  private routeCompletionSubject = new Subject<RouteCompletionEvent>();
  private routeGenerationSubject = new Subject<any>();
  private incidentSubject = new Subject<any>();
  private routeUpdateSubject = new Subject<any>();
  constructor() { }

  connect(serverUrl: string = 'http://localhost:8080/ws'): void {
    if (this.isConnected) {
      console.log('WebSocket already connected');
      return;
    }


    const socket = new SockJS(serverUrl);
    this.stompClient = Stomp.over(socket);

    this.stompClient.connect({},
      (frame: any) => {
        console.log('✅ Connected to WebSocket:', frame);
        this.isConnected = true;

        // ✅ Subscribe to bin updates
        this.stompClient.subscribe('/topic/bins', (message: any) => {
          const bin: Bin = JSON.parse(message.body);
          console.log('📍 Received bin update:', bin);
          this.binUpdateSubject.next(bin);
        });



        // ✅ Subscribe to vehicle updates (legacy)
        this.stompClient.subscribe('/topic/vehicles', (message: any) => {
          console.log('🚚 Received vehicle update:', message.body);
          const vehicleUpdate: any = JSON.parse(message.body);
          this.vehicleUpdateSubject.next(vehicleUpdate);
        });

        // ✅ Subscribe to truck position updates (NEW - backend-managed)
        this.stompClient.subscribe('/topic/truck-position', (message: any) => {
          const update: TruckPositionUpdate = JSON.parse(message.body);
          console.log('🚛 Truck position:', update.vehicleId, `[${update.latitude}, ${update.longitude}]`, `${update.progressPercent}%`);
          this.truckPositionSubject.next(update);
        });

        // ✅ Subscribe to route progress updates (NEW - bin collection)
        this.stompClient.subscribe('/topic/route-progress', (message: any) => {
          const update: RouteProgressUpdate = JSON.parse(message.body);
          console.log('📊 Route progress:', update.vehicleId, `Stop ${update.currentStop}/${update.totalStops}`, `Fill: ${update.vehicleFillLevel}%`);
          this.routeProgressSubject.next(update);
        });

        // ✅ Subscribe to route completion events (NEW)
        this.stompClient.subscribe('/topic/route-completion', (message: any) => {
          const event: RouteCompletionEvent = JSON.parse(message.body);
          console.log('✅ Route completed:', event.vehicleId, `${event.binsCollected} bins`);
          this.routeCompletionSubject.next(event);
        });

        this.stompClient.subscribe('/topic/routes', (message: any) => {
          const event = JSON.parse(message.body);

          if (event.event === 'ROUTES_GENERATED') {
            console.log('🔄 Route generation event received:', event);
            this.routeGenerationSubject.next(event);
          } else if (event.vehicleId && event.polyline) {
            console.log('🔄 Route update (reroute) received:', event.vehicleId);
            this.routeUpdateSubject.next(event);
          }
        });

        // ✅ NEW: Subscribe to route updates (rerouting) on separate topic
        this.stompClient.subscribe('/topic/route-update', (message: any) => {
          const routeUpdate = JSON.parse(message.body);
          console.log('🔄 Route update (reroute) received via /topic/route-update:', routeUpdate);
          this.routeUpdateSubject.next(routeUpdate);
        });


        this.stompClient.subscribe('/topic/incidents', (message: any) => {
          const incident = JSON.parse(message.body);
          console.log('🚨 Incident update via WebSocket:', incident);
          this.incidentSubject.next(incident);
        });

      },
      (error: any) => {
        console.error('❌ WebSocket connection error:', error);
        this.isConnected = false;

        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          console.log('🔄 Attempting to reconnect...');
          this.connect(serverUrl);
        }, 5000);
      }
    );
  }

  disconnect(): void {
    if (this.stompClient && this.isConnected) {
      this.stompClient.disconnect(() => {
        console.log('❌ Disconnected from WebSocket');
        this.isConnected = false;
      });
    }
  }
  getRouteUpdates(): Observable<any> {
    return this.routeUpdateSubject.asObservable();
  }


  // ============ OBSERVABLES ============

  getBinUpdates(): Observable<Bin> {
    return this.binUpdateSubject.asObservable();
  }

  getVehicleUpdates(): Observable<any> {
    return this.vehicleUpdateSubject.asObservable();
  }
  getRouteGenerationUpdates(): Observable<any> {
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
  getIncidentUpdates(): Observable<any> {
    return this.incidentSubject.asObservable();
  }
}
