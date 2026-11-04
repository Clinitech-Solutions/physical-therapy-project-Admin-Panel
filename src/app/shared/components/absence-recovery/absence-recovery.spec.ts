import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { TranslateModule } from "@ngx-translate/core";
import { of, Subject, throwError } from "rxjs";
import { AbsenceRecovery } from "./absence-recovery";
import { AbsenceService } from "../../../core/services/absence.service";
import { ClinicianService } from "../../../core/services/clinician.service";
import {
  AbsenceView,
  RecoveryBooking,
  RecoveryCandidate,
  RecoveryOptions,
} from "../../../core/models/absence.model";

describe("Reception absence recovery", () => {
  let fixture: ComponentFixture<AbsenceRecovery>, component: AbsenceRecovery;
  const row: RecoveryBooking = {
    appointmentId: 21,
    patientId: 4,
    patientName: "Mina Romany Patient",
    patientGender: "Male",
    appointmentType: "Session",
    clinicianId: "absent",
    clinicianName: "Absent Doctor",
    roomId: 1,
    roomName: "Room 1",
    start: "2030-02-04T10:00:00Z",
    end: "2030-02-04T11:00:00Z",
    version: "v1",
    absenceIds: [9],
    contactStatus: "AwaitingResponse",
  };
  const senior: RecoveryCandidate = {
    clinicianId: "senior",
    name: "Covering Senior",
    role: "Senior",
    gender: "Male",
    genderMatch: true,
    coveringTreatment: true,
    start: row.start,
    end: row.end,
    roomId: 1,
    roomName: "Room 1",
  };
  const female: RecoveryCandidate = {
    ...senior,
    clinicianId: "female",
    name: "Female Senior",
    gender: "Female",
    genderMatch: false,
  };
  const options: RecoveryOptions = {
    appointment: row,
    matching: [senior],
    exceptions: [female],
    nearestMatching: [],
    seniorCapacity: 1,
    timeZone: "Africa/Cairo",
  };
  let api: {
    list: ReturnType<typeof vi.fn>;
    affected: ReturnType<typeof vi.fn>;
    preview: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    withdraw: ReturnType<typeof vi.fn>;
    options: ReturnType<typeof vi.fn>;
    resolve: ReturnType<typeof vi.fn>;
    contact: ReturnType<typeof vi.fn>;
    history: ReturnType<typeof vi.fn>;
  };
  beforeEach(async () => {
    api = {
      list: vi.fn(() => of([])),
      affected: vi.fn(() => of([row])),
      preview: vi.fn(() =>
        of({
          start: row.start,
          end: row.end,
          timeZone: "Africa/Cairo",
          affected: [row],
        }),
      ),
      save: vi.fn(() => of({})),
      withdraw: vi.fn(() => of({})),
      options: vi.fn(() => of(options)),
      resolve: vi.fn(() => of({ appointmentId: 21 })),
      contact: vi.fn(() => of({})),
      history: vi.fn(() => of([])),
    };
    await TestBed.configureTestingModule({
      imports: [AbsenceRecovery, TranslateModule.forRoot()],
      providers: [
        { provide: AbsenceService, useValue: api },
        {
          provide: ClinicianService,
          useValue: {
            clinicians: signal([
              { id: "absent", name: "Absent Doctor", roles: ["Doctor"] },
            ]),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AbsenceRecovery);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.nativeElement
      .querySelectorAll("dialog")
      .forEach((d: HTMLDialogElement) => {
        d.showModal = vi.fn(() => d.setAttribute("open", ""));
        d.close = vi.fn(() => d.removeAttribute("open"));
      });
  });
  afterEach(() => fixture.destroy());
  it("defaults to the schedule date, previews authoritative impact, and reports success only after save", async () => {
    component.scheduleDate = "2030-02-04";
    component.openRecord();
    expect(component.form.date).toBe("2030-02-04");
    component.form.clinicianId = "absent";
    await component.preview();
    expect(component.impact()?.affected.map((x) => x.appointmentId)).toEqual([
      21,
    ]);
    const saved = new Subject<AbsenceView>();
    api.save.mockReturnValue(saved);
    const saving = component.saveAbsence();
    expect(component.success()).toBe("");
    expect(component.busy()).toBe(true);
    saved.next({ id: 9 } as AbsenceView);
    saved.complete();
    await saving;
    expect(component.success()).toBe("ABSENCE.SAVED");
    expect(api.affected).toHaveBeenCalledTimes(2);
  });
  it("requires explicit exception selection, unchecked phone consent, and a reason before sending", async () => {
    await component.openResolve(row);
    component.choose(female, true);
    expect(component.phoneConsent).toBe(false);
    component.reason = "Patient requested continuity";
    await component.confirm();
    expect(api.resolve).not.toHaveBeenCalled();
    component.phoneConsent = true;
    await component.confirm();
    expect(api.resolve).not.toHaveBeenCalled();
    component.exceptionReason = "Patient agreed by phone";
    await component.confirm();
    expect(api.resolve).toHaveBeenCalledWith(
      21,
      expect.objectContaining({
        absenceId: 9,
        useException: true,
        phoneConsent: true,
        exceptionReason: "Patient agreed by phone",
        clinicianId: "female",
        roomId: 1,
      }),
    );
  });
  it("retains selection and entered reasons on failure and retries an unchanged operation with its original key", async () => {
    await component.openResolve(row);
    component.choose(senior);
    component.reason = "Agreed replacement";
    api.resolve.mockReturnValue(throwError(() => ({ status: 502 })));
    await component.confirm();
    expect(component.selected()).toBe(senior);
    expect(component.reason).toBe("Agreed replacement");
    expect(component.success()).toBe("");
    const original = api.resolve.mock.calls[0][1];
    api.resolve.mockReturnValue(of({ appointmentId: 21 }));
    await component.confirm();
    expect(api.resolve.mock.calls[1][1]).toEqual(original);
  });
  it("refreshes conflicting options while retaining the selection and never reports a failed save as success", async () => {
    await component.openResolve(row);
    component.choose(senior);
    component.reason = "Agreed replacement";
    api.resolve.mockReturnValue(
      throwError(() => ({
        status: 409,
        error: { title: "Booking.RecoveryConflict" },
      })),
    );
    await component.confirm();
    expect(component.selected()).toBe(senior);
    expect(component.reason).toBe("Agreed replacement");
    expect(api.options).toHaveBeenCalledTimes(2);
    expect(component.success()).toBe("");
    expect(component.isSelected({ ...senior })).toBe(true);
  });
  it("keeps declined and unreachable outcomes distinct and leaves the booking open", async () => {
    await component.openResolve(row);
    await component.contact("Declined");
    expect(component.selectedCase()?.contactStatus).toBe("Declined");
    expect(component.cases()?.length).toBe(1);
    await component.contact("AwaitingResponse");
    expect(component.selectedCase()?.contactStatus).toBe("AwaitingResponse");
    expect(api.resolve).not.toHaveBeenCalled();
    expect(api.contact.mock.calls.map((c) => c[1])).toEqual([
      "Declined",
      "AwaitingResponse",
    ]);
  });
  it("does not turn a failed load into a zero count", async () => {
    api.affected.mockReturnValue(throwError(() => ({ status: 503 })));
    await component.refresh();
    fixture.detectChanges();
    expect(component.error()).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector(".count").textContent.trim(),
    ).toBe("—");
  });
  it("ignores stale impact responses after the period changes", async () => {
    component.openRecord();
    component.form.clinicianId = "absent";
    const slow = new Subject();
    api.preview.mockReturnValueOnce(slow);
    const first = component.preview();
    component.form.startTime = "14:00";
    api.preview.mockReturnValueOnce(
      of({
        start: row.start,
        end: row.end,
        timeZone: "Africa/Cairo",
        affected: [],
      }),
    );
    await component.preview();
    slow.next({ affected: [row] });
    slow.complete();
    await first;
    expect(component.impact()?.affected).toEqual([]);
  });
});
