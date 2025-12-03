import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
  dismissible?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  public toasts$: Observable<Toast[]> = this.toastsSubject.asObservable();

  private defaultDuration = 5000;

  /**
   * Show a success toast
   */
  success(title: string, message: string = '', duration?: number): void {
    this.show({ type: 'success', title, message, duration });
  }

  /**
   * Show an error toast
   */
  error(title: string, message: string = '', duration?: number): void {
    this.show({ type: 'error', title, message, duration: duration || 8000 });
  }

  /**
   * Show a warning toast
   */
  warning(title: string, message: string = '', duration?: number): void {
    this.show({ type: 'warning', title, message, duration });
  }

  /**
   * Show an info toast
   */
  info(title: string, message: string = '', duration?: number): void {
    this.show({ type: 'info', title, message, duration });
  }

  /**
   * Show a custom toast
   */
  show(config: Omit<Toast, 'id'>): void {
    const toast: Toast = {
      id: this.generateId(),
      type: config.type,
      title: config.title,
      message: config.message,
      duration: config.duration ?? this.defaultDuration,
      dismissible: config.dismissible ?? true
    };

    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next([...currentToasts, toast]);

    // Auto-dismiss
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => this.dismiss(toast.id), toast.duration);
    }
  }

  /**
   * Dismiss a toast by ID
   */
  dismiss(id: string): void {
    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next(currentToasts.filter(t => t.id !== id));
  }

  /**
   * Clear all toasts
   */
  clear(): void {
    this.toastsSubject.next([]);
  }

  private generateId(): string {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
