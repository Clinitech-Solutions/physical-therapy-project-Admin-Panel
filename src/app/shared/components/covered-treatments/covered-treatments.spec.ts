import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { TranslateModule } from "@ngx-translate/core";
import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { CoveredTreatments } from "./covered-treatments";
import { environment } from "../../../../environments/environment";

describe("Senior treatment coverage schedule", () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [CoveredTreatments, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }),
  );
  it("shows assigned Senior treatment as treatment and links to the shared Senior clinical route", async () => {
    const fixture = TestBed.createComponent(CoveredTreatments);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne((r) => r.url === environment.apiUrl + "/Doctor/schedule")
      .flush({
        date: "2026-11-04",
        appointments: [
          {
            appointmentId: 21,
            patientName: "Mina Romany",
            coveringTreatment: true,
            plannedStart: "2026-11-04T10:00:00Z",
            roomName: "Room 1",
          },
          {
            appointmentId: 22,
            patientName: "Other Doctor patient",
            coveringTreatment: false,
          },
        ],
        activeTreatments: [],
      });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Mina Romany");
    expect(fixture.nativeElement.textContent).toContain(
      "ABSENCE.COVERING_TREATMENT",
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      "Other Doctor patient",
    );
    expect(fixture.nativeElement.querySelector("a").getAttribute("href")).toBe(
      "/senior/session-notes/21",
    );
    fixture.destroy();
    http.verify();
  });
  it("retains active coverage from an earlier clinic day without duplicating today's active session", async () => {
    const fixture = TestBed.createComponent(CoveredTreatments);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    const today = {
      appointmentId: 21,
      patientName: "Mina Romany",
      coveringTreatment: true,
      plannedStart: "2026-11-04T10:00:00Z",
      roomName: "Room 1",
    };
    http
      .expectOne((r) => r.url === environment.apiUrl + "/Doctor/schedule")
      .flush({
        date: "2026-11-04",
        appointments: [today],
        activeTreatments: [
          today,
          {
            ...today,
            appointmentId: 20,
            patientName: "Ali Ahmed",
            plannedStart: "2026-11-03T21:00:00Z",
          },
        ],
      });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Ali Ahmed");
    expect(fixture.nativeElement.querySelectorAll("article").length).toBe(2);
    expect(fixture.nativeElement.querySelector("a").getAttribute("href")).toBe(
      "/senior/session-notes/20",
    );
    fixture.destroy();
    http.verify();
  });
  it("keeps failed coverage loads distinct from a successful empty schedule", async () => {
    const fixture = TestBed.createComponent(CoveredTreatments);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne((r) => r.url === environment.apiUrl + "/Doctor/schedule")
      .flush({}, { status: 503, statusText: "Unavailable" });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("[role=alert]")).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain(
      "ABSENCE.NO_COVERAGE",
    );
    fixture.destroy();
    http.verify();
  });
});
