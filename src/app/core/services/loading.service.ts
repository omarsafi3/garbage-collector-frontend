import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private loadingMap = new Map<string, boolean>();

  public loading$: Observable<boolean> = this.loadingSubject.asObservable();

  /**
   * Show loading indicator
   * @param key Optional key to track multiple loading states
   */
  show(key: string = 'default'): void {
    this.loadingMap.set(key, true);
    this.updateLoadingState();
  }

  /**
   * Hide loading indicator
   * @param key Optional key to track multiple loading states
   */
  hide(key: string = 'default'): void {
    this.loadingMap.delete(key);
    this.updateLoadingState();
  }

  /**
   * Check if any loading is active
   */
  isLoading(): boolean {
    return this.loadingSubject.value;
  }

  /**
   * Clear all loading states
   */
  clear(): void {
    this.loadingMap.clear();
    this.loadingSubject.next(false);
  }

  private updateLoadingState(): void {
    this.loadingSubject.next(this.loadingMap.size > 0);
  }
}
