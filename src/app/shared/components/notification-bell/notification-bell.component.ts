import { Component, Input, Output, EventEmitter, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  title?: string;
  timestamp: Date;
  read: boolean;
}

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="notification-wrapper">
      <button class="notification-bell" (click)="togglePanel($event)">
        <span class="bell-icon">🔔</span>
        <span class="notification-badge" *ngIf="unreadCount > 0">
          {{ unreadCount > 99 ? '99+' : unreadCount }}
        </span>
      </button>

      <div class="notification-panel" *ngIf="showPanel" (click)="$event.stopPropagation()">
        <div class="panel-header">
          <h3>Notifications</h3>
          <div class="panel-actions">
            <button class="action-btn" (click)="markAllRead.emit()" *ngIf="unreadCount > 0">
              Mark all read
            </button>
            <button class="action-btn clear" (click)="clearAll.emit()" *ngIf="notifications.length > 0">
              Clear all
            </button>
          </div>
        </div>

        <div class="panel-content">
          <div class="notification-list" *ngIf="notifications.length > 0">
            <div class="notification-item" 
                 *ngFor="let notification of notifications"
                 [class.unread]="!notification.read"
                 [ngClass]="'type-' + notification.type">
              <div class="notification-icon">
                {{ getNotificationIcon(notification.type) }}
              </div>
              <div class="notification-body">
                <div class="notification-title" *ngIf="notification.title">
                  {{ notification.title }}
                </div>
                <div class="notification-message">{{ notification.message }}</div>
                <div class="notification-time">
                  {{ getRelativeTime(notification.timestamp) }}
                </div>
              </div>
            </div>
          </div>

          <div class="empty-state" *ngIf="notifications.length === 0">
            <span class="empty-icon">🔕</span>
            <span class="empty-text">No notifications</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .notification-wrapper {
      position: relative;
    }

    .notification-bell {
      position: relative;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      border-radius: 12px;
      padding: 10px 14px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .notification-bell:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: translateY(-2px);
    }

    .bell-icon {
      font-size: 1.3rem;
    }

    .notification-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: white;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 10px;
      min-width: 18px;
      text-align: center;
      box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4);
      animation: badge-pulse 2s ease-in-out infinite;
    }

    @keyframes badge-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }

    .notification-panel {
      position: absolute;
      top: calc(100% + 12px);
      right: 0;
      width: 360px;
      max-height: 480px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
      border: 1px solid #e5e7eb;
      overflow: hidden;
      z-index: 1000;
      animation: slideDown 0.2s ease-out;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: linear-gradient(135deg, #f8fafc, #f1f5f9);
      border-bottom: 1px solid #e5e7eb;
    }

    .panel-header h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
      color: #1e293b;
    }

    .panel-actions {
      display: flex;
      gap: 8px;
    }

    .action-btn {
      background: none;
      border: none;
      font-size: 0.75rem;
      color: #3b82f6;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
      transition: all 0.2s ease;
    }

    .action-btn:hover {
      background: rgba(59, 130, 246, 0.1);
    }

    .action-btn.clear {
      color: #ef4444;
    }

    .action-btn.clear:hover {
      background: rgba(239, 68, 68, 0.1);
    }

    .panel-content {
      max-height: 400px;
      overflow-y: auto;
    }

    .notification-list {
      display: flex;
      flex-direction: column;
    }

    .notification-item {
      display: flex;
      gap: 12px;
      padding: 14px 20px;
      border-bottom: 1px solid #f1f5f9;
      transition: all 0.2s ease;
    }

    .notification-item:last-child {
      border-bottom: none;
    }

    .notification-item:hover {
      background: #f8fafc;
    }

    .notification-item.unread {
      background: linear-gradient(90deg, rgba(59, 130, 246, 0.05), transparent);
      border-left: 3px solid #3b82f6;
    }

    .notification-icon {
      font-size: 1.5rem;
      flex-shrink: 0;
    }

    .notification-body {
      flex: 1;
      min-width: 0;
    }

    .notification-title {
      font-weight: 600;
      font-size: 0.9rem;
      color: #1e293b;
      margin-bottom: 2px;
    }

    .notification-message {
      font-size: 0.85rem;
      color: #64748b;
      line-height: 1.4;
      word-break: break-word;
    }

    .notification-time {
      font-size: 0.7rem;
      color: #94a3b8;
      margin-top: 4px;
    }

    .notification-item.type-success .notification-icon {
      color: #10b981;
    }

    .notification-item.type-error .notification-icon {
      color: #ef4444;
    }

    .notification-item.type-warning .notification-icon {
      color: #f59e0b;
    }

    .notification-item.type-info .notification-icon {
      color: #3b82f6;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      color: #94a3b8;
    }

    .empty-icon {
      font-size: 2.5rem;
      margin-bottom: 12px;
      opacity: 0.5;
    }

    .empty-text {
      font-size: 0.9rem;
    }

    /* Scrollbar */
    .panel-content::-webkit-scrollbar {
      width: 6px;
    }

    .panel-content::-webkit-scrollbar-track {
      background: transparent;
    }

    .panel-content::-webkit-scrollbar-thumb {
      background: #e2e8f0;
      border-radius: 3px;
    }

    .panel-content::-webkit-scrollbar-thumb:hover {
      background: #cbd5e1;
    }

    @media (max-width: 480px) {
      .notification-panel {
        position: fixed;
        top: 60px;
        left: 10px;
        right: 10px;
        width: auto;
      }
    }
  `]
})
export class NotificationBellComponent {
  @Input() notifications: Notification[] = [];
  @Input() unreadCount: number = 0;
  @Input() showPanel: boolean = false;

  @Output() togglePanelChange = new EventEmitter<boolean>();
  @Output() markAllRead = new EventEmitter<void>();
  @Output() clearAll = new EventEmitter<void>();

  constructor(private elementRef: ElementRef) {}

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent) {
    if (this.showPanel && !this.elementRef.nativeElement.contains(event.target)) {
      this.togglePanelChange.emit(false);
    }
  }

  togglePanel(event: Event): void {
    event.stopPropagation();
    this.togglePanelChange.emit(!this.showPanel);
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📌';
    }
  }

  getRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(date).toLocaleDateString();
  }
}
