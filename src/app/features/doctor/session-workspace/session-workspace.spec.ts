import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from "@angular/router";
import { TranslateModule } from "@ngx-translate/core";
import { of } from "rxjs";
import { SessionWorkspace } from "./session-workspace";
import { DoctorPatientWorkspace } from "../../../core/models/doctor-workspace.model";
import { environment } from "../../../../environments/environment";

export const workspace: DoctorPatientWorkspace = {
  visit: {
    appointmentId: 10,
    patientId: 1,
    patientName: "Assigned patient",
    phone: null,
    gender: "Male",
    treatmentPlanId: 1,
    sessionId: 20,
    sessionNumber: 7,
    planSummary: "Saved instructions",
    doctorId: "doctor",
    doctorName: "Doctor",
    roomId: 1,
    roomName: "Room",
    plannedStart: "2030-02-04T10:00:00Z",
    plannedEnd: "2030-02-04T11:00:00Z",
    arrivedAt: "2030-02-04T09:58:00Z",
    departedAt: null,
    treatmentStartedAt: "2030-02-04T10:00:00Z",
    treatmentEndedAt: null,
    state: "Treating",
  },
  birthDate: null,
  plan: {
    id: 1,
    diagnosis: "Saved diagnosis",
    conditionType: "Saved condition",
    assessmentNotes: null,
    assessedAt: "2030-02-01T10:00:00Z",
    seniorName: "Senior",
    treatmentType: "Physio",
    exercises: null,
    prescribed: 10,
    booked: 7,
    completed: 6,
    frequencyPerWeek: 2,
    assignedDoctor: "Doctor",
    staffReviewRequired: false,
  },
  notes: {
    version: 1,
    progressNotes: "Saved draft",
    conditionChanges: "",
    responseToTreatment: "",
    treatmentPerformed: "",
    authorName: "Doctor",
    savedAt: "2030-02-04T10:05:00Z",
    finalizedAt: null,
  },
  previousSessions: [],
  documents: [],
  reassessments: [],
};
describe("Persisted Doctor notes and explicit finalization", () => {
  let c: SessionWorkspace, http: HttpTestingController;
  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ appointmentId: "10" })),
          },
        },
      ],
    });
    c = TestBed.runInInjectionContext(() => new SessionWorkspace());
    http = TestBed.inject(HttpTestingController);
    c.ngOnInit();
    http
      .expectOne(environment.apiUrl + "/Doctor/appointments/10")
      .flush(structuredClone(workspace));
    await Promise.resolve();
    await Promise.resolve();
  });
  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });
  it("rejects a clinical response for a different appointment", async () => {
    const loading = c.load();
    const wrong = structuredClone(workspace);
    wrong.visit.appointmentId = 11;
    http.expectOne(environment.apiUrl + "/Doctor/appointments/10").flush(wrong);
    await loading;
    expect(c.data()).toBeNull();
    expect(c.error()).toBeTruthy();
  });
  it("does not let a late autosave replace another patient's workspace", async () => {
    c.draft.progressNotes = "Old patient update";
    c.changed();
    const saving = c.saveDraft();
    const old = http.expectOne((r) => r.url.endsWith("/10/notes"));
    c.id = 11;
    const loading = c.load();
    expect(c.data()).toBeNull();
    const fresh = structuredClone(workspace);
    fresh.visit.appointmentId = 11;
    fresh.visit.patientId = 2;
    fresh.notes.progressNotes = "Other patient draft";
    http.expectOne(environment.apiUrl + "/Doctor/appointments/11").flush(fresh);
    await loading;
    old.flush({
      ...structuredClone(workspace),
      notes: {
        ...workspace.notes,
        version: 2,
        progressNotes: "Old patient update",
      },
    });
    await saving;
    expect(c.data()!.visit.appointmentId).toBe(11);
    expect(c.draft.progressNotes).toBe("Other patient draft");
  });
  const saved = (text: string, version = 2) => ({
    ...structuredClone(workspace),
    notes: { ...workspace.notes, progressNotes: text, version },
  });
  it("debounces draft writes without completing treatment", async () => {
    vi.useFakeTimers();
    c.draft.progressNotes = "Clinical update";
    c.changed();
    http.expectNone((r) => r.method === "PUT");
    await vi.advanceTimersByTimeAsync(650);
    const request = http.expectOne(
      environment.apiUrl + "/Doctor/appointments/10/notes",
    );
    expect(request.request.body.expectedVersion).toBe(1);
    request.flush(saved("Clinical update"));
    await Promise.resolve();
    await Promise.resolve();
    expect(c.saveState()).toBe("Saved");
    expect(c.data()!.notes.progressNotes).toBe("Clinical update");
    expect(c.data()!.visit.state).toBe("Treating");
    http.expectNone((r) => r.url.endsWith("/end"));
  });
  it("preserves newer local text while an older autosave is in flight", async () => {
    c.draft.progressNotes = "First edit";
    c.changed();
    const saving = c.saveDraft();
    const request = http.expectOne((r) => r.url.endsWith("/notes"));
    c.draft.progressNotes = "Second edit";
    c.changed();
    request.flush(saved("First edit"));
    await saving;
    expect(c.draft.progressNotes).toBe("Second edit");
    expect(c.dirty).toBe(true);
    expect(c.data()!.notes.version).toBe(2);
    const next = c.saveDraft();
    const nextRequest = http.expectOne((r) => r.url.endsWith("/notes"));
    expect(nextRequest.request.body.expectedVersion).toBe(2);
    expect(nextRequest.request.body.progressNotes).toBe("Second edit");
    nextRequest.flush(saved("Second edit", 3));
    await next;
  });
  it("retains text after failure and retries the original save before later edits", async () => {
    c.draft.progressNotes = "Original clinical text";
    c.changed();
    const first = c.saveDraft();
    http
      .expectOne((r) => r.url.endsWith("/notes"))
      .error(new ProgressEvent("error"));
    await first;
    expect(c.saveState()).toBe("Failed");
    expect(c.draft.progressNotes).toBe("Original clinical text");
    const retry = c.saveDraft();
    const request = http.expectOne((r) => r.url.endsWith("/notes"));
    expect(request.request.body.expectedVersion).toBe(1);
    expect(request.request.body.progressNotes).toBe("Original clinical text");
    request.flush(saved("Original clinical text"));
    await retry;
    expect(c.dirty).toBe(false);
  });
  it("blocks stale edits and leaves the final text intact when completion fails", async () => {
    c.draft.progressNotes = "Final clinical text";
    c.changed();
    const ending = c.end();
    http
      .expectOne((r) => r.url.endsWith("/end"))
      .flush(
        { title: "Doctor.ConcurrentEdit" },
        { status: 409, statusText: "Conflict" },
      );
    await ending;
    expect(c.data()!.visit.state).toBe("Treating");
    expect(c.draft.progressNotes).toBe("Final clinical text");
    expect(c.saveState()).toBe("Failed");
  });
  it("waits for an in-flight autosave and sends the latest version in one explicit End action", async () => {
    c.draft.progressNotes = "Final notes";
    c.changed();
    const saving = c.saveDraft();
    const draft = http.expectOne((r) => r.url.endsWith("/notes"));
    const end = c.end();
    http.expectNone((r) => r.url.endsWith("/end"));
    draft.flush(saved("Final notes"));
    await saving;
    await Promise.resolve();
    const request = http.expectOne((r) => r.url.endsWith("/end"));
    expect(request.request.body.expectedVersion).toBe(2);
    const complete = saved("Final notes", 3);
    complete.notes.finalizedAt = "2030-02-04T10:30:00Z";
    complete.visit.state = "TreatmentFinished";
    complete.visit.treatmentEndedAt = complete.notes.finalizedAt;
    request.flush(complete);
    await end;
    expect(c.editable()).toBe(false);
    expect(c.data()!.visit.departedAt).toBeNull();
    expect(c.saveState()).toBe("Finalized");
  });
  it("uses the saved session number and restores the server draft on refresh", () => {
    expect(c.data()!.visit.sessionNumber).toBe(7);
    expect(c.draft.progressNotes).toBe("Saved draft");
  });
});
