import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dialog-overlay" *ngIf="isOpen" (click)="onCancel()">
      <div class="dialog" (click)="$event.stopPropagation()">
        <div class="dialog-header">
          <span class="dialog-icon" [class]="type">
            <span *ngIf="type === 'danger'">⚠️</span>
            <span *ngIf="type === 'warning'">❓</span>
            <span *ngIf="type === 'info'">ℹ️</span>
          </span>
          <h3>{{ title }}</h3>
        </div>
        <div class="dialog-body">
          <p>{{ message }}</p>
        </div>
        <div class="dialog-footer">
          <button class="btn-cancel" (click)="onCancel()">{{ cancelText }}</button>
          <button class="btn-confirm" [class]="type" (click)="onConfirm()">{{ confirmText }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .dialog {
      background: #1a1f2e;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4);
      width: 100%;
      max-width: 420px;
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .dialog-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #f3f4f6;
    }

    .dialog-icon {
      font-size: 24px;
    }

    .dialog-body {
      padding: 20px 24px;
    }

    .dialog-body p {
      margin: 0;
      font-size: 14px;
      color: #9ca3af;
      line-height: 1.6;
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .btn-cancel, .btn-confirm {
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-cancel {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #9ca3af;
    }

    .btn-cancel:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #f3f4f6;
    }

    .btn-confirm {
      border: none;
      color: white;
    }

    .btn-confirm.danger {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    }

    .btn-confirm.danger:hover {
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
    }

    .btn-confirm.warning {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    }

    .btn-confirm.warning:hover {
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
    }

    .btn-confirm.info {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    }

    .btn-confirm.info:hover {
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    }
  `]
})
export class ConfirmDialogComponent {
  @Input() isOpen = false;
  @Input() title = 'Confirm Action';
  @Input() message = 'Are you sure you want to proceed?';
  @Input() confirmText = 'Confirm';
  @Input() cancelText = 'Cancel';
  @Input() type: 'danger' | 'warning' | 'info' = 'warning';

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  onConfirm(): void {
    this.confirmed.emit();
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
