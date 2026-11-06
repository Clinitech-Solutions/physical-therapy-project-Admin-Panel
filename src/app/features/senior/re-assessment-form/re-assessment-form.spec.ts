import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { ActivatedRoute, convertToParamMap } from "@angular/router";
import { TranslateModule } from "@ngx-translate/core";
import { BehaviorSubject } from "rxjs";
import { ReAssessmentForm } from "./re-assessment-form";
import { ReassessmentRequest } from "../../../core/models/doctor-workspace.model";
import { environment } from "../../../../environments/environment";
import { AuthService } from "../../../core/services/auth";
import { signal } from "@angular/core";
const request: ReassessmentRequest = {
  id: 1,
  patientId: 2,
  patientName: "Assigned clinical patient",
  treatmentPlanId: 3,
  relatedAppointmentId: 10,
  requestedBy: "Doctor",
  requestedAt: "2030-02-04T10:00:00Z",
  reasonCategory: "ProgressConcern",
  notes: "Please review",
  recommendation: "Pause",
  state: "Requested",
  reviewStartedAt: null,
  seniorId: null,
  seniorName: null,
  completedAssessmentId: null,
  revisedPlanId: null,
  cancellationReason: null,
  version: 1,
  diagnosis: "Saved diagnosis",
  exercises: "Saved instructions",
  previousSessions: [],
  prescribedSessions: 10,
  completedSessions: 2,
  treatmentType: "Physio",
  frequencyPerWeek: 2,
  doctorId: "doctor",
  doctorName: "Doctor",
  reviewNotes: null,
  decision: null,
};
describe("Direct Senior clinical review without scheduling or finance", () => {
  let c: ReAssessmentForm, http: HttpTestingController;
  let route: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  beforeEach(async () => {
    route = new BehaviorSubject(convertToParamMap({ requestId: 1 }));
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        {
          provide: AuthService,
          useValue: {
            currentUser: signal({ id: "signed-in-senior", roles: ["Senior"] }),
          },
        },
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: route },
        },
      ],
    });
    c = TestBed.runInInjectionContext(() => new ReAssessmentForm());
    http = TestBed.inject(HttpTestingController);
    c.ngOnInit();
    http
      .expectOne(environment.apiUrl + "/ReassessmentRequests/1")
      .flush(structuredClone(request));
    await Promise.resolve();
    await Promise.resolve();
  });
  afterEach(() => http.verify());
  it("keeps the originating queue filter and row ID in its back link", () => {
    route.next(
      convertToParamMap({
        requestId: 1,
        origin: "dashboard",
        reviewFilter: "history",
      }),
    );
    http
      .expectOne(environment.apiUrl + "/ReassessmentRequests/1")
      .flush(request);
    expect(c.backParams()).toEqual({
      reviewFilter: "history",
      focusReview: 1,
      taskTab: "reassessments",
    });
  });
  it("shows review actions only for an eligible role and the assigned reviewer once claimed", () => {
    expect(c.canAct()).toBe(true);
    c.data.set({ ...request, state: "InReview", seniorId: "other-senior" });
    expect(c.canAct()).toBe(false);
    c.data.set({ ...request, state: "InReview", seniorId: "signed-in-senior" });
    expect(c.canAct()).toBe(true);
  });
  it("starts a pending same-visit review directly with its saved version", async () => {
    const starting = c.start();
    const r = http.expectOne(
      environment.apiUrl + "/ReassessmentRequests/1/start",
    );
    expect(r.request.body).toEqual({ expectedVersion: 1 });
    r.flush({ ...request, state: "InReview", version: 2 });
    await starting;
    expect(c.data()!.state).toBe("InReview");
    http.expectNone(
      (r) =>
        r.url.includes("/Appointments") ||
        r.url.includes("/Billing") ||
        r.url.includes("/payments"),
    );
  });
  it("preserves clinical text after failed completion and retries the exact original body", async () => {
    c.data.set({ ...request, state: "InReview", version: 2 });
    c.notes = "Senior clinical review";
    const completing = c.submit();
    const r = http.expectOne(
      environment.apiUrl + "/ReassessmentRequests/1/complete",
    );
    const original = r.request.body;
    r.error(new ProgressEvent("error"));
    await completing;
    expect(c.notes).toBe("Senior clinical review");
    expect(c.data()!.state).toBe("InReview");
    expect(c.completionIntent).toEqual(original);
    const retry = c.submit();
    const second = http.expectOne(
      environment.apiUrl + "/ReassessmentRequests/1/complete",
    );
    expect(second.request.body).toEqual(original);
    second.flush({
      ...request,
      state: "Completed",
      version: 3,
      reviewNotes: original.progressNotes,
    });
    await retry;
    expect(c.data()!.state).toBe("Completed");
  });
  it("does not complete without clinical notes or cancel without a reason", async () => {
    c.data.set({ ...request, state: "InReview", version: 2 });
    await c.submit();
    await c.cancel();
    http.expectNone((r) => r.method === "POST");
  });
  it("ignores a late start response after switching to another request and clears the previous draft", async () => {
    const starting = c.start();
    const old = http.expectOne(
      environment.apiUrl + "/ReassessmentRequests/1/start",
    );
    c.notes = "Patient one draft";
    route.next(convertToParamMap({ requestId: 2 }));
    expect(c.data()).toBeNull();
    expect(c.notes).toBe("");
    http
      .expectOne(environment.apiUrl + "/ReassessmentRequests/2")
      .flush({ ...request, id: 2, patientId: 5, patientName: "Other patient" });
    await Promise.resolve();
    await Promise.resolve();
    old.flush({ ...request, state: "InReview", version: 2 });
    await starting;
    expect(c.data()!.id).toBe(2);
    expect(c.data()!.patientId).toBe(5);
    expect(c.busy()).toBe(false);
  });
  it("retains an unsaved clinical outcome on refresh and clears a rejected stale completion intent", async () => {
    c.data.set({ ...request, state: "InReview", version: 2 });
    c.notes = "Keep this draft";
    const submission = c.submit();
    http
      .expectOne(environment.apiUrl + "/ReassessmentRequests/1/complete")
      .flush(
        { title: "Reassessment.ReviewRequired" },
        { status: 409, statusText: "Conflict" },
      );
    await submission;
    expect(c.completionIntent).toBeNull();
    expect(c.notes).toBe("Keep this draft");
    const refreshing = c.load();
    http
      .expectOne(environment.apiUrl + "/ReassessmentRequests/1")
      .flush({ ...request, state: "InReview", version: 3 });
    await refreshing;
    expect(c.notes).toBe("Keep this draft");
    const retry = c.submit();
    const r = http.expectOne(
      environment.apiUrl + "/ReassessmentRequests/1/complete",
    );
    expect(r.request.body.expectedVersion).toBe(3);
    expect(r.request.body.progressNotes).toBe("Keep this draft");
    r.flush({
      ...request,
      state: "Completed",
      reviewNotes: "Keep this draft",
      version: 4,
    });
    await retry;
  });
  it("sends a reasoned cancellation without changing patient appointments or payments", async () => {
    c.cancelReason = "Concern resolved";
    const cancelling = c.cancel();
    const r = http.expectOne(
      environment.apiUrl + "/ReassessmentRequests/1/cancel",
    );
    expect(r.request.body).toEqual({
      expectedVersion: 1,
      reason: "Concern resolved",
    });
    r.flush({
      ...request,
      state: "Cancelled",
      cancellationReason: c.cancelReason,
    });
    await cancelling;
    expect(c.data()!.state).toBe("Cancelled");
    http.expectNone(
      (r) => r.url.includes("/Billing") || r.url.includes("/Appointments"),
    );
  });
});
