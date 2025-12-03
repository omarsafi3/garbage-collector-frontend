import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      <div 
        *ngFor="let toast of toasts$ | async" 
        class="toast"
        [class.success]="toast.type === 'success'"
        [class.error]="toast.type === 'error'"
        [class.warning]="toast.type === 'warning'"
        [class.info]="toast.type === 'info'">
        <div class="toast-icon">
          <span *ngIf="toast.type === 'success'">✓</span>
          <span *ngIf="toast.type === 'error'">✕</span>
          <span *ngIf="toast.type === 'warning'">⚠</span>
          <span *ngIf="toast.type === 'info'">ℹ</span>
        </div>
        <div class="toast-content">
          <div class="toast-title">{{ toast.title }}</div>
          <div class="toast-message" *ngIf="toast.message">{{ toast.message }}</div>
        </div>
        <button class="toast-close" *ngIf="toast.dismissible" (click)="dismiss(toast.id)">×</button>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 10000;
      display: flex;
      flex-direction: column-reverse;
      gap: 12px;
      max-width: 400px;
    }

    .toast {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      border-radius: 12px;
      background: rgba(26, 31, 46, 0.98);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      animation: slideIn 0.3s ease-out;
      color: #e7e9ea;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(100px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .toast.success {
      border-left: 4px solid #10b981;
    }

    .toast.error {
      border-left: 4px solid #ef4444;
    }

    .toast.warning {
      border-left: 4px solid #f59e0b;
    }

    .toast.info {
      border-left: 4px solid #3b82f6;
    }

    .toast-icon {
      font-size: 18px;
      font-weight: bold;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
    }

    .toast.success .toast-icon {
      background: rgba(16, 185, 129, 0.2);
      color: #10b981;
    }

    .toast.error .toast-icon {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }

    .toast.warning .toast-icon {
      background: rgba(245, 158, 11, 0.2);
      color: #f59e0b;
    }

    .toast.info .toast-icon {
      background: rgba(59, 130, 246, 0.2);
      color: #3b82f6;
    }

    .toast-content {
      flex: 1;
    }

    .toast-title {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 2px;
    }

    .toast-message {
      font-size: 13px;
      color: #9ca3af;
    }

    .toast-close {
      background: none;
      border: none;
      color: #6b7280;
      font-size: 20px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      transition: color 0.2s;
    }

    .toast-close:hover {
      color: #f3f4f6;
    }
  `]
})
export class ToastContainerComponent {
  toasts$ = this.toastService.toasts$;

  constructor(private toastService: ToastService) {}

  dismiss(id: string): void {
    this.toastService.dismiss(id);
  }
}
