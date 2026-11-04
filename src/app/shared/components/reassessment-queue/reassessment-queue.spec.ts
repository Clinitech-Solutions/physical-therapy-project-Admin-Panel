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
  afterEach(() => { http.verify(); vi.useRealTimers(); });
  it('refreshes the pending count when a review is completed in another workspace', async () => {
    vi.useFakeTimers();
    queue.ngOnInit();
    http.expectOne(environment.apiUrl + '/ReassessmentRequests').flush([{id:1,state:'Requested',requestedAt:'2030-02-04T10:00:00Z'}]);
    await Promise.resolve(); await Promise.resolve();
    expect(queue.pending()).toBe(1);
    await vi.advanceTimersByTimeAsync(30000);
    http.expectOne(environment.apiUrl + '/ReassessmentRequests').flush([{id:1,state:'Completed',requestedAt:'2030-02-04T10:00:00Z'}]);
    await Promise.resolve(); await Promise.resolve();
    expect(queue.pending()).toBe(0);
    expect(queue.visible()).toEqual([]);
    queue.includeHistory.set(true);
    expect(queue.visible()[0].state).toBe('Completed');
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
    queue.includeHistory.set(true);
    expect(queue.visible().map((r) => r.id)).toEqual([3, 2, 1]);
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
});
