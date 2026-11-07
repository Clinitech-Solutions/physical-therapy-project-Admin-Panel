import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Input,
  OnInit,
  output,
  signal,
  ViewChild,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { debounceTime, firstValueFrom, Subject } from "rxjs";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AbsenceService } from "../../../core/services/absence.service";
import { ClinicianService } from "../../../core/services/clinician.service";
import { clinicDay } from "../../../core/services/reception-api";
import {
  AbsenceRequest,
  AbsenceView,
  AbsenceImpact,
  RecoveryBooking,
  RecoveryCandidate,
  RecoveryOptions,
  RecoveryRequest,
  RecoveryHistory,
} from "../../../core/models/absence.model";
import { PatientAvatar } from "../../../features/doctor/patient-avatar";

@Component({
  selector: "app-absence-recovery",
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PatientAvatar],
  templateUrl: "./absence-recovery.html",
  styleUrls: ["./absence-recovery.css", "./absence-recovery-dialog.css"],
})
export class AbsenceRecovery implements OnInit {
  private api = inject(AbsenceService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly directory = inject(ClinicianService);
  readonly translate = inject(TranslateService);
  private destroy = inject(DestroyRef);
  @Input() scheduleDate = clinicDay(new Date());
  readonly changed = output<void>();
  @ViewChild("absenceDialog") absenceDialog!: ElementRef<HTMLDialogElement>;
  @ViewChild("resolveDialog") resolveDialog!: ElementRef<HTMLDialogElement>;
  readonly absences = signal<AbsenceView[] | null>(null);
  readonly cases = signal<RecoveryBooking[] | null>(null);
  readonly queueOpen = signal(false);
  readonly loading = signal(false);
  readonly error = signal("");
  readonly success = signal("");
  readonly recordError = signal("");
  readonly resolveError = signal("");
  readonly busy = signal(false);
  readonly impact = signal<AbsenceImpact | null>(null);
  readonly impactLoading = signal(false);
  readonly editing = signal<AbsenceView | null>(null);
  readonly options = signal<RecoveryOptions | null>(null);
  readonly optionsLoading = signal(false);
  readonly selectedCase = signal<RecoveryBooking | null>(null);
  readonly selected = signal<RecoveryCandidate | null>(null);
  readonly history = signal<RecoveryHistory[] | null>(null);
  form = {
    clinicianId: "",
    date: this.scheduleDate,
    endDate: "",
    fullDay: true,
    startTime: "09:00",
    endTime: "17:00",
    note: "",
  };
  tab: "keep" | "change" = "keep";
  changeDate = "";
  reason = "";
  useException = false;
  phoneConsent = false;
  exceptionReason = "";
  private recordKey = "";
  private intent: RecoveryRequest | null = null;
  private contactKey = "";
  private contactOutcome = "";
  private previewChanges = new Subject<void>();
  private previewGeneration = 0;
  private loadGeneration = 0;
  private optionsGeneration = 0;
  private returnFocus: HTMLElement | null = null;
  ngOnInit() {
    void this.refresh();
    this.previewChanges
      .pipe(debounceTime(250), takeUntilDestroyed(this.destroy))
      .subscribe(() => void this.preview());
  }
  private text(key: string) {
    return this.translate.instant("ABSENCE." + key);
  }
  message(error: unknown): string {
    const e = error as {
      error?: { title?: string; detail?: string };
      status?: number;
    };
    const title = e.error?.title?.split(".").pop() ?? "Unknown";
    const key = "ABSENCE.ERRORS." + title;
    const translated = this.translate.instant(key);
    return translated === key ? this.text("REQUEST_FAILED") : translated;
  }
  date(value: string, withTime = true) {
    return new Date(value).toLocaleString(
      this.translate.currentLang === "ar" ? "ar-EG" : "en-US",
      {
        timeZone: "Africa/Cairo",
        year: "numeric",
        month: "short",
        day: "numeric",
        ...(withTime ? ({ hour: "2-digit", minute: "2-digit" } as const) : {}),
      },
    );
  }
  wall(value: string) {
    const p = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Cairo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(value));
    const part = (n: string) => p.find((x) => x.type === n)!.value;
    return {
      date: `${part("year")}-${part("month")}-${part("day")}`,
      time: `${part("hour")}:${part("minute")}`,
    };
  }
  role() {
    return (
      this.directory
        .clinicians()
        .find((c) => c.id === this.form.clinicianId)
        ?.roles.map((r) => this.text(r))
        .join(" / ") ?? ""
    );
  }
  async refresh() {
    const generation = ++this.loadGeneration;
    this.loading.set(true);
    this.error.set("");
    try {
      const [absences, cases] = await Promise.all([
        firstValueFrom(this.api.list(this.scheduleDate)),
        firstValueFrom(this.api.affected()),
      ]);
      if (generation !== this.loadGeneration) return;
      this.absences.set(absences);
      this.cases.set(cases);
    } catch (e) {
      if (generation === this.loadGeneration) this.error.set(this.message(e));
    } finally {
      if (generation === this.loadGeneration) this.loading.set(false);
    }
  }
  needsAttention(id: number) {
    return this.cases()?.some((c) => c.appointmentId === id) ?? false;
  }
  resolveAppointment(id: number) {
    const row = this.cases()?.find((c) => c.appointmentId === id);
    if (row) void this.openResolve(row);
  }
  openRecord(absence: AbsenceView | null = null) {
    this.returnFocus = document.activeElement as HTMLElement;
    this.recordError.set("");
    this.success.set("");
    this.editing.set(absence);
    this.impact.set(null);
    this.recordKey = crypto.randomUUID();
    const start = absence ? this.wall(absence.start) : null,
      end = absence ? this.wall(absence.end) : null;
    const fullDay =
      !absence || (start?.time === "00:00" && end?.time === "00:00");
    this.form = {
      clinicianId: absence?.clinicianId ?? "",
      date: start?.date ?? this.scheduleDate,
      endDate:
        absence && fullDay
          ? clinicDay(new Date(Date.parse(absence.end) - 1))
          : (end?.date ?? ""),
      fullDay,
      startTime: start?.time ?? "09:00",
      endTime: end?.time ?? "17:00",
      note: absence?.note ?? "",
    };
    this.absenceDialog.nativeElement.showModal();
    if (absence) void this.preview();
  }
  private request(): AbsenceRequest {
    return {
      operationKey: this.recordKey,
      clinicianId: this.form.clinicianId,
      date: this.form.date,
      endDate: this.form.endDate || null,
      fullDay: this.form.fullDay,
      startTime: this.form.fullDay ? null : this.form.startTime + ":00",
      endTime: this.form.fullDay ? null : this.form.endTime + ":00",
      note: this.form.note.trim() || null,
      expectedVersion: this.editing()?.version ?? null,
    };
  }
  fieldsChanged() {
    this.impact.set(null);
    this.recordError.set("");
    ++this.previewGeneration;
    this.previewChanges.next();
  }
  async preview() {
    const generation = ++this.previewGeneration;
    if (!this.form.clinicianId || !this.form.date) return;
    this.impactLoading.set(true);
    try {
      const impact = await firstValueFrom(this.api.preview(this.request()));
      if (generation === this.previewGeneration) this.impact.set(impact);
    } catch (e) {
      if (generation === this.previewGeneration)
        this.recordError.set(this.message(e));
    } finally {
      if (generation === this.previewGeneration) this.impactLoading.set(false);
    }
  }
  closeRecord(event?: Event) {
    if (this.busy()) {
      event?.preventDefault();
      return;
    }
    this.absenceDialog.nativeElement.close();
    this.returnFocus?.focus();
  }
  async saveAbsence(withdraw = false) {
    if (this.busy()) return;
    if (!this.form.clinicianId || !this.form.date) {
      this.recordError.set(this.text("CHECK_FIELDS"));
      return;
    }
    this.busy.set(true);
    this.recordError.set("");
    try {
      const id = this.editing()?.id ?? null;
      const saved=await firstValueFrom(
        withdraw && id !== null
          ? this.api.withdraw(id, this.request())
          : this.api.save(id, this.request()),
      );
      this.editing.set(saved);
      this.absences.update(rows=>rows?.map(row=>row.id===saved.id?saved:row) ?? null);
      this.busy.set(false);
      this.closeRecord();
      this.success.set(this.text(withdraw ? "WITHDRAWN" : "SAVED"));
      await this.refresh();
      this.changed.emit();
    } catch (e) {
      this.recordError.set(this.message(e));
    } finally {
      this.busy.set(false);
    }
  }
  async openResolve(row: RecoveryBooking) {
    this.returnFocus = document.activeElement as HTMLElement;
    this.selectedCase.set(row);
    this.options.set(null);
    this.selected.set(null);
    this.history.set(null);
    this.resolveError.set("");
    this.tab = "keep";
    this.changeDate = clinicDay(row.start);
    this.reason = "";
    this.useException = false;
    this.phoneConsent = false;
    this.exceptionReason = "";
    this.intent = null;
    this.contactKey = "";
    this.resolveDialog.nativeElement.showModal();
    await this.loadOptions();
    void this.loadHistory();
  }
  async loadHistory() {
    const row = this.selectedCase();
    if (!row) return;
    try {
      this.history.set(
        await firstValueFrom(this.api.history(row.appointmentId)),
      );
    } catch (e) {
      this.resolveError.set(this.message(e));
    }
  }
  async loadOptions() {
    const row = this.selectedCase();
    if (!row) return;
    const generation = ++this.optionsGeneration;
    this.optionsLoading.set(true);
    try {
      const options = await firstValueFrom(
        this.api.options(
          row.appointmentId,
          this.tab === "change" ? this.changeDate : undefined,
        ),
      );
      if (generation === this.optionsGeneration) {
        this.options.set(options);
        this.selectedCase.set(options.appointment);
      }
    } catch (e) {
      if (generation === this.optionsGeneration)
        this.resolveError.set(this.message(e));
    } finally {
      if (generation === this.optionsGeneration) this.optionsLoading.set(false);
    }
  }
  switchTab(tab: "keep" | "change") {
    if (this.busy()) return;
    this.tab = tab;
    this.selected.set(null);
    this.useException = false;
    this.phoneConsent = false;
    this.intent = null;
    this.resolveError.set("");
    void this.loadOptions();
  }
  choose(candidate: RecoveryCandidate, exception = false) {
    this.selected.set(candidate);
    this.useException = exception;
    this.phoneConsent = false;
    this.exceptionReason = "";
    this.intent = null;
    this.resolveError.set("");
  }
  isSelected(candidate: RecoveryCandidate) {
    const selected = this.selected();
    return (
      selected?.clinicianId === candidate.clinicianId &&
      Date.parse(selected.start) === Date.parse(candidate.start) &&
      selected.roomId === candidate.roomId
    );
  }
  chooseNearest(candidate: RecoveryCandidate) {
    this.tab = "change";
    this.changeDate = clinicDay(candidate.start);
    this.choose(candidate);
    void this.loadOptions();
  }
  closeResolve(event?: Event) {
    if (this.busy()) {
      event?.preventDefault();
      return;
    }
    this.resolveDialog.nativeElement.close();
    this.returnFocus?.focus();
  }
  async confirm() {
    const row = this.selectedCase(),
      candidate = this.selected();
    if (!row || !candidate || this.busy()) return;
    if (
      !this.reason.trim() ||
      (this.useException &&
        (!this.phoneConsent || !this.exceptionReason.trim()))
    ) {
      this.resolveError.set(this.text("CONSENT_REQUIRED"));
      return;
    }
    const payload = {
      expectedVersion: row.version,
      absenceId: row.absenceIds[0],
      clinicianId: candidate.clinicianId,
      startTime: candidate.start,
      roomId: candidate.roomId,
      action:
        this.tab === "keep" ? ("Replace" as const) : ("Reschedule" as const),
      reason: this.reason.trim(),
      useException: this.useException,
      phoneConsent: this.phoneConsent,
      exceptionReason: this.useException ? this.exceptionReason.trim() : null,
    };
    if (this.intent) {
      const { operationKey, ...previous } = this.intent;
      if (JSON.stringify(previous) !== JSON.stringify(payload))
        this.intent = null;
    }
    if (!this.intent)
      this.intent = { operationKey: crypto.randomUUID(), ...payload };
    this.busy.set(true);
    this.resolveError.set("");
    try {
      await firstValueFrom(this.api.resolve(row.appointmentId, this.intent));
      this.busy.set(false);
      this.closeResolve();
      this.success.set(this.text("RESOLVED"));
      this.intent = null;
      await this.refresh();
      this.changed.emit();
      this.host.nativeElement
        .querySelector<HTMLButtonElement>(".attention-toggle")
        ?.focus();
    } catch (e) {
      this.resolveError.set(this.message(e));
      if ((e as { status?: number }).status === 409) {
        this.intent = null;
        await this.loadOptions();
      }
    } finally {
      this.busy.set(false);
    }
  }
  async contact(outcome: "Declined" | "AwaitingResponse") {
    const row = this.selectedCase();
    if (!row || this.busy()) return;
    if (!this.contactKey || this.contactOutcome !== outcome) {
      this.contactKey = crypto.randomUUID();
      this.contactOutcome = outcome;
    }
    this.busy.set(true);
    try {
      await firstValueFrom(
        this.api.contact(row, outcome, this.contactKey, this.reason.trim()),
      );
      this.contactKey = "";
      this.success.set(this.text("CONTACT_SAVED"));
      await this.refresh();
      await this.loadHistory();
      this.selectedCase.update((current) =>
        current ? { ...current, contactStatus: outcome } : null,
      );
    } catch (e) {
      this.resolveError.set(this.message(e));
    } finally {
      this.busy.set(false);
    }
  }
}
