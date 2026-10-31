import { Component, inject, OnInit, signal, DestroyRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { firstValueFrom } from "rxjs";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  DoctorWorkspaceService,
  clinicalError,
} from "../../../core/services/doctor-workspace.service";
import { BookingService } from "../../../core/services/booking.service";
import {
  ReassessmentRequest,
  CompleteReassessment,
} from "../../../core/models/doctor-workspace.model";
import { BookingClinician } from "../../../core/models/booking.model";
import { ReassessmentQueue } from "../../../shared/components/reassessment-queue/reassessment-queue";
import { ClinicalLocale } from "../../../shared/clinical-locale";

@Component({
  selector: "app-re-assessment-form",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslateModule,
    ReassessmentQueue,
  ],
  templateUrl: "./re-assessment-form.html",
  styleUrls: ["../../doctor/doctor-workspace.css", "./clinical-review.css"],
})
export class ReAssessmentForm implements OnInit {
  private api = inject(DoctorWorkspaceService);
  private booking = inject(BookingService);
  private route = inject(ActivatedRoute);
  private translate = inject(TranslateService);
  private destroy = inject(DestroyRef);
  readonly locale = new ClinicalLocale();
  readonly data = signal<ReassessmentRequest | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal("");
  readonly clinicianError = signal("");
  readonly clinicians = signal<BookingClinician[]>([]);
  id = 0;
  notes = "";
  decision: "Continue" | "Revise" | "Discharge" = "Continue";
  diagnosis = "";
  doctorId = "";
  count = 1;
  frequency = 2;
  treatmentType = "";
  exercises = "";
  cancelReason = "";
  completionIntent: CompleteReassessment | null = null;
  private generation = 0;
  ngOnInit() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((params) => {
        this.id = Number(params.get("requestId"));
        if (this.id) void this.load();
      });
  }
  async load() {
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set("");
    try {
      const data = await firstValueFrom(this.api.review(this.id));
      if (generation !== this.generation) return;
      this.data.set(data);
      this.diagnosis = data.diagnosis;
      this.doctorId = data.doctorId;
      this.count = data.prescribedSessions;
      this.frequency = data.frequencyPerWeek;
      this.treatmentType = data.treatmentType;
      this.exercises = data.exercises ?? "";
      if (data.state === "Completed") {
        this.notes = data.reviewNotes ?? "";
        this.decision = (data.decision as typeof this.decision) ?? "Continue";
        this.completionIntent = null;
      }
    } catch (e) {
      if (generation === this.generation) {
        this.data.set(null);
        this.error.set(clinicalError(e, this.translate));
      }
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  async loadClinicians() {
    if (this.clinicians().length) return;
    this.clinicianError.set("");
    try {
      this.clinicians.set(
        await firstValueFrom(
          this.booking.clinicians(this.data()!.patientId, null, true),
        ),
      );
    } catch (e) {
      this.clinicianError.set(clinicalError(e, this.translate));
    }
  }
  async start() {
    const data = this.data();
    if (!data || this.busy()) return;
    this.busy.set(true);
    this.error.set("");
    try {
      this.data.set(
        await firstValueFrom(this.api.startReview(data.id, data.version)),
      );
    } catch (e) {
      this.error.set(clinicalError(e, this.translate));
    } finally {
      this.busy.set(false);
    }
  }
  async submit() {
    const data = this.data();
    if (!data || this.busy() || !this.notes.trim() || data.state !== "InReview")
      return;
    this.completionIntent ??= {
      expectedVersion: data.version,
      progressNotes: this.notes,
      decision: this.decision,
      diagnosis: this.diagnosis,
      doctorId: this.doctorId,
      numberOfSessions: Number(this.count),
      frequencyPerWeek: Number(this.frequency),
      treatmentType: this.treatmentType,
      exercises: this.exercises || null,
    };
    this.busy.set(true);
    this.error.set("");
    try {
      this.data.set(
        await firstValueFrom(
          this.api.completeReview(data.id, this.completionIntent),
        ),
      );
      this.completionIntent = null;
    } catch (e) {
      this.error.set(clinicalError(e, this.translate));
      if ((e as { status?: number }).status === 400)
        this.completionIntent = null;
    } finally {
      this.busy.set(false);
    }
  }
  async cancel() {
    const data = this.data();
    if (!data || this.busy() || !this.cancelReason.trim()) return;
    this.busy.set(true);
    this.error.set("");
    try {
      this.data.set(
        await firstValueFrom(
          this.api.cancelReview(data.id, data.version, this.cancelReason),
        ),
      );
    } catch (e) {
      this.error.set(clinicalError(e, this.translate));
    } finally {
      this.busy.set(false);
    }
  }
}
