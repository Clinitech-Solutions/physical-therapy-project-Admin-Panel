import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { firstValueFrom } from "rxjs";
import { CourseFinanceService } from "../../../core/services/course-finance.service";
import { InsurerAccountsComponent } from "./insurer-accounts";
import { environment } from "../../../../environments/environment";

describe("Insurer recovery uses the original financial operation", () => {
  let api: CourseFinanceService, http: HttpTestingController;
  const base = environment.apiUrl + "/Finance";
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(CourseFinanceService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });
  it("retries a committed claim as a claim after reload, never as an insurer receipt", async () => {
    const original = firstValueFrom(
      api.claim(10, "claim-original", "CLAIM-1"),
    ).catch((e) => e);
    http
      .expectOne(base + "/insurance/claims")
      .error(new ProgressEvent("error"));
    await original;
    const c = TestBed.runInInjectionContext(
      () => new InsurerAccountsComponent(),
    );
    const saved = {
      companies: [],
      receivables: [{ invoiceId: 10, claimId: 8, outstandingAmount: 80 }],
    };
    const loading = c.load();
    http.expectOne(base + "/insurance/accounts").flush(saved);
    await loading;
    expect(c.isSettlement).toBe(false);
    expect(c.retryKey).toBe("claim-original");
    expect(c.reference).toBe("CLAIM-1");
    const retry = c.save();
    const request = http.expectOne(base + "/insurance/claims");
    expect(request.request.body.idempotencyKey).toBe("claim-original");
    request.flush({ id: 8, invoiceId: 10 });
    await Promise.resolve();
    await Promise.resolve();
    http.expectOne(base + "/insurance/accounts").flush(saved);
    await retry;
    http.expectNone((r) => r.url.includes("/settlements"));
  });
  it("can recover a fully committed settlement even when the refreshed outstanding balance is zero", async () => {
    const original = firstValueFrom(
      api.settle(8, "receipt-original", 80, "Online", "BANK-1"),
    ).catch((e) => e);
    http
      .expectOne(base + "/insurance/claims/8/settlements")
      .error(new ProgressEvent("error"));
    await original;
    const c = TestBed.runInInjectionContext(
      () => new InsurerAccountsComponent(),
    );
    const saved = {
      companies: [],
      receivables: [{ invoiceId: 10, claimId: 8, outstandingAmount: 0 }],
    };
    const loading = c.load();
    http.expectOne(base + "/insurance/accounts").flush(saved);
    await loading;
    expect(c.isSettlement).toBe(true);
    expect(c.amount).toBe(80);
    expect(c.method).toBe("Online");
    const retry = c.save();
    const request = http.expectOne(base + "/insurance/claims/8/settlements");
    expect(request.request.body).toEqual({
      idempotencyKey: "receipt-original",
      amount: 80,
      method: "Online",
      settlementReference: "BANK-1",
    });
    request.flush({ paymentId: 100 });
    await Promise.resolve();
    await Promise.resolve();
    http.expectOne(base + "/insurance/accounts").flush(saved);
    await retry;
    expect(c.retryKey).toBeNull();
  });
});
