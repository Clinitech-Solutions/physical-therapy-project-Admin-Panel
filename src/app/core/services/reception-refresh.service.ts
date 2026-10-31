import { Injectable, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ReceptionEvents } from "./reception-api";
import { ReceptionistService } from "./receptionist.service";
import { PatientService } from "./patient.service";
import { RoomService } from "./room.service";
import { AppointmentService } from "./appointment.service";
import { BillingService } from "./billing.service";

/** Started by reception routes. Read errors remain independent of confirmed writes. */
@Injectable({ providedIn: "root" })
export class ReceptionRefreshService {
  private events = inject(ReceptionEvents);
  private reception = inject(ReceptionistService);
  private patients = inject(PatientService);
  private rooms = inject(RoomService);
  private appointments = inject(AppointmentService);
  private billing = inject(BillingService);
  constructor() {
    this.events.changed.pipe(takeUntilDestroyed()).subscribe((kind) => {
      if (kind === "rooms") {
        this.rooms.load();
        return;
      }
      if (kind === "patients")
        this.patients.getPatients().subscribe({ error: () => {} });
      if (kind === "appointments") { this.appointments.getAppointments(); this.rooms.load(); }
      if (kind === "billing" || kind === "appointments")
        this.billing.getInvoices();
      this.reception.getDashboardStats();
      this.reception.refreshTodaySessions();
    });
  }
}
