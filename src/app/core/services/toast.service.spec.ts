import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ToastService, Toast } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with empty toasts array', (done) => {
    service.toasts$.subscribe(toasts => {
      expect(toasts.length).toBe(0);
      done();
    });
  });

  it('should add a toast when show() is called', (done) => {
    service.show({ type: 'success', title: 'Test title', message: 'Test message' });
    
    service.toasts$.subscribe(toasts => {
      expect(toasts.length).toBe(1);
      expect(toasts[0].message).toBe('Test message');
      expect(toasts[0].title).toBe('Test title');
      expect(toasts[0].type).toBe('success');
      done();
    });
  });

  it('should add success toast via success() method', (done) => {
    service.success('Success title', 'Success message');
    
    service.toasts$.subscribe(toasts => {
      expect(toasts.length).toBe(1);
      expect(toasts[0].type).toBe('success');
      expect(toasts[0].title).toBe('Success title');
      done();
    });
  });

  it('should add error toast via error() method', (done) => {
    service.error('Error title', 'Error message');
    
    service.toasts$.subscribe(toasts => {
      expect(toasts.length).toBe(1);
      expect(toasts[0].type).toBe('error');
      expect(toasts[0].title).toBe('Error title');
      done();
    });
  });

  it('should add warning toast via warning() method', (done) => {
    service.warning('Warning title', 'Warning message');
    
    service.toasts$.subscribe(toasts => {
      expect(toasts.length).toBe(1);
      expect(toasts[0].type).toBe('warning');
      expect(toasts[0].title).toBe('Warning title');
      done();
    });
  });

  it('should add info toast via info() method', (done) => {
    service.info('Info title', 'Info message');
    
    service.toasts$.subscribe(toasts => {
      expect(toasts.length).toBe(1);
      expect(toasts[0].type).toBe('info');
      expect(toasts[0].title).toBe('Info title');
      done();
    });
  });

  it('should remove toast when dismiss() is called', (done) => {
    service.success('Test');
    
    let toastId: string;
    service.toasts$.subscribe(toasts => {
      if (toasts.length > 0) {
        toastId = toasts[0].id;
        service.dismiss(toastId);
      } else if (toastId) {
        expect(toasts.length).toBe(0);
        done();
      }
    });
  });

  it('should clear all toasts when clear() is called', (done) => {
    service.success('Message 1');
    service.success('Message 2');
    service.success('Message 3');
    
    service.clear();
    
    service.toasts$.subscribe(toasts => {
      expect(toasts.length).toBe(0);
      done();
    });
  });

  it('should auto-remove toast after duration', fakeAsync(() => {
    service.show({ type: 'success', title: 'Auto remove test', message: '', duration: 1000 });
    
    let toastCount = 0;
    service.toasts$.subscribe(toasts => {
      toastCount = toasts.length;
    });
    
    expect(toastCount).toBe(1);
    
    tick(1100);
    
    expect(toastCount).toBe(0);
  }));

  it('should generate unique IDs for each toast', (done) => {
    service.success('Message 1');
    service.success('Message 2');
    
    service.toasts$.subscribe(toasts => {
      if (toasts.length === 2) {
        expect(toasts[0].id).not.toBe(toasts[1].id);
        done();
      }
    });
  });
});
