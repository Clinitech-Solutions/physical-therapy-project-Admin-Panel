import { ReceptionWarnings } from "../../../core/services/reception-warnings";
import {
  Component,
  inject,
  OnInit,
  signal,
  DestroyRef,
  computed,
} from "@angular/core";
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
import { ReassessmentOutcome } from "../../../shared/components/reassessment-outcome/reassessment-outcome";
import { PatientAvatar } from "../../doctor/patient-avatar";
import { AuthService } from "../../../core/services/auth";

@Component({
  selector: "app-re-assessment-form",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslateModule,
    ReassessmentQueue,
    ReassessmentOutcome,
    PatientAvatar,
  ],
  templateUrl: "./re-assessment-form.html",
  styleUrls: ["./clinical-review.css", "./clinical-review-content.css", "./clinical-review-form.css"],
})
export class ReAssessmentForm implements OnInit {
  private warnings =
    inject(ReceptionWarnings, { optional: true }) ?? new ReceptionWarnings();
  private api = inject(DoctorWorkspaceService);
  private booking = inject(BookingService);
  private route = inject(ActivatedRoute);
  private translate = inject(TranslateService);
  private destroy = inject(DestroyRef);
  private auth = inject(AuthService);
  readonly backOrigin = signal<"dashboard" | "queue">("dashboard");
  readonly backFilter = signal<"open" | "history">("open");
  readonly canAct = computed(() => {
    const user = this.auth.currentUser();
    const r = this.data();
    if (!user || !r) return false;
    if (user.roles.some((role) => ["Ceo", "Admin", "Owner"].includes(role)))
      return true;
    return (
      user.roles.includes("Senior") &&
      (r.state === "Requested" || r.seniorId === user.id)
    );
  });
  backParams() {
    return {
      reviewFilter: this.backFilter(),
      focusReview: this.id || null,
      ...(this.backOrigin() === "dashboard"
        ? { taskTab: "reassessments" }
        : {}),
    };
  }
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
        this.backOrigin.set(
          params.get("origin") === "queue" ? "queue" : "dashboard",
        );
        this.backFilter.set(
          params.get("reviewFilter") === "history" ? "history" : "open",
        );
        const id = Number(params.get("requestId"));
        if (id !== this.id) {
          ++this.generation;
          this.data.set(null);
          this.loading.set(false);
          this.notes = this.cancelReason = "";
          this.diagnosis =
            this.doctorId =
            this.treatmentType =
            this.exercises =
              "";
          this.decision = "Continue";
          this.completionIntent = null;
          this.clinicians.set([]);
          this.clinicianError.set("");
          this.busy.set(false);
          this.error.set("");
        }
        this.id = id;
        if (this.id) void this.load();
      });
  }
  async load() {
    if (this.busy() || !this.id) return;
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set("");
    try {
      const data = await firstValueFrom(this.api.review(this.id));
      if (generation !== this.generation) return;
      this.data.set(data);
      // Refresh the saved status without discarding an unsaved clinical outcome.
      if (!this.notes.trim() && !this.completionIntent) {
        this.diagnosis = data.diagnosis;
        this.doctorId = data.doctorId;
        this.count = data.prescribedSessions;
        this.frequency = data.frequencyPerWeek;
        this.treatmentType = data.treatmentType;
        this.exercises = data.exercises ?? "";
      }
      if (data.state === "Completed") {
        this.notes = data.reviewNotes ?? "";
        this.decision = (data.decision as typeof this.decision) ?? "Continue";
        this.completionIntent = null;
      }
    } catch (e) {
      if (generation === this.generation) {
        this.data.set(null);
        this.error.set(clinicalError(e, this.translate));
        this.warnings.show(this.error());
      }
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  async loadClinicians() {
    const data = this.data();
    if (!data || this.clinicians().length) return;
    const generation = this.generation;
    this.clinicianError.set("");
    try {
      const clinicians = await firstValueFrom(
        this.booking.clinicians(data.patientId, null, true),
      );
      if (generation === this.generation) this.clinicians.set(clinicians);
    } catch (e) {
      if (generation === this.generation)
        this.clinicianError.set(clinicalError(e, this.translate));
    }
  }
  async start() {
    const data = this.data();
    if (!data || this.busy()) return;
    const generation = this.generation;
    this.busy.set(true);
    this.error.set("");
    try {
      const saved = await firstValueFrom(
        this.api.startReview(data.id, data.version),
      );
      if (generation === this.generation) this.data.set(saved);
    } catch (e) {
      if (generation !== this.generation) return;
      this.error.set(clinicalError(e, this.translate));
      this.warnings.show(this.error());
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
  async submit() {
    const data = this.data();
    if (!data || this.busy() || !this.notes.trim() || data.state !== "InReview")
      return;
    const generation = this.generation;
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
      const saved = await firstValueFrom(
        this.api.completeReview(data.id, this.completionIntent),
      );
      if (generation !== this.generation) return;
      this.data.set(saved);
      this.completionIntent = null;
    } catch (e) {
      if (generation !== this.generation) return;
      this.error.set(clinicalError(e, this.translate));
      this.warnings.show(this.error());
      if ([400, 409].includes((e as { status?: number }).status ?? 0))
        this.completionIntent = null;
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
  async cancel() {
    const data = this.data();
    if (!data || this.busy() || !this.cancelReason.trim()) return;
    const generation = this.generation;
    this.busy.set(true);
    this.error.set("");
    try {
      const saved = await firstValueFrom(
        this.api.cancelReview(data.id, data.version, this.cancelReason),
      );
      if (generation === this.generation) this.data.set(saved);
    } catch (e) {
      if (generation !== this.generation) return;
      this.error.set(clinicalError(e, this.translate));
      this.warnings.show(this.error());
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
}
