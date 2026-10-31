import { Component, computed, inject, OnInit, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { firstValueFrom } from "rxjs";
import {
  DoctorWorkspaceService,
  clinicDate,
  clinicalError,
} from "../../../core/services/doctor-workspace.service";
import {
  DoctorSchedule,
  DoctorVisit,
  TreatmentState,
} from "../../../core/models/doctor-workspace.model";
import { ClinicalLocale } from "../../../shared/clinical-locale";

@Component({
  selector: "app-doctor-dashboard",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule],
  templateUrl: "./dashboard.html",
  styleUrl: "../doctor-workspace.css",
})
export class Dashboard implements OnInit {
  readonly api = inject(DoctorWorkspaceService);
  private router = inject(Router);
  private translate = inject(TranslateService);
  readonly locale = new ClinicalLocale();
  readonly date = signal(clinicDate());
  readonly loading = signal(false);
  readonly error = signal("");
  readonly data = signal<DoctorSchedule | null>(null);
  readonly busy = signal<number | null>(null);
  readonly shortfall = signal<number | null>(null);
  search = signal("");
  filter = signal<TreatmentState | "">("");
  private generation = 0;
  readonly states: TreatmentState[] = [
    "Scheduled",
    "Arrived",
    "Treating",
    "TreatmentFinished",
    "Departed",
    "Cancelled",
    "NoShow",
    "LegacyCompleted",
  ];
  readonly visible = computed(
    () =>
      this.data()?.appointments.filter(
        (a) =>
          (!this.filter() || a.state === this.filter()) &&
          a.patientName
            .toLocaleLowerCase()
            .includes(this.search().toLocaleLowerCase().trim()),
      ) ?? [],
  );
  readonly counts = computed(() => {
    const rows = this.data()?.appointments ?? [];
    return {
      scheduled: rows.filter((a) => !["Cancelled", "NoShow"].includes(a.state))
        .length,
      waiting: rows.filter((a) => a.state === "Arrived").length,
      treating: this.data()?.activeTreatments.length ?? 0,
      completed: rows.filter((a) =>
        ["TreatmentFinished", "Departed", "LegacyCompleted"].includes(a.state),
      ).length,
    };
  });
  ngOnInit() {
    void this.load();
  }
  async load() {
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set("");
    this.shortfall.set(null);
    try {
      const value = await firstValueFrom(this.api.schedule(this.date()));
      if (generation === this.generation) this.data.set(value);
    } catch (e) {
      if (generation === this.generation) {
        this.data.set(null);
        this.error.set(clinicalError(e, this.translate));
      }
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  day(offset: number) {
    const day = new Date(this.date() + "T12:00:00Z");
    day.setUTCDate(day.getUTCDate() + offset);
    this.date.set(day.toISOString().slice(0, 10));
    void this.load();
  }
  async start(a: DoctorVisit) {
    if (this.busy() !== null) return;
    this.busy.set(a.appointmentId);
    this.error.set("");
    this.shortfall.set(null);
    try {
      await firstValueFrom(this.api.start(a.appointmentId));
      await this.router.navigate(["/doctor/session-notes", a.appointmentId]);
    } catch (e) {
      this.error.set(clinicalError(e, this.translate));
      const details = (
        e as { error?: { details?: { additionalPaymentRequired?: number } } }
      )?.error?.details;
      if (typeof details?.additionalPaymentRequired === "number")
        this.shortfall.set(details.additionalPaymentRequired);
    } finally {
      this.busy.set(null);
    }
  }
}
