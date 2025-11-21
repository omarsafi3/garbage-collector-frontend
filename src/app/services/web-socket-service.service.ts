import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Bin } from '../models/bin';

declare var SockJS: any;
declare var Stomp: any;

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private stompClient: any;
  private binUpdateSubject = new Subject<Bin>();
  private isConnected = false;

  constructor() {}

  connect(serverUrl: string = 'http://localhost:8080/ws'): void {
    if (this.isConnected) {
      console.log('WebSocket already connected');
      return;
    }

    const socket = new SockJS(serverUrl);
    this.stompClient = Stomp.over(socket);

    this.stompClient.connect({}, 
      (frame: any) => {
        console.log('Connected to WebSocket:', frame);
        this.isConnected = true;

        // Subscribe to bin updates
        this.stompClient.subscribe('/topic/bins', (message: any) => {
          const bin: Bin = JSON.parse(message.body);
          console.log('Received bin update:', bin);
          this.binUpdateSubject.next(bin);
        });
      },
      (error: any) => {
        console.error('WebSocket connection error:', error);
        this.isConnected = false;
        
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          console.log('Attempting to reconnect...');
          this.connect(serverUrl);
        }, 5000);
      }
    );
  }

  disconnect(): void {
    if (this.stompClient && this.isConnected) {
      this.stompClient.disconnect(() => {
        console.log('Disconnected from WebSocket');
        this.isConnected = false;
      });
    }
  }

  getBinUpdates(): Observable<Bin> {
    return this.binUpdateSubject.asObservable();
  }

  isWebSocketConnected(): boolean {
    return this.isConnected;
  }
}