import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandlerService } from './error-handler.service';
import { ToastService } from './toast.service';
import { AuthService } from './auth.service';

describe('ErrorHandlerService', () => {
  let service: ErrorHandlerService;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    const toastSpy = jasmine.createSpyObj('ToastService', ['error']);
    const authSpy = jasmine.createSpyObj('AuthService', ['logout']);

    TestBed.configureTestingModule({
      providers: [
        ErrorHandlerService,
        { provide: ToastService, useValue: toastSpy },
        { provide: AuthService, useValue: authSpy }
      ]
    });

    service = TestBed.inject(ErrorHandlerService);
    toastServiceSpy = TestBed.inject(ToastService) as jasmine.SpyObj<ToastService>;
    authServiceSpy = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should show custom message when provided', () => {
    const error = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });
    service.handleError(error, 'Custom error message');
    
    expect(toastServiceSpy.error).toHaveBeenCalledWith('Custom error message', 'Error');
  });

  it('should handle 400 Bad Request', () => {
    const error = new HttpErrorResponse({ status: 400, statusText: 'Bad Request' });
    service.handleError(error);
    
    expect(toastServiceSpy.error).toHaveBeenCalledWith('Invalid request. Please check your input.', 'Error');
  });

  it('should handle 401 Unauthorized and logout', () => {
    const error = new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' });
    service.handleError(error);
    
    expect(toastServiceSpy.error).toHaveBeenCalledWith('Session expired. Please login again.', 'Error');
    expect(authServiceSpy.logout).toHaveBeenCalled();
  });

  it('should handle 403 Forbidden', () => {
    const error = new HttpErrorResponse({ status: 403, statusText: 'Forbidden' });
    service.handleError(error);
    
    expect(toastServiceSpy.error).toHaveBeenCalledWith('You don\'t have permission to perform this action.', 'Error');
  });

  it('should handle 404 Not Found', () => {
    const error = new HttpErrorResponse({ status: 404, statusText: 'Not Found' });
    service.handleError(error);
    
    expect(toastServiceSpy.error).toHaveBeenCalledWith('The requested resource was not found.', 'Error');
  });

  it('should handle 500 Internal Server Error', () => {
    const error = new HttpErrorResponse({ status: 500, statusText: 'Internal Server Error' });
    service.handleError(error);
    
    expect(toastServiceSpy.error).toHaveBeenCalledWith('Server error. Please try again later.', 'Error');
  });

  it('should handle 503 Service Unavailable', () => {
    const error = new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' });
    service.handleError(error);
    
    expect(toastServiceSpy.error).toHaveBeenCalledWith('Service temporarily unavailable. Please try again later.', 'Error');
  });

  it('should handle 0 status (network error)', () => {
    const error = new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' });
    service.handleError(error);
    
    expect(toastServiceSpy.error).toHaveBeenCalledWith('Network error. Please check your connection.', 'Error');
  });

  it('should handle unknown status codes', () => {
    const error = new HttpErrorResponse({ status: 418, statusText: "I'm a teapot" });
    service.handleError(error);
    
    expect(toastServiceSpy.error).toHaveBeenCalledWith('An unexpected error occurred.', 'Error');
  });

  it('should use error message from response body if available', () => {
    const error = new HttpErrorResponse({ 
      status: 400, 
      statusText: 'Bad Request',
      error: { message: 'Validation failed: email is required' }
    });
    service.handleError(error);
    
    expect(toastServiceSpy.error).toHaveBeenCalledWith('Validation failed: email is required', 'Error');
  });
});
