import { ReceptionWarnings } from '../../../core/services/reception-warnings';
import {
  Component,
  DestroyRef,
  HostListener,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { debounceTime, firstValueFrom, Subject } from "rxjs";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  DoctorWorkspaceService,
  clinicalError,
} from "../../../core/services/doctor-workspace.service";
import {
  DoctorPatientWorkspace,
  NotesFields,
  NotesMutation,
} from "../../../core/models/doctor-workspace.model";
import { ClinicalLocale } from "../../../shared/clinical-locale";

@Component({
  selector: "app-doctor-session",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule],
  templateUrl: "./session-workspace.html",
  styleUrls: ["../doctor-workspace.css", "./session-workspace.css"],
})
export class SessionWorkspace implements OnInit {
  private warnings=inject(ReceptionWarnings,{optional:true}) ?? new ReceptionWarnings();
  private api = inject(DoctorWorkspaceService);
  private route = inject(ActivatedRoute);
  private translate = inject(TranslateService);
  private destroy = inject(DestroyRef);
  readonly locale = new ClinicalLocale();
  readonly data = signal<DoctorPatientWorkspace | null>(null);
  readonly loading = signal(false);
  readonly error = signal("");
  readonly busy = signal(false);
  readonly finalizing = signal(false);
  readonly saveState = signal("Ready");
  readonly conflict = signal(false);
  readonly shortfall = signal<number | null>(null);
  readonly latest = signal<DoctorPatientWorkspace | null>(null);
  readonly requestBusy = signal(false);
  readonly requestError = signal("");
  requestKey = crypto.randomUUID();
  requestIntent: {
    operationKey: string;
    reasonCategory: string;
    notes: string;
    recommendation: string;
  } | null = null;
  readonly tabs = [
    "CURRENT_SESSION",
    "TREATMENT_PLAN",
    "PREVIOUS_SESSIONS",
    "REASSESSMENT",
  ];
  tab = signal("CURRENT_SESSION");
  id = 0;
  draft: NotesFields = {
    progressNotes: "",
    conditionChanges: "",
    responseToTreatment: "",
    treatmentPerformed: "",
  };
  dirty = false;
  reason = "ProgressConcern";
  requestNotes = "";
  recommendation = "Continue";
  private changes = new Subject<void>();
  private inFlight: Promise<void> | null = null;
  private retryPayload: NotesMutation | null = null;
  private generation = 0;
  ngOnInit() {
    this.changes
      .pipe(debounceTime(650), takeUntilDestroyed(this.destroy))
      .subscribe(() => {
        void this.saveDraft();
      });
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((params) => {
        this.inFlight = null;
        this.busy.set(false);
        this.finalizing.set(false);
        this.requestBusy.set(false);
        this.requestError.set("");
        this.requestIntent = null;
        this.requestKey = crypto.randomUUID();
        this.requestNotes = "";
        this.id = Number(
          params.get("appointmentId") ?? params.get("sessionId"),
        );
        void this.load();
      });
  }
  private fields(data: DoctorPatientWorkspace): NotesFields {
    const n = data.notes;
    return {
      progressNotes: n.progressNotes,
      conditionChanges: n.conditionChanges,
      responseToTreatment: n.responseToTreatment,
      treatmentPerformed: n.treatmentPerformed,
    };
  }
  private accept(data: DoctorPatientWorkspace, replaceDraft = true) {
    this.data.set(data);
    if (replaceDraft) {
      this.draft = this.fields(data);
      this.dirty = false;
      this.retryPayload = null;
      this.conflict.set(false);
      this.latest.set(null);
    }
    this.saveState.set(
      data.notes.version === 0 &&
        ["LegacyCompleted", "Departed"].includes(data.visit.state)
        ? "Historical"
        : data.notes.finalizedAt
          ? "Finalized"
          : data.notes.savedAt
            ? "Saved"
            : "Ready",
    );
  }
  async load() {
    const generation = ++this.generation;
    this.loading.set(true);
    this.data.set(null);
    this.error.set("");
    try {
      const data = await firstValueFrom(this.api.get(this.id));
      if (generation === this.generation) this.accept(data);
    } catch (e) {
      if (generation === this.generation) {
        this.data.set(null);
        this.error.set(clinicalError(e, this.translate)); this.warnings.show(this.error());
      }
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  changed() {
    this.dirty = true;
    this.saveState.set("Unsaved");
    this.changes.next();
  }
  editable() {
    return (
      this.data()?.visit.state === "Treating" &&
      !this.data()?.notes.finalizedAt &&
      !this.finalizing() &&
      !this.conflict()
    );
  }
  saveDraft(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    if (!this.dirty || !this.editable()) return Promise.resolve();
    const saving = this.persistDraft().finally(() => {
      if (this.inFlight === saving) this.inFlight = null;
    });
    this.inFlight = saving;
    return saving;
  }
  private async persistDraft() {
    const generation = this.generation;
    const request = this.retryPayload ?? {
      ...this.draft,
      expectedVersion: this.data()!.notes.version,
    };
    this.saveState.set("Saving");
    this.error.set("");
    try {
      const data = await firstValueFrom(this.api.save(this.id, request));
      if (generation !== this.generation) return;
      this.data.set(data);
      this.retryPayload = null;
      this.dirty =
        JSON.stringify(this.draft) !== JSON.stringify(this.fields(data));
      this.saveState.set(this.dirty ? "Unsaved" : "Saved");
      if (this.dirty) this.changes.next();
    } catch (e) {
      if (generation !== this.generation) return;
      this.retryPayload = request;
      this.saveState.set("Failed");
      this.error.set(clinicalError(e, this.translate)); this.warnings.show(this.error());
      if (
        ["Doctor.ConcurrentEdit", "Doctor.Finalized"].includes(
          (e as { error?: { title?: string } })?.error?.title ?? "",
        )
      )
        this.conflict.set(true);
    }
  }
  async reviewLatest() {
    const generation = this.generation;
    try {
      const latest = await firstValueFrom(this.api.get(this.id));
      if (generation === this.generation) this.latest.set(latest);
    } catch (e) {
      if (generation === this.generation) {
        this.error.set(clinicalError(e, this.translate)); this.warnings.show(this.error());
      }
    }
  }
  useLatest() {
    const latest = this.latest();
    if (latest) this.accept(latest);
  }
  async start() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set("");
    this.shortfall.set(null);
    const generation = this.generation;
    try {
      const data = await firstValueFrom(this.api.start(this.id));
      if (generation === this.generation) this.accept(data);
    } catch (e) {
      if (generation !== this.generation) return;
      this.error.set(clinicalError(e, this.translate)); this.warnings.show(this.error());
      const value = (
        e as { error?: { details?: { additionalPaymentRequired?: number } } }
      )?.error?.details?.additionalPaymentRequired;
      if (typeof value === "number") this.shortfall.set(value);
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
  async end() {
    if (
      this.finalizing() ||
      this.conflict() ||
      !this.data() ||
      !this.draft.progressNotes.trim()
    )
      return;
    this.finalizing.set(true);
    const generation = this.generation;
    const id = this.id;
    this.error.set("");
    try {
      if (this.inFlight) await this.inFlight;
      if (generation !== this.generation) return;
      if (this.retryPayload || this.conflict()) {
        this.error.set(this.translate.instant("DOCTOR.RECONCILE_NOTES"));
        return;
      }
      const saved = await firstValueFrom(
        this.api.save(
          id,
          { ...this.draft, expectedVersion: this.data()!.notes.version },
          true,
        ),
      );
      if (generation === this.generation) this.accept(saved);
    } catch (e) {
      if (generation !== this.generation) return;
      this.error.set(clinicalError(e, this.translate)); this.warnings.show(this.error());
      this.saveState.set("Failed");
      if (
        ["Doctor.ConcurrentEdit", "Doctor.Finalized"].includes(
          (e as { error?: { title?: string } })?.error?.title ?? "",
        )
      )
        this.conflict.set(true);
    } finally {
      if (generation === this.generation) this.finalizing.set(false);
    }
  }
  get hasActiveReview() {
    return (
      this.data()?.reassessments.some(
        (r) => r.state === "Requested" || r.state === "InReview",
      ) ?? false
    );
  }
  async refreshReviews() {
    const generation = this.generation;
    try {
      const current = await firstValueFrom(this.api.get(this.id));
      if (generation !== this.generation) return;
      this.data.update((data) =>
        data ? { ...data, reassessments: current.reassessments } : data,
      );
    } catch (e) {
      if (generation === this.generation)
        this.requestError.set(clinicalError(e, this.translate));
    }
  }
  async requestReview() {
    if (
      this.requestBusy() ||
      !this.requestNotes.trim() ||
      (this.hasActiveReview && !this.requestIntent)
    )
      return;
    this.requestBusy.set(true);
    this.requestError.set("");
    const generation = this.generation;
    this.requestIntent ??= {
      operationKey: this.requestKey,
      reasonCategory: this.reason,
      notes: this.requestNotes,
      recommendation: this.recommendation,
    };
    try {
      const result = await firstValueFrom(
        this.api.request(this.id, this.requestIntent),
      );
      if (generation !== this.generation) return;
      this.data.update((data) =>
        data
          ? {
              ...data,
              reassessments: [
                result,
                ...data.reassessments.filter((r) => r.id !== result.id),
              ],
            }
          : data,
      );
      this.requestIntent = null;
      this.requestKey = crypto.randomUUID();
    } catch (e) {
      if (generation !== this.generation) return;
      this.requestError.set(clinicalError(e, this.translate));
      if (
        (e as { error?: { title?: string } })?.error?.title ===
        "Reassessment.ExistingActive"
      ) {
        await this.refreshReviews();
        if (generation !== this.generation) return;
        this.requestIntent = null;
        this.requestKey = crypto.randomUUID();
      } else if ((e as { status?: number }).status === 400)
        this.requestIntent = null;
    } finally {
      if (generation === this.generation) this.requestBusy.set(false);
    }
  }
  async download(document: { id: number; fileName: string }) {
    try {
      const blob = await firstValueFrom(
        this.api.document(this.id, document.id),
      );
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = document.fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      this.error.set(clinicalError(e, this.translate)); this.warnings.show(this.error());
    }
  }
  canLeave() {
    return (
      (!this.dirty && !this.inFlight && !this.finalizing()) ||
      window.confirm(this.translate.instant("DOCTOR.UNSAVED_WARNING"))
    );
  }
  @HostListener("window:beforeunload", ["$event"]) beforeUnload(
    event: BeforeUnloadEvent,
  ) {
    if (this.dirty || this.inFlight || this.finalizing()) {
      event.preventDefault();
      event.returnValue = "";
    }
  }
}
