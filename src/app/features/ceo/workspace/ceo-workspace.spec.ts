import { TestBed } from "@angular/core/testing";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { provideHttpClient } from "@angular/common/http";
import { ActivatedRoute, Router, convertToParamMap } from "@angular/router";
import { TranslateModule } from "@ngx-translate/core";
import { BehaviorSubject } from "rxjs";
import { Dashboard } from "../dashboard/dashboard";
import { Reports } from "../reports/reports";
import { Settings } from "../settings/settings";
import { environment } from "../../../../environments/environment";

describe("CEO workspace data and recovery boundaries", () => {
  let http: HttpTestingController;
  const params = new BehaviorSubject(
    convertToParamMap({ from: "2026-11-01", to: "2026-11-21" }),
  );
  beforeEach(() => {
    params.next(convertToParamMap({ from: "2026-11-01", to: "2026-11-21" }));
    TestBed.configureTestingModule({
      imports: [Dashboard, Reports, Settings, TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { queryParamMap: params } },
        {
          provide: Router,
          useValue: { navigate: vi.fn().mockResolvedValue(true) },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it("keeps failed Overview data unavailable and renders genuine server zero after retry", () => {
    const f = TestBed.createComponent(Dashboard);
    f.detectChanges();
    http
      .expectOne((r) => r.url.endsWith("/ceo/overview"))
      .flush(
        { detail: "Unavailable" },
        { status: 503, statusText: "Unavailable" },
      );
    f.detectChanges();
    expect(f.componentInstance.data()).toBeNull();
    expect(f.nativeElement.textContent).toContain("Unavailable");
    expect(f.nativeElement.textContent).not.toMatch(/EGP\s*0\.00/);
    params.next(
      convertToParamMap({ from: "2026-11-01", to: "2026-11-21", retry: "1" }),
    );
    http
      .expectOne((r) => r.url.endsWith("/ceo/overview"))
      .flush({
        generatedAt: "2026-11-21T10:00:00Z",
        from: "2026-11-01",
        to: "2026-11-21",
        patientCollections: 0,
        insurerCollections: 0,
        patientOutstanding: 0,
        earnedInsurerOutstanding: 0,
        plannedInsurerLiability: 0,
        scheduled: 0,
        clinicallyCompleted: 0,
        cancelled: 0,
        noShow: 0,
        occupied: 0,
        activeRoomCapacity: 0,
        availableRoomSlots: 0,
        unsubmittedServices: 0,
        outstandingClaims: 0,
        unresolvedAbsenceWork: 0,
        collections: [],
      });
    f.detectChanges();
    expect(f.componentInstance.error()).toBe("");
    expect(f.nativeElement.textContent).toMatch(/EGP\s*0\.00/);
    f.destroy();
  });
  it("exports the applied report scope and retains a full-scope total independently of the visible page", () => {
    const f = TestBed.createComponent(Reports);
    f.detectChanges();
    http
      .expectOne((r) => r.url.endsWith("/report-options"))
      .flush({ companies: [], clinicians: [] });
    http
      .expectOne((r) => r.url.endsWith("/reports/patient-collections"))
      .flush({
        kind: "patient-collections",
        dateBasis: "Collection",
        generatedAt: "2026-11-21T10:00:00Z",
        from: "2026-11-01",
        to: "2026-11-21",
        page: 1,
        pageSize: 20,
        total: 75,
        totals: { amount: 3750, collected: 3750, remaining: 0, rows: 75 },
        items: [],
      });
    expect(f.componentInstance.pageCount).toBe(4);
    f.componentInstance.draft["companyId"] = 99;
    f.componentInstance.export();
    const request = http.expectOne((r) =>
      r.url.endsWith("/patient-collections/export"),
    );
    expect(request.request.params.get("from")).toBe("2026-11-01");
    expect(request.request.params.has("companyId")).toBe(false);
    request.flush(new Blob(["Unavailable"]), {
      status: 503,
      statusText: "Unavailable",
    });
    expect(f.componentInstance.error()).toBeTruthy();
    f.destroy();
  });
  it("preserves edited settings and their original version on a competing save", () => {
    const f = TestBed.createComponent(Settings);
    f.detectChanges();
    http
      .expectOne(environment.apiUrl + "/ceo/settings")
      .flush({
        name: "Clinic",
        phone: null,
        address: null,
        email: null,
        version: 3,
        updatedAt: null,
        updatedBy: null,
      });
    f.componentInstance.model!.name = "Edited clinic";
    f.componentInstance.save({
      invalid: false,
      control: { markAllAsTouched: () => {} },
    } as never);
    const r = http.expectOne(environment.apiUrl + "/ceo/settings");
    expect(r.request.body.version).toBe(3);
    r.flush(
      { detail: "Settings changed. Reload before saving." },
      { status: 409, statusText: "Conflict" },
    );
    expect(f.componentInstance.model!.name).toBe("Edited clinic");
    expect(f.componentInstance.model!.version).toBe(3);
    expect(f.componentInstance.saved()).toBe(false);
    expect(f.componentInstance.saving()).toBe(false);
    f.destroy();
  });
});
