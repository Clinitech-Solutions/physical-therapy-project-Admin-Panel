/// <reference types="node" />
import { readFileSync } from "node:fs";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { registerLocaleData } from "@angular/common";
import ar from "@angular/common/locales/ar";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { PatientProfileComponent } from "./patient-profile.component";
import { PatientService } from "../../../core/services/patient.service";
import { AuthService } from "../../../core/services/auth";
import {
  ProfileData,
  ProfileSession,
  RescheduleAvailability,
} from "../../../core/models/patient-profile.model";
import { environment } from "../../../../environments/environment";

const base = environment.apiUrl;
registerLocaleData(ar, "ar-EG");
const patient = {
  id: 1,
  applicationUserId: "technical-account-id",
  fullName: "Local Patient",
  email: "patient@example.com",
  phoneNumber: "01012345678",
  gender: 0,
  birthDate: "1990-01-01T00:00:00Z",
  paymentType: "Insurance",
  emergencyContact: "01000000000",
  createdAt: "2026-10-29T11:00:00Z",
  insuranceCompanyId: 7,
  insuranceCompanyName: "Insurer",
  insuranceDetails: {
    status: 0,
    copayPercentage: 20,
    approvedSessions: 10,
    memberId: "member",
    employer: null,
  },
};
const row: ProfileSession = {
  id: 11,
  sessionNumber: 1,
  appointmentId: 101,
  version: "v1",
  clinicianId: "doctor-guid",
  doctorName: "Local Doctor",
  roomId: 1,
  roomName: "Room 01",
  startTime: "2030-11-04T15:00:00Z",
  endTime: "2030-11-04T16:00:00Z",
  actualCheckIn: null,
  actualCheckOut: null,
  status: "Pending",
  patientCoverage: "Covered",
  patientLiability: 100,
  patientPaid: 100,
  canReschedule: true,
};
const profile: ProfileData = {
  patientId: 1,
  courses: [
    {
      id: 5,
      treatmentType: "Physio",
      status: "Active",
      doctorName: "Local Doctor",
      prescribedSessions: 10,
      completedSessions: 1,
      patientAmount: 1000,
      patientPaid: 100,
      patientBalance: 900,
      insurerAmount: 4000,
      insurerPaid: 0,
      insurerBalance: 4000,
      sessions: [row, { ...row, id: 12, sessionNumber: 2, appointmentId: 102 }],
      payments: [
        {
          id: 1,
          invoiceId: 1,
          invoiceNumber: "I-1",
          amount: 100,
          payer: "Patient",
          method: "Cash",
          date: "2030-11-01T10:00:00Z",
          reference: null,
        },
      ],
      activity: [],
    },
  ],
  assessments: [],
};
const slots: RescheduleAvailability = {
  appointmentId: 101,
  version: "v1",
  currentStart: row.startTime!,
  currentEnd: row.endTime!,
  currentRoomId: 1,
  clinicianId: "doctor-guid",
  clinicianName: "Local Doctor",
  date: "2030-11-04",
  notices: [],
  slots: [
    {
      startTime: "2030-11-04T16:00:00Z",
      endTime: "2030-11-04T17:00:00Z",
      roomId: 2,
      roomName: "Room 02",
      remainingCapacity: 1,
    },
  ],
};

