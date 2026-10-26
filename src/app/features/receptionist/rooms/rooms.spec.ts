import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { Subject, of, throwError } from "rxjs";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { MessageService } from "primeng/api";
import { RoomService } from "../../../core/services/room.service";
import { RoomRecord } from "../../../core/models/room-api.model";
import { RoomsComponent } from "./rooms";

describe("Backend room cards", () => {
  let fixture: ComponentFixture<RoomsComponent>;
  const rooms = signal<RoomRecord[]>([]);
  const error = signal<string | null>(null);
  const service = {
    rooms,
    error,
    loading: signal(false),
    mutation: { busy: signal(false), uncertain: signal(false) },
    load: vi.fn(),
    maintenance: vi.fn(),
  };
  beforeEach(async () => {
    rooms.set([]);
    error.set(null);
    service.mutation.busy.set(false);
    service.mutation.uncertain.set(false);
    service.maintenance.mockReset();
    await TestBed.configureTestingModule({
      imports: [RoomsComponent, TranslateModule.forRoot()],
      providers: [
        provideNoopAnimations(),
        MessageService,
        { provide: RoomService, useValue: service },
      ],
    }).compileComponents();
    TestBed.inject(TranslateService).setTranslation("en", {
      RECEPTIONIST: { ROOMS: { EMPTY_TITLE: "No rooms added yet" } },
    });
    TestBed.inject(TranslateService).use("en");
    fixture = TestBed.createComponent(RoomsComponent);
  });
  it("renders server record names without claiming room availability or occupancy", () => {
    rooms.set([{ id: 1, name: "Therapy room", capacity: 2, isActive: true }]);
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector(".room-card");
    expect(card.textContent).toContain("Therapy room");
    expect(card.classList.contains("occupied")).toBe(false);
    expect(card.classList.contains("available")).toBe(false);
  });
  it("shows failures and retries instead of reporting an empty successful floor plan", () => {
    error.set("Request failed");
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[role="alert"]').textContent,
    ).toContain("Request failed");
    expect(fixture.nativeElement.querySelector(".room-card")).toBeNull();
  });
  it("shows an empty state only after a successful empty list", () => {
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[role="status"]').textContent,
    ).toContain("No rooms added yet");
  });
  it("keeps maintenance unknown for active and inactive records instead of inferring its state", () => {
    rooms.set([
      { id: 1, name: "Active", capacity: 2, isActive: true },
      { id: 2, name: "Inactive", capacity: 1, isActive: false },
    ]);
    fixture.detectChanges();
    const toggles = fixture.nativeElement.querySelectorAll(
      ".maintenance-switch",
    );
    expect(
      [...toggles].map((toggle: Element) =>
        toggle.getAttribute("aria-checked"),
      ),
    ).toEqual(["mixed", "mixed"]);
    expect(
      fixture.nativeElement.querySelector(".room-doctors").textContent,
    ).toContain("RECEPTIONIST.UI.ROOM_ASSIGNMENTS_UNAVAILABLE");
    expect(service.maintenance).not.toHaveBeenCalled();
  });
  it("waits for acknowledgment before changing the toggle and prevents duplicate requests", async () => {
    const room = { id: 7, name: "Therapy", capacity: 2, isActive: true };
    rooms.set([room]);
    fixture.detectChanges();
    const response = new Subject<unknown>();
    service.maintenance.mockReturnValue(response);
    const pending = fixture.componentInstance.setMaintenance(room, true);
    await fixture.componentInstance.setMaintenance(room, true);
    fixture.detectChanges();
    expect(service.maintenance).toHaveBeenCalledExactlyOnceWith(7, true);
    expect(fixture.componentInstance.maintenanceState(7)).toBeNull();
    expect(
      fixture.nativeElement.querySelector(".maintenance-switch").disabled,
    ).toBe(true);
    response.next(null);
    response.complete();
    await pending;
    fixture.detectChanges();
    expect(
      fixture.nativeElement
        .querySelector(".maintenance-switch")
        .getAttribute("aria-checked"),
    ).toBe("true");
    service.maintenance.mockReturnValue(of(null));
    await fixture.componentInstance.setMaintenance(room, false);
    fixture.detectChanges();
    expect(service.maintenance).toHaveBeenLastCalledWith(7, false);
    expect(
      fixture.nativeElement
        .querySelector(".maintenance-switch")
        .getAttribute("aria-checked"),
    ).toBe("false");
  });
  it("retains the last acknowledged request when a maintenance change fails", async () => {
    const room = { id: 7, name: "Therapy", capacity: 2, isActive: true };
    rooms.set([room]);
    fixture.detectChanges();
    service.maintenance.mockReturnValue(of(null));
    await fixture.componentInstance.setMaintenance(room, true);
    service.maintenance.mockReturnValue(
      throwError(() => new Error("Request failed")),
    );
    await fixture.componentInstance.setMaintenance(room, false);
    fixture.detectChanges();
    expect(fixture.componentInstance.maintenanceState(7)).toBe(true);
    expect(fixture.componentInstance.maintenanceRoomId()).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[role="alert"]').textContent,
    ).toContain("Request failed");
  });
  it("blocks maintenance actions after an uncertain outcome", async () => {
    service.mutation.uncertain.set(true);
    await fixture.componentInstance.setMaintenance(
      { id: 7, name: "Therapy", capacity: 2, isActive: true },
      true,
    );
    expect(service.maintenance).not.toHaveBeenCalled();
  });
});
