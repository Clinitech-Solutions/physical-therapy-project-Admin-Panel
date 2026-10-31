import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { User } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth';
import { LanguageService } from '../../../core/services/language';
import { ThemeService } from '../../../core/services/theme';
import { environment } from '../../../../environments/environment';
import { Login } from './login';

describe('Login routing', () => {
  let component: Login;
  const currentUser = signal<User | null>(null);
  const login = vi.fn();
  const navigate = vi.fn();
  const addMessage = vi.fn();

  function setRoles(roles: string[]) {
    currentUser.set({ id: 'user-1', email: 'user@example.com', roles });
  }

  beforeEach(() => {
    currentUser.set(null);
    login.mockReset().mockReturnValue(of({ token: 'token' }));
    navigate.mockReset();
    addMessage.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: {
          currentUser,
          login,
          hasRole: (role: string) => currentUser()?.roles.includes(role) ?? false,
        } },
        { provide: Router, useValue: { navigate } },
        { provide: MessageService, useValue: { add: addMessage } },
        { provide: ThemeService, useValue: {} },
        { provide: LanguageService, useValue: {} },
      ],
    });
    component = TestBed.runInInjectionContext(() => new Login());
    component.loginForm.setValue({ userName: 'user', password: 'password' });
  });

  it.each([
    [['SuperAdmin'], '/receptionist/dashboard'],
    [['Ceo', 'SuperAdmin'], '/receptionist/dashboard'],
    [['Ceo'], '/ceo'],
    [['Admin'], '/receptionist/dashboard'],
    [['Ceo', 'Admin'], '/receptionist/dashboard'],
    [['Senior'], '/senior/dashboard'],
    [['Doctor'], '/doctor'],
    [['Receptionist'], '/receptionist/dashboard'],
  ])('routes roles %j to %s after login', (roles, destination) => {
    login.mockImplementation(() => {
      setRoles(roles);
      return of({ token: 'token' });
    });

    component.onSubmit();

    expect(navigate).toHaveBeenCalledExactlyOnceWith([destination]);
    expect(component.isSubmitting()).toBe(false);
  });

  it.each(['Admin', 'SuperAdmin'])('opens the receptionist dashboard for an existing %s session', (role) => {
    setRoles([role]);

    component.ngOnInit();

    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/receptionist/dashboard']);
    expect(login).not.toHaveBeenCalled();
  });

  it('keeps the login page open for a visitor without a session', () => {
    component.ngOnInit();

    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not submit or navigate with invalid credentials', () => {
    component.loginForm.setValue({ userName: '', password: '' });

    component.onSubmit();

    expect(login).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('stays on login and clears the submitting state when authentication fails', () => {
    login.mockReturnValue(throwError(() => new Error('Unauthorized')));

    component.onSubmit();

    expect(navigate).not.toHaveBeenCalled();
    expect(component.isSubmitting()).toBe(false);
    expect(addMessage).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
  });
});

describe('SuperAdmin login with backend JWT claims', () => {
  let component: Login;
  let http: HttpTestingController;
  const navigate = vi.fn();

  // The backend seeds username SuperAdmin with the Admin role.
  function backendToken() {
    const payload = { sub: 'admin-1', name: 'SuperAdmin', roles: ['Admin'] };
    return `header.${btoa(JSON.stringify(payload))}.signature`;
  }

  beforeEach(() => {
    localStorage.removeItem('mediqova-token');
    navigate.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate } },
        { provide: MessageService, useValue: { add: vi.fn() } },
        { provide: ThemeService, useValue: {} },
        { provide: LanguageService, useValue: {} },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem('mediqova-token');
  });

  it('routes the seeded SuperAdmin account to the receptionist dashboard after the API responds', () => {
    component = TestBed.runInInjectionContext(() => new Login());
    component.loginForm.setValue({ userName: 'SuperAdmin', password: 'test-password' });

    component.onSubmit();

    const request = http.expectOne(`${environment.apiUrl}/auth/login`);
    expect(request.request.method).toBe('POST');
    expect(navigate).not.toHaveBeenCalled();
    request.flush({ token: backendToken() });

    expect(TestBed.inject(AuthService).currentUser()?.roles).toEqual(['Admin']);
    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/receptionist/dashboard']);
  });

  it('routes a restored backend Admin token to the receptionist dashboard', () => {
    localStorage.setItem('mediqova-token', backendToken());
    component = TestBed.runInInjectionContext(() => new Login());

    component.ngOnInit();

    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/receptionist/dashboard']);
    http.expectNone(`${environment.apiUrl}/auth/login`);
  });
});
