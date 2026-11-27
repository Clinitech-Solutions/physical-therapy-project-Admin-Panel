import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TranslateModule } from "@ngx-translate/core";
import { ReassessmentQueue } from "./reassessment-queue";
import { environment } from "../../../../environments/environment";
import { ReassessmentRequest } from "../../../core/models/doctor-workspace.model";
import { DoctorWorkspaceService } from "../../../core/services/doctor-workspace.service";

describe("Reassessment queue", () => {
  let queue: ReassessmentQueue, http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    queue = TestBed.runInInjectionContext(() => new ReassessmentQueue());
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  it("refreshes the pending count when a review is completed in another workspace", async () => {
    vi.useFakeTimers();
    queue.ngOnInit();
    await vi.advanceTimersByTimeAsync(1000); // Response latency must not skip the first polling tick.
    http
      .expectOne(environment.apiUrl + "/ReassessmentRequests")
      .flush([
        { id: 1, state: "Requested", requestedAt: "2030-02-04T10:00:00Z" },
      ]);
    await Promise.resolve();
    await Promise.resolve();
    expect(queue.pending()).toBe(1);
    await vi.advanceTimersByTimeAsync(58999);
    http.expectNone(environment.apiUrl + "/ReassessmentRequests");
    await vi.advanceTimersByTimeAsync(1);
    http
      .expectOne(environment.apiUrl + "/ReassessmentRequests")
      .flush([
        { id: 1, state: "Completed", requestedAt: "2030-02-04T10:00:00Z" },
      ]);
    await Promise.resolve();
    await Promise.resolve();
    expect(queue.pending()).toBe(0);
    expect(queue.visible()).toEqual([]);
    queue.filter.set("history");
    expect(queue.visible()[0].state).toBe("Completed");
  });
  it("puts actionable requests first, counts only active requests, and retains saved history", async () => {
    const loading = queue.load();
    http.expectOne(environment.apiUrl + "/ReassessmentRequests").flush([
      { id: 1, state: "Completed", requestedAt: "2030-02-06T10:00:00Z" },
      { id: 2, state: "Requested", requestedAt: "2030-02-05T10:00:00Z" },
      { id: 3, state: "InReview", requestedAt: "2030-02-04T10:00:00Z" },
    ] as ReassessmentRequest[]);
    await loading;
    expect(queue.pending()).toBe(2);
    expect(queue.visible().map((r) => r.id)).toEqual([3, 2]);
    queue.filter.set("history");
    expect(queue.visible().map((r) => r.id)).toEqual([1]);
  });
  it("reports a failed load separately from an empty queue and supports retry", async () => {
    const loading = queue.load();
    await queue.load(); // One in-flight load; polling/manual refresh cannot race.
    http
      .expectOne(environment.apiUrl + "/ReassessmentRequests")
      .flush({}, { status: 503, statusText: "Unavailable" });
    await loading;
    expect(queue.error()).not.toBe("");
    const retry = queue.load();
    http.expectOne(environment.apiUrl + "/ReassessmentRequests").flush([]);
    await retry;
    expect(queue.error()).toBe("");
    expect(queue.pending()).toBe(0);
  });
  it.each([false, true])("retains the %s empty/populated DOM and history selection during refresh", async (empty) => {
    const fixture = TestBed.createComponent(ReassessmentQueue);
    fixture.detectChanges();
    const data = empty ? [] : [{ id: 1, patientName: "Saved Patient", state: "Requested", requestedAt: "2030-02-04T10:00:00Z", reasonCategory: "Other", requestedBy: "Doctor", recommendation: "Continue" }];
    http.expectOne(environment.apiUrl + "/ReassessmentRequests").flush(data);
    await fixture.whenStable();
    fixture.componentInstance.includeHistory.set(true);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const original = host.querySelector(empty ? "app-table-empty" : "article");
    const checkbox = host.querySelector("input")!;
    checkbox.focus();
    const refresh = fixture.componentInstance.load(true);
    fixture.detectChanges();
    expect(host.querySelector("app-table-loading")).toBeNull();
    expect(host.querySelector(empty ? "app-table-empty" : "article")).toBe(original);
    expect(host.querySelector(".queue-count")).not.toBeNull();
    http.expectOne(environment.apiUrl + "/ReassessmentRequests").flush(data);
    await refresh;
    fixture.detectChanges();
    expect(host.querySelector(empty ? "app-table-empty" : "article")).toBe(original);
    expect(document.activeElement).toBe(checkbox);
    expect(checkbox.checked).toBe(true);
    fixture.destroy();
  });
  it("pauses hidden-tab polling, refreshes on stale return and retains rows on failure", async () => {
    vi.useFakeTimers();
    let visibility = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility as DocumentVisibilityState);
    queue.ngOnInit();
    http.expectOne(environment.apiUrl + "/ReassessmentRequests").flush([{ id: 1, state: "Requested" }]);
    await Promise.resolve(); await Promise.resolve();
    visibility = "hidden";
    await vi.advanceTimersByTimeAsync(60000);
    http.expectNone(environment.apiUrl + "/ReassessmentRequests");
    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    http.expectOne(environment.apiUrl + "/ReassessmentRequests").flush({}, { status: 503, statusText: "Unavailable" });
    await Promise.resolve(); await Promise.resolve();
    expect(queue.rows()[0].id).toBe(1);
    expect(queue.error()).not.toBe("");
  });
  it("preserves the Senior review queue's existing 30-second cadence", async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(ReassessmentQueue);
    fixture.componentRef.setInput("review", true);
    fixture.detectChanges();
    http.expectOne(environment.apiUrl + "/ReassessmentRequests").flush([]);
    await Promise.resolve(); await Promise.resolve();
    await vi.advanceTimersByTimeAsync(30000);
    http.expectOne(environment.apiUrl + "/ReassessmentRequests").flush([]);
    await Promise.resolve(); await Promise.resolve();
    fixture.destroy();
  });
  it.each(["create", "start", "complete", "cancel"] as const)("refreshes only reassessments after a successful local %s", async (action) => {
    queue.ngOnInit();
    http.expectOne(environment.apiUrl + "/ReassessmentRequests").flush([]);
    await Promise.resolve(); await Promise.resolve();
    const api = TestBed.inject(DoctorWorkspaceService);
    const mutation = action === "create" ? api.request(17, { operationKey: "test", reasonCategory: "Other", notes: "Saved", recommendation: "Continue" })
      : action === "start" ? api.startReview(1, 1)
      : action === "complete" ? api.completeReview(1, { expectedVersion: 1, progressNotes: "Saved", decision: "Continue", diagnosis: "Saved", doctorId: "doctor", numberOfSessions: 1, frequencyPerWeek: 1, treatmentType: "Rehabilitation", exercises: null })
      : api.cancelReview(1, 1, "Reason");
    mutation.subscribe();
    http.expectOne(r => r.method === "POST").flush({ id: 1 });
    http.expectOne(environment.apiUrl + "/ReassessmentRequests").flush([{ id: 1, state: "Requested" }]);
    await Promise.resolve(); await Promise.resolve();
    expect(queue.pending()).toBe(1);
    http.expectNone(r => !r.url.includes("/ReassessmentRequests"));
  });
  it("coalesces writes arriving during a read and cancels reads when destroyed", async () => {
    queue.ngOnInit();
    const stale = http.expectOne(environment.apiUrl + "/ReassessmentRequests");
    const api = TestBed.inject(DoctorWorkspaceService);
    for (let i = 0; i < 2; i++) {
      api.cancelReview(1, 1, "Reason").subscribe();
      http.expectOne(r => r.method === "POST").flush({ id: 1 });
    }
    stale.flush([]);
    await Promise.resolve(); await Promise.resolve();
    const current = http.expectOne(environment.apiUrl + "/ReassessmentRequests");
    TestBed.resetTestingModule();
    expect(current.cancelled).toBe(true);
    await Promise.resolve(); await Promise.resolve();
  });
});
