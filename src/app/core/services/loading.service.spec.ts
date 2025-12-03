import { TestBed } from '@angular/core/testing';
import { LoadingService } from './loading.service';

describe('LoadingService', () => {
  let service: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoadingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with loading as false', (done) => {
    service.loading$.subscribe(loading => {
      expect(loading).toBeFalse();
      done();
    });
  });

  it('should set loading to true when show() is called', (done) => {
    service.show();
    service.loading$.subscribe(loading => {
      expect(loading).toBeTrue();
      done();
    });
  });

  it('should set loading to false when hide() is called', (done) => {
    service.show();
    service.hide();
    service.loading$.subscribe(loading => {
      expect(loading).toBeFalse();
      done();
    });
  });

  it('should track multiple loading states with different keys', () => {
    service.show('request1');
    service.show('request2');
    
    expect(service.isLoading()).toBeTrue();

    service.hide('request1');
    expect(service.isLoading()).toBeTrue();

    service.hide('request2');
    expect(service.isLoading()).toBeFalse();
  });

  it('should clear all loading states', () => {
    service.show('request1');
    service.show('request2');
    service.show('request3');
    
    expect(service.isLoading()).toBeTrue();

    service.clear();
    
    expect(service.isLoading()).toBeFalse();
  });

  it('should handle hide called before show gracefully', () => {
    service.hide();
    expect(service.isLoading()).toBeFalse();
  });

  it('should use default key when no key provided', () => {
    service.show();
    expect(service.isLoading()).toBeTrue();
    
    service.hide();
    expect(service.isLoading()).toBeFalse();
  });
});
