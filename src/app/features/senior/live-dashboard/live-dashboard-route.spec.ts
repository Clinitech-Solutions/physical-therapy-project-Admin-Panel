import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { signal } from "@angular/core";
import { provideRouter, Router } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { TranslateModule } from "@ngx-translate/core";
import { By } from "@angular/platform-browser";
import { routes } from "../../../app.routes";
import { AuthService } from "../../../core/services/auth";
import { environment } from "../../../../environments/environment";
import { ReassessmentQueue } from "../../../shared/components/reassessment-queue/reassessment-queue";
import { LiveDashboard } from "./live-dashboard";

describe.each(["Senior", "Admin", "SuperAdmin", "Ceo"])(
  "Senior dashboard route as %s",
  (role) => {
    let harness: RouterTestingHarness;
    let http: HttpTestingController;
    let dashboard: LiveDashboard;
    let queue: ReassessmentQueue;
    const api = environment.apiUrl;

    beforeEach(async () => {
      const currentUser = signal({ id: "senior", roles: [role] });
      const route = routes
        .find((r) => r.children)
        ?.children?.find((r) => r.path === "senior/dashboard");
      if (!route) throw new Error("Senior sidebar destination must exist");
      await TestBed.configureTestingModule({
        imports: [TranslateModule.forRoot()],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([route]),
          {
            provide: AuthService,
            useValue: {
              currentUser,
              isAuthenticated: () => true,
              hasRole: (expected: string) =>
                currentUser().roles.includes(expected),
            },
          },
        ],
      }).compileComponents();
      http = TestBed.inject(HttpTestingController);
      harness = await RouterTestingHarness.create();
      dashboard = await harness.navigateByUrl(
        "/senior/dashboard",
        LiveDashboard,
      );
      http
        .expectOne((r) => r.url === `${api}/Appointments/GetAll`)
        .flush({ items: [], pageNumber: 1, totalPages: 1, hasNextPage: false });
      http.expectOne(`${api}/Bookings/clinicians/workload`).flush([]);
      http.expectOne(`${api}/ReassessmentRequests`).flush([]);
      await harness.fixture.whenStable();
      harness.detectChanges();
      queue = harness.routeDebugElement!.query(
        By.directive(ReassessmentQueue),
      ).componentInstance;
    });

    afterEach(() => {
      harness.fixture.destroy();
      http.verify();
    });

    it("renders both tabs and exactly one embedded queue after the three summary cards", async () => {
      const host: HTMLElement = harness.routeNativeElement!;
      const summaries = host.querySelector(".senior-summary")!;
      const taskGrid = host.querySelector(".senior-task-grid")!;
      expect(summaries.children.length).toBe(3);
      expect(
        summaries.previousElementSibling?.classList.contains("page-header"),
      ).toBe(true);
      expect(summaries.nextElementSibling).toBe(taskGrid);
      expect(host.querySelectorAll("app-reassessment-queue").length).toBe(1);
      expect(
        host.querySelector("#senior-reassessment-panel app-reassessment-queue"),
      ).not.toBeNull();
      expect(host.querySelectorAll("[role=tab]").length).toBe(2);
      expect(
        host.querySelector("#senior-task-tab-reassessments")?.textContent,
      ).toContain("(0)");
      expect(
        (host.querySelector("#senior-reassessment-panel") as HTMLElement)
          .hidden,
      ).toBe(true);
      (
        host.querySelector(
          "#senior-task-tab-reassessments",
        ) as HTMLButtonElement
      ).click();
      await harness.fixture.whenStable();
      harness.detectChanges();
      expect(
        (host.querySelector("#senior-reassessment-panel") as HTMLElement)
          .hidden,
      ).toBe(false);
      expect(
        (host.querySelector("#senior-assessment-panel") as HTMLElement).hidden,
      ).toBe(true);
      expect(
        host.querySelectorAll("#senior-reassessment-panel .queue-refresh")
          .length,
      ).toBe(1);
    });

    it("distinguishes queue failure from zero and recovers the real pending count", async () => {
      const loading = queue.load();
      http
        .expectOne(`${api}/ReassessmentRequests`)
        .flush({}, { status: 503, statusText: "Unavailable" });
      await loading;
      harness.detectChanges();
      expect(dashboard.reviewCount()).toBeNull();
      expect(
        harness.routeNativeElement!.querySelector(
          "#senior-task-tab-reassessments",
        )?.textContent,
      ).not.toContain("(0)");
      expect(
        harness.routeNativeElement!.querySelector(".queue-error"),
      ).not.toBeNull();
      const retry = queue.load();
      http.expectOne(`${api}/ReassessmentRequests`).flush(
        [
          { id: 1, state: "Requested", requestedAt: "2026-11-04T10:00:00Z" },
          { id: 2, state: "InReview", requestedAt: "2026-11-04T09:00:00Z" },
          { id: 3, state: "Completed", requestedAt: "2026-11-03T10:00:00Z" },
          { id: 4, state: "Cancelled", requestedAt: "2026-11-02T10:00:00Z" },
        ].map((row) => ({
          ...row,
          patientName: "Synthetic Patient",
          requestedBy: "Synthetic Doctor",
          reasonCategory: "Other",
        })),
      );
      await retry;
      harness.detectChanges();
      expect(dashboard.reviewCount()).toBe(2);
      expect(queue.visible().map((row) => row.state)).toEqual([
        "InReview",
        "Requested",
      ]);
      queue.selectFilter("history");
      await harness.fixture.whenStable();
      harness.detectChanges();
      expect(queue.visible().map((row) => row.state)).toEqual([
        "Completed",
        "Cancelled",
      ]);
    });

    it("restores the selected task tab and History filter from review return parameters", async () => {
      await TestBed.inject(Router).navigateByUrl(
        "/senior/dashboard?taskTab=reassessments&reviewFilter=history&focusReview=3",
      );
      await harness.fixture.whenStable();
      harness.detectChanges();
      expect(dashboard.activeTab()).toBe("reassessments");
      expect(queue.filter()).toBe("history");
      expect(
        harness
          .routeNativeElement!.querySelector("#senior-task-tab-reassessments")
          ?.getAttribute("aria-selected"),
      ).toBe("true");
      dashboard.switchTab("assessments");
      await harness.fixture.whenStable();
      expect(TestBed.inject(Router).url).toContain("reviewFilter=history");
    });
  },
);
