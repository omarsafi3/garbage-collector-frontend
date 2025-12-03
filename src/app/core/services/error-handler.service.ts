import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastService } from './toast.service';
import { Router } from '@angular/router';

export interface ApiError {
  status: number;
  message: string;
  details?: string;
  timestamp?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlerService {

  constructor(
    private toastService: ToastService,
    private router: Router
  ) {}

  /**
   * Handle HTTP errors from API calls
   */
  handleHttpError(error: HttpErrorResponse, context?: string): void {
    const apiError = this.parseError(error);
    
    switch (error.status) {
      case 0:
        this.toastService.error(
          'Connection Error',
          'Unable to connect to the server. Please check your internet connection.'
        );
        break;
      case 401:
        this.toastService.error('Session Expired', 'Please log in again.');
        this.router.navigate(['/login']);
        break;
      case 403:
        this.toastService.error('Access Denied', 'You do not have permission to perform this action.');
        break;
      case 404:
        this.toastService.error('Not Found', context ? `${context} not found.` : 'The requested resource was not found.');
        break;
      case 422:
        this.toastService.error('Validation Error', apiError.message || 'Please check your input and try again.');
        break;
      case 500:
        this.toastService.error('Server Error', 'An unexpected error occurred. Please try again later.');
        break;
      default:
        this.toastService.error(
          'Error',
          apiError.message || 'An unexpected error occurred.'
        );
    }

    // Log error for debugging
    console.error(`[${context || 'API'}] Error:`, {
      status: error.status,
      message: apiError.message,
      url: error.url
    });
  }

  /**
   * Handle generic errors
   */
  handleError(error: Error, context?: string): void {
    this.toastService.error(
      'Error',
      error.message || 'An unexpected error occurred.'
    );
    console.error(`[${context || 'App'}] Error:`, error);
  }

  /**
   * Parse error response to get message
   */
  private parseError(error: HttpErrorResponse): ApiError {
    let message = 'An unexpected error occurred';
    let details: string | undefined;

    if (error.error) {
      if (typeof error.error === 'string') {
        message = error.error;
      } else if (error.error.message) {
        message = error.error.message;
      } else if (error.error.error) {
        message = error.error.error;
      }
      details = error.error.details;
    }

    return {
      status: error.status,
      message,
      details,
      timestamp: new Date().toISOString()
    };
  }
}