describe("Shared profile and inline single-session reschedule (mocked HTTP)", () => {
  let fixture: ComponentFixture<PatientProfileComponent>,
    c: PatientProfileComponent,
    http: HttpTestingController;
  const profileRequest = () =>
    http.expectOne(`${base}/Bookings/patients/1/profile`);
  const slotRequest = () =>
    http.expectOne(
      (r) => r.url === `${base}/Bookings/appointments/101/reschedule-slots`,
    );
  const render = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const open = async (data = profile, paymentType = "Insurance") => {
    fixture.componentRef.setInput(
      "patient",
      TestBed.inject(PatientService).mapToFrontendPatient({
        ...patient,
        paymentType,
      } as never),
    );
    fixture.componentRef.setInput("visible", true);
    fixture.detectChanges();
    http
      .expectOne(`${base}/Patients/GetById/1`)
      .flush({ ...patient, paymentType });
    profileRequest().flush(data);
    await render();
  };
  const edit = async () => {
    c.openEditor(c.sessions[0]);
    slotRequest().flush(slots);
    await render();
  };
  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [PatientProfileComponent, TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        {
          provide: AuthService,
          useValue: {
            hasRole: (r: string) => r === "Receptionist",
            currentUser: () => ({ id: "staff" }),
          },
        },
      ],
    }).compileComponents();
    const translate = TestBed.inject(TranslateService);
    for (const language of ["en", "ar"])
      translate.setTranslation(
        language,
        JSON.parse(readFileSync(`public/assets/i18n/${language}.json`, "utf8")),
      );
    translate.use("en");
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PatientProfileComponent);
    c = fixture.componentInstance;
  });
  afterEach(() => {
    fixture.destroy();
    http.verify();
    sessionStorage.clear();
  });
  it("loads scoped records without administrative lookups, placeholder email or fabricated sessions", async () => {
    await open();
    const modal = document.querySelector(".patient-profile-modal")!;
    expect(modal.textContent).toContain("Local Patient");
    expect(modal.textContent).not.toContain("technical-account-id");
    expect(modal.textContent).not.toContain("patient@example.com");
    expect(c.totalSessions).toBe(10);
    expect(c.sessions).toHaveLength(2);
    http.expectNone(
      (r) =>
        r.url.endsWith("/Users/GetAll") ||
        r.url.endsWith("/Billing/invoices") ||
        r.url.endsWith("/Appointments/GetAll"),
    );
  });
  it("distinguishes patient coverage from unpaid insurer liability", async () => {
    await open();
    expect(document.querySelector(".insurer-balance")?.textContent).toContain(
      "4,000",
    );
    expect(document.querySelector(".profile-table")?.textContent).toContain(
      "Covered",
    );
    expect(c.course?.patientBalance).toBe(900);
  });
  it("scopes counts and money to the selected course", async () => {
    await open({
      ...profile,
      courses: [
        profile.courses[0],
        {
          ...profile.courses[0],
          id: 9,
          prescribedSessions: 3,
          completedSessions: 0,
          patientPaid: 0,
          patientBalance: 300,
          sessions: [],
          payments: [],
        },
      ],
    });
    c.chooseCourse(9);
    expect(c.totalSessions).toBe(3);
    expect(c.course?.patientPaid).toBe(0);
    expect(c.sessions).toEqual([]);
  });
  it("exposes failed loads and retries without claiming an empty success", async () => {
    await open();
    c.reloadCourseData();
    profileRequest().flush({}, { status: 403, statusText: "Forbidden" });
    await render();
    expect(c.profileError()).toBeTruthy();
    expect(document.querySelector(".profile-alert")?.textContent).toContain(
      "Could not load course records",
    );
    c.reloadCourseData();
    profileRequest().flush({ ...profile, courses: [] });
    expect(c.profileError()).toBe("");
    expect(c.sessions).toEqual([]);
  });
  it("derives localized Cairo weekday when the UTC date is different", () => {
    expect(c.cairoDay("2026-11-04T22:30:00Z")).toBe("2026-11-05");
    expect(c.weekday("2026-11-04T22:30:00Z")).toBe("Thu");
    TestBed.inject(TranslateService).use("ar");
    expect(c.weekday("2026-11-04T22:30:00Z")).not.toBe("Thu");
  });
  it("expands below the selected row without opening another modal", async () => {
    await open();
    await edit();
    expect(document.querySelectorAll(".p-dialog")).toHaveLength(1);
    expect(document.querySelectorAll(".session-editor")).toHaveLength(1);
    expect(
      document.querySelector(".session-editor")?.closest("tr")
        ?.previousElementSibling?.textContent,
    ).toContain("Room 01");
    expect(document.querySelector(".session-editor")?.textContent).toContain(
      "This session only",
    );
  });
  it("cancels stale slot reads and clears invalid selections on date changes", async () => {
    await open();
    c.openEditor(c.sessions[0]);
    const obsolete = slotRequest();
    c.dateChanged("2030-11-05");
    expect(obsolete.cancelled).toBe(true);
    const next = slotRequest();
    expect(next.request.params.get("date")).toBe("2030-11-05");
    next.flush({ ...slots, date: "2030-11-05" });
    c.pickSlot(slots.slots[0]);
    c.dateChanged("2030-11-06");
    expect(c.selectedSlot).toBeNull();
    slotRequest().flush({ ...slots, slots: [] });
    await render();
    expect(document.querySelector(".session-editor")?.textContent).toContain(
      "No available slots",
    );
  });
  it("distinguishes denied slot loads from no available slots and supports retry", async () => {
    await open();
    c.openEditor(c.sessions[0]);
    slotRequest().flush({}, { status: 403, statusText: "Forbidden" });
    await render();
    expect(c.slotsError()).toBeTruthy();
    expect(
      document.querySelector(".session-editor")?.textContent,
    ).not.toContain("No available slots");
    c.loadSlots();
    slotRequest().flush(slots);
    expect(c.slotsError()).toBe("");
  });
  it("confirms draft discard before changing rows or closing", async () => {
    await open();
    await edit();
    c.pickSlot(slots.slots[0]);
    c.openEditor(c.sessions[1]);
    expect(c.editing?.id).toBe(11);
    expect(c.discardAction).toBeTruthy();
    c.keepEditing();
    expect(c.selectedSlot).toBe(slots.slots[0]);
    c.closeModal();
    expect(c.visible).toBe(true);
    c.discard();
    expect(c.visible).toBe(false);
    http.expectNone((r) => r.method === "PUT");
  });
  it("Cancel discards the draft and keeps the persisted row", async () => {
    await open();
    await edit();
    c.dateChanged("2030-11-06");
    slotRequest().flush({ ...slots, slots: [] });
    c.cancelEditor();
    expect(c.discardAction).toBeTruthy();
    c.discard();
    expect(c.editing).toBeNull();
    expect(c.sessions[0].startTime).toBe(row.startTime);
  });
  it("saves only the selected appointment once with a version and stable operation key", async () => {
    await open();
    await edit();
    c.pickSlot(slots.slots[0]);
    c.reason = "Patient preference";
    const save = c.saveSession();
    void c.saveSession();
    const request = http.expectOne(
      `${base}/Bookings/appointments/101/reschedule`,
    );
    expect(request.request.body).toMatchObject({
      expectedVersion: "v1",
      startTime: slots.slots[0].startTime,
      roomId: 2,
      reason: "Patient preference",
    });
    expect(request.request.body.clinicianId).toBeUndefined();
    request.flush({
      operationKey: request.request.body.operationKey,
      appointmentId: 101,
      patientId: 1,
      treatmentPlanId: 5,
      ...slots.slots[0],
      changedAt: "2030-11-02T10:00:00Z",
    });
    await save;
    expect(c.sessions[0].roomId).toBe(2);
    expect(c.sessions[1].roomId).toBe(1);
    expect(c.editing).toBeNull();
    expect(c.pending()).toBeNull();
    profileRequest().flush(profile);
  });
  it("preserves desired date and reason on stale conflict while refreshing availability", async () => {
    await open();
    await edit();
    c.pickSlot(slots.slots[0]);
    c.reason = "Keep this reason";
    const save = c.saveSession();
    http
      .expectOne(`${base}/Bookings/appointments/101/reschedule`)
      .flush(
        { title: "Booking.StaleSchedule", detail: "Changed" },
        { status: 409, statusText: "Conflict" },
      );
    await save;
    expect(c.draftDate).toBe("2030-11-04");
    expect(c.reason).toBe("Keep this reason");
    expect(c.selectedSlot).toBeNull();
    slotRequest().flush({ ...slots, version: "v2" });
    profileRequest().flush(profile);
    expect(c.editing?.version).toBe("v2");
    expect(c.saveError()).toContain("changed");
  });
  it("reconciles unknown save outcomes without blind retries or replacement appointments", async () => {
    await open();
    await edit();
    c.pickSlot(slots.slots[0]);
    const save = c.saveSession();
    const request = http.expectOne(
      `${base}/Bookings/appointments/101/reschedule`,
    );
    const key = request.request.body.operationKey;
    request.error(new ProgressEvent("error"));
    await save;
    expect(c.pending()?.request.operationKey).toBe(key);
    await c.saveSession();
    http.expectNone((r) => r.method === "PUT");
    c.closeModal();
    expect(c.visible).toBe(true);
    const reconcile = c.reconcile();
    http
      .expectOne(`${base}/Bookings/appointments/101/reschedules/${key}`)
      .flush({
        operationKey: key,
        appointmentId: 101,
        patientId: 1,
        treatmentPlanId: 5,
        ...slots.slots[0],
        changedAt: "2030-11-02T10:00:00Z",
      });
    await reconcile;
    profileRequest().flush(profile);
    expect(c.pending()).toBeNull();
  });
  it("retries the exact original payload only after explicit not-found reconciliation", async () => {
    await open();
    await edit();
    c.pickSlot(slots.slots[0]);
    const save = c.saveSession();
    const request = http.expectOne(
      `${base}/Bookings/appointments/101/reschedule`,
    );
    const body = request.request.body;
    request.error(new ProgressEvent("error"));
    await save;
    const reconcile = c.reconcile();
    http
      .expectOne(
        `${base}/Bookings/appointments/101/reschedules/${body.operationKey}`,
      )
      .flush({}, { status: 404, statusText: "Not Found" });
    await reconcile;
    const retry = c.retryOriginal();
    const original = http.expectOne(
      `${base}/Bookings/appointments/101/reschedule`,
    );
    expect(original.request.body).toEqual(body);
    original.flush({}, { status: 400, statusText: "Bad Request" });
    await retry;
    expect(c.pending()).toBeNull();
  });
  it("retains an unknown operation across a safe close and component reload", async () => {
    await open();
    await edit();
    c.pickSlot(slots.slots[0]);
    const save = c.saveSession();
    const request = http.expectOne(
      `${base}/Bookings/appointments/101/reschedule`,
    );
    const key = request.request.body.operationKey;
    request.error(new ProgressEvent("error"));
    await save;
    c.closeKeepingPending();
    expect(c.visible).toBe(false);
    fixture.destroy();
    fixture = TestBed.createComponent(PatientProfileComponent);
    c = fixture.componentInstance;
    await open();
    expect(c.pending()?.request.operationKey).toBe(key);
    expect(c.editing).toBeNull();
    await c.saveSession();
    http.expectNone((r) => r.method === "PUT");
  });
  it("bounds a stalled save and retains its original operation for reconciliation", async () => {
    await open();
    await edit();
    c.pickSlot(slots.slots[0]);
    vi.useFakeTimers();
    try {
      const save = c.saveSession();
      const request = http.expectOne(
        `${base}/Bookings/appointments/101/reschedule`,
      );
      const key = request.request.body.operationKey;
      await vi.advanceTimersByTimeAsync(30001);
      await save;
      expect(request.cancelled).toBe(true);
      expect(c.saving()).toBe(false);
      expect(c.pending()?.request.operationKey).toBe(key);
      await c.saveSession();
      http.expectNone((r) => r.method === "PUT");
    } finally {
      vi.useRealTimers();
    }
  });
  it("keeps completed/started appointments read-only", async () => {
    await open({
      ...profile,
      courses: [
        {
          ...profile.courses[0],
          sessions: [
            {
              ...row,
              canReschedule: false,
              status: "Completed",
              actualCheckIn: "2030-01-01T10:00:00Z",
              actualCheckOut: "2030-01-01T11:00:00Z",
            },
          ],
        },
      ],
    });
    c.openEditor(c.sessions[0]);
    expect(c.editing).toBeNull();
    expect(document.querySelector("[id^=edit-session]")).toBeNull();
    http.expectNone((r) => r.url.endsWith("/reschedule-slots"));
  });
  it("supports tab keyboard navigation and Arabic RTL", async () => {
    await open();
    document
      .getElementById("profile-tab-sessions")!
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
    await render();
    expect(c.activeTab).toBe("payments");
    expect(document.activeElement?.id).toBe("profile-tab-payments");
    TestBed.inject(TranslateService).use("ar");
    await render();
    expect(document.querySelector(".profile")?.getAttribute("dir")).toBe("rtl");
    expect(
      document.querySelector("#profile-panel-payments")?.textContent,
    ).toBeTruthy();
  });
  it("loads patient documents on demand without exposing raw file paths", async () => {
    await open();
    http.expectNone((r) => r.url.endsWith("/InsuranceDocuments"));
    c.setTab("documents");
    http
      .expectOne(
        (r) =>
          r.url === `${base}/InsuranceDocuments` &&
          r.params.get("patientId") === "1",
      )
      .flush([
        {
          id: 7,
          patientId: 1,
          fileName: "approval.pdf",
          contentType: "application/pdf",
          uploadedAt: "2030-11-01T10:00:00Z",
        },
      ]);
    await render();
    expect(
      document.querySelector("[data-insurance-documents]")?.textContent,
    ).toContain("approval.pdf");
    expect(
      document.querySelector("[data-insurance-documents] a[href]"),
    ).toBeNull();
  });
  it("never requests insurer documents for cash patients", async () => {
    await open(profile, "Cash");
    c.setTab("documents");
    await render();
    http.expectNone((r) => r.url.endsWith("/InsuranceDocuments"));
    expect(
      document.querySelector("[data-insurance-documents]")?.textContent,
    ).toContain("not required");
  });
  it("preserves upload functionality and scopes document load failures", async () => {
    await open();
    c.files = [new File(["test"], "approval.pdf")];
    const upload = c.uploadDocuments();
    const request = http.expectOne(`${base}/InsuranceDocuments/Add`);
    expect(request.request.body.get("PatientId")).toBe("1");
    request.flush([]);
    await upload;
    http
      .expectOne((r) => r.url === `${base}/InsuranceDocuments`)
      .flush({}, { status: 403, statusText: "Forbidden" });
    expect(c.documentsError()).toBeTruthy();
    expect(c.profileError()).toBe("");
    expect(c.uploadSaved()).toBe(true);
  });
});
