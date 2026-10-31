import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { provideRouter, Router } from "@angular/router";
import { TranslateModule } from "@ngx-translate/core";
import { Dashboard } from "./dashboard";
import { DoctorVisit } from "../../../core/models/doctor-workspace.model";
import { environment } from "../../../../environments/environment";

const visit = (
  id: number,
  start: string,
  state: DoctorVisit["state"] = "Scheduled",
): DoctorVisit => ({
  appointmentId: id,
  patientId: id,
  patientName: "Assigned patient " + id,
  phone: null,
  gender: "Male",
  treatmentPlanId: 1,
  sessionId: id,
  sessionNumber: id,
  planSummary: "Saved plan",
  doctorId: "doctor",
  doctorName: "Doctor",
  roomId: id,
  roomName: "Room " + id,
  plannedStart: start,
  plannedEnd: start,
  treatmentStartedAt: state === "Treating" ? start : null,
  treatmentEndedAt: null,
  arrivedAt: null,
  departedAt: null,
  state,
});
describe("Doctor schedule from authenticated backend records", () => {
  let c: Dashboard, http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    c = TestBed.runInInjectionContext(() => new Dashboard());
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it("loads the selected Cairo day and keeps all overlapping appointments visible", async () => {
    c.date.set("2030-02-04");
    const loading = c.load();
    const request = http.expectOne(
      (r) => r.url === environment.apiUrl + "/Doctor/schedule",
    );
    expect(request.request.params.get("date")).toBe("2030-02-04");
    const rows = [
      visit(1, "2030-02-04T10:00:00Z"),
      visit(2, "2030-02-04T10:30:00Z"),
      visit(3, "2030-02-04T10:45:00Z"),
    ];
    request.flush({ date: c.date(), appointments: rows, activeTreatments: [] });
    await loading;
    expect(c.visible()).toHaveLength(3);
    c.search.set("patient 2");
    expect(c.visible().map((a) => a.appointmentId)).toEqual([2]);
  });
  it("does not substitute zero summaries for a failed schedule load", async () => {
    const loading = c.load();
    http
      .expectOne((r) => r.url.endsWith("/Doctor/schedule"))
      .flush({}, { status: 503, statusText: "Unavailable" });
    await loading;
    expect(c.data()).toBeNull();
    expect(c.error()).toBeTruthy();
  });
  it("keeps an overdue treatment visible even on another selected day", async () => {
    const loading = c.load();
    http
      .expectOne((r) => r.url.endsWith("/Doctor/schedule"))
      .flush({
        date: c.date(),
        appointments: [],
        activeTreatments: [visit(1, "2026-10-30T10:00:00Z", "Treating")],
      });
    await loading;
    expect(c.counts().treating).toBe(1);
  });
  it("shows the exact patient shortfall and never creates a payment or navigates on blocked start", async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), "navigate");
    const starting = c.start(visit(1, "2030-02-04T10:00:00Z", "Arrived"));
    http
      .expectOne(environment.apiUrl + "/Doctor/appointments/1/start")
      .flush(
        {
          title: "Booking.PaymentCoverageRequired",
          details: { additionalPaymentRequired: 25.5 },
        },
        { status: 409, statusText: "Conflict" },
      );
    await starting;
    expect(c.shortfall()).toBe(25.5);
    expect(navigate).not.toHaveBeenCalled();
    http.expectNone((r) => r.url.includes("/payments"));
  });
});
