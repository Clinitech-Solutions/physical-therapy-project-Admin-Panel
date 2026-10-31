import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { registerLocaleData } from '@angular/common';
import ar from '@angular/common/locales/ar';
import { BillingComponent } from './billing';
import { environment } from '../../../../environments/environment';

registerLocaleData(ar);

describe('Rendered Billing collection input', () => {
  beforeEach(() => {
    // Isolate the collection form from unrelated page lookups.
    vi.spyOn(BillingComponent.prototype, 'ngOnInit').mockImplementation(() => {});
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false, addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {},
    }));
  });
  afterEach(() => { sessionStorage.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  for (const language of ['ar', 'en']) {
    it(`preserves the amount on method selection and decimal edits in ${language}`, async () => {
      sessionStorage.clear();
      TestBed.configureTestingModule({
        imports: [BillingComponent, TranslateModule.forRoot()],
        providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(), MessageService],
      });
      const translate = TestBed.inject(TranslateService);
      translate.setTranslation(language, {});
      translate.use(language);
      const http = TestBed.inject(HttpTestingController);
      const fixture = TestBed.createComponent(BillingComponent);
      const c = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
      c.openAccountPayment({key: 'course:1', remainingAmount: 1234.5} as never);
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const input = document.querySelector<HTMLInputElement>('#billing-collection-amount')!;
      expect(input.disabled).toBe(false);
      expect(input.value).toContain('1,234.50');
      input.focus();
      input.blur();
      await fixture.whenStable();
      expect(c.amountToCollect).toBe(1234.5);

      document.querySelector<HTMLElement>('.p-dialog .p-select')!.click();
      await fixture.whenStable();
      document.querySelector<HTMLElement>('[role="option"]')!.click();
      await fixture.whenStable();
      expect(c.selectedPaymentMethod).toBe('Cash');
      expect(c.amountToCollect).toBe(1234.5);
      expect(input.disabled).toBe(false);

      input.focus();
      input.value = '25.50';
      input.dispatchEvent(new Event('input', {bubbles: true}));
      input.blur();
      await fixture.whenStable();
      expect(c.amountToCollect).toBe(25.5);
      expect(input.value).toContain('25.50');

      // Verify the amount crossing the HTTP boundary, not just its display.
      const saving = c.confirmPayment();
      const request = http.expectOne(environment.apiUrl + '/Bookings/accounts/course%3A1/payments');
      expect(request.request.body.amount).toBe(25.5);
      expect(request.request.body.method).toBe('Cash');
      request.error(new ProgressEvent('error'));
      await saving;
      fixture.detectChanges();
      await fixture.whenStable();
      expect(input.disabled).toBe(true);
      expect(c.amountToCollect).toBe(25.5);
      fixture.destroy();
      http.verify();
    });
  }
});
