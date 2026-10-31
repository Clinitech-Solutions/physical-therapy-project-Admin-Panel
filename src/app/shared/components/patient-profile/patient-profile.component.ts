import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  OnChanges,
  OnDestroy,
  signal,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { DialogModule } from "primeng/dialog";
import { firstValueFrom, Subscription } from "rxjs";
import { PatientService } from "../../../core/services/patient.service";
import { PatientProfileService } from "../../../core/services/patient-profile.service";
import {
  InsuranceDocumentService,
  InsuranceDocumentRecord,
} from "../../../core/services/insurance-document.service";
import { AuthService } from "../../../core/services/auth";
import {
  apiError,
  numericId,
  ReceptionEvents,
  unknownOutcome,
} from "../../../core/services/reception-api";
import { Patient } from "../../../core/models/patient.model";
import {
  ProfileCourse,
  ProfileActivity,
  ProfileData,
  ProfileSession,
  RescheduleAvailability,
  RescheduleRequest,
  RescheduleSlot,
  RescheduleReceipt,
} from "../../../core/models/patient-profile.model";
import {
  ReceptionistLocale,
  ReceptionistTextPipe,
} from "../../receptionist-locale";

type Tab = "sessions" | "payments" | "activity" | "documents";
interface PendingChange {
  patientId: number;
  appointmentId: number;
  request: RescheduleRequest;
}
@Component({
  selector: "app-patient-profile",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    DialogModule,
    ReceptionistTextPipe,
  ],
  templateUrl: "./patient-profile.component.html",
  styleUrls: ["./patient-profile.component.css"],
})
export class PatientProfileComponent implements OnChanges, OnDestroy {
  constructor() {
    const changeDetector = inject(ChangeDetectorRef, { optional: true });
    inject(TranslateService, { optional: true })
      ?.onLangChange.pipe(takeUntilDestroyed())
      .subscribe(() => changeDetector?.markForCheck());
  }
  readonly locale = new ReceptionistLocale();
  readonly patientService = inject(PatientService);
  readonly api = inject(PatientProfileService);
  readonly documentService = inject(InsuranceDocumentService);
  readonly auth = inject(AuthService);
  private readonly events = inject(ReceptionEvents);
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() patientId: string | null = null;
  @Input() patient: Patient | null = null;
  readonly data = signal<ProfileData | null>(null);
  readonly loading = signal(false);
  readonly profileError = signal("");
  readonly patientLoading = signal(false);
  readonly patientError = signal("");
  readonly documents = signal<InsuranceDocumentRecord[]>([]);
  readonly documentsLoading = signal(false);
  readonly documentsError = signal("");
  readonly documentDownloadError = signal("");
  readonly uploadError = signal("");
  readonly uploadSaved = signal(false);
  files: File[] = [];
  readonly slotData = signal<RescheduleAvailability | null>(null);
  readonly slotsLoading = signal(false);
  readonly slotsError = signal("");
  readonly saveError = signal("");
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly pending = signal<PendingChange | null>(null);
  readonly confirmedMissing = signal(false);
  selectedCourseId: number | null = null;
  activeTab: Tab = "sessions";
  readonly tabs: Tab[] = ["sessions", "payments", "activity", "documents"];
  page = 0;
  readonly pageSize = 5;
  editing: ProfileSession | null = null;
  draftDate = "";
  selectedSlot: RescheduleSlot | null = null;
  reason = "";
  private originalDate = "";
  discardAction: (() => void) | null = null;
  private slotsRequest?: Subscription;
  private profileRequest?: Subscription;
  private docsRequest?: Subscription;
  private patientRequest?: Subscription;
  private generation = 0;
  private slotGeneration = 0;
  private loadedId = "";
  get currentPatient() {
    const id = this.patientId ?? this.patient?.id;
    return (
      this.patientService.patients().find((p) => p.id === id) ??
      (this.patient?.id === id ? this.patient : undefined)
    );
  }
  get course(): ProfileCourse | null {
    return (
      this.data()?.courses.find((c) => c.id === this.selectedCourseId) ?? null
    );
  }
  get primaryDoctorName() {
    return this.course?.doctorName || this.locale.label("Unknown");
  }
  get totalSessions() {
    return this.course?.prescribedSessions ?? 0;
  }
  get completedSessionsCount() {
    return this.course?.completedSessions ?? 0;
  }
  get progressPercentage() {
    return this.totalSessions
      ? Math.min(100, (this.completedSessionsCount / this.totalSessions) * 100)
      : 0;
  }
  get sessions() {
    return this.course?.sessions ?? [];
  }
  get pageRows() {
    return this.sessions.slice(
      this.page * this.pageSize,
      (this.page + 1) * this.pageSize,
    );
  }
  get pageCount() {
    return Math.max(1, Math.ceil(this.sessions.length / this.pageSize));
  }
  get activityGroups() {
    const groups = new Map<string, ProfileActivity[]>();
    const events = [...(this.course?.activity ?? [])].sort(
      (a, b) => Date.parse(b.changedAt) - Date.parse(a.changedAt),
    );
    for (const event of events) {
      const day = this.cairoDay(event.changedAt);
      const group = groups.get(day) ?? [];
      group.push(event);
      groups.set(day, group);
    }
    return [...groups].map(([day, events]) => ({ day, events }));
  }
  activitySessionNumber(event: ProfileActivity) {
    return this.sessions.find((s) => s.appointmentId === event.appointmentId)
      ?.sessionNumber;
  }
  activityDateChanged(event: ProfileActivity) {
    return this.cairoDay(event.previousStart) !== this.cairoDay(event.newStart);
  }
  activityTimeChanged(event: ProfileActivity) {
    return (
      this.formatTime(event.previousStart) !==
        this.formatTime(event.newStart) ||
      this.formatTime(event.previousEnd) !== this.formatTime(event.newEnd)
    );
  }
  get isInsurancePatient() {
    return this.currentPatient?.paymentType === "Insurance";
  }
  get canEdit() {
    return ["Receptionist", "Ceo", "Admin", "Owner"].some((r) =>
      this.auth.hasRole(r as never),
    );
  }
  get scheduleChanged() {
    return (
      !!this.selectedSlot &&
      !!this.editing &&
      (this.selectedSlot.startTime !== this.editing.startTime ||
        this.selectedSlot.roomId !== this.editing.roomId)
    );
  }
  get dirty() {
    return (
      !!this.editing &&
      (this.draftDate !== this.originalDate ||
        (!!this.selectedSlot &&
          (this.selectedSlot.startTime !== this.editing.startTime ||
            this.selectedSlot.roomId !== this.editing.roomId)) ||
        !!this.reason.trim())
    );
  }
  get minimumDate() {
    return this.cairoDay(new Date().toISOString());
  }
  get editableEmail() {
    const email = this.currentPatient?.email;
    return email && !/@example\.(com|invalid)$/i.test(email) ? email : "";
  }
  ngOnChanges() {
    if (this.visible) this.refreshProfile();
    else this.cancelReads();
  }
  ngOnDestroy() {
    this.cancelReads();
  }
  private cancelReads() {
    this.generation++;
    this.slotGeneration++;
    this.slotsRequest?.unsubscribe();
    this.profileRequest?.unsubscribe();
    this.docsRequest?.unsubscribe();
    this.patientRequest?.unsubscribe();
  }
  refreshProfile() {
    const id = this.patientId ?? this.patient?.id;
    if (!id) return;
    if (id !== this.loadedId) {
      this.cancelReads();
      this.loadedId = id;
      this.data.set(null);
      this.selectedCourseId = null;
      this.page = 0;
      this.activeTab = "sessions";
      this.documents.set([]);
      this.documentsError.set("");
      this.files = [];
      this.uploadError.set("");
      this.uploadSaved.set(false);
      this.clearEditor();
      this.restorePending();
    }
    const generation = ++this.generation;
    this.patientError.set("");
    this.patientLoading.set(true);
    this.patientRequest?.unsubscribe();
    this.patientRequest = this.patientService
      .getPatientById(numericId(id))
      .subscribe({
        next: () => {
          if (generation === this.generation) this.patientLoading.set(false);
        },
        error: (e) => {
          if (generation === this.generation) {
            this.patientError.set(apiError(e));
            this.patientLoading.set(false);
          }
        },
      });
    this.reloadCourseData();
  }
  reloadCourseData() {
    const id = Number(this.loadedId);
    if (!id) return;
    const generation = this.generation;
    this.profileRequest?.unsubscribe();
    this.loading.set(true);
    this.profileError.set("");
    this.profileRequest = this.api.profile(id).subscribe({
      next: (data) => {
        if (generation !== this.generation) return;
        this.data.set(data);
        this.loading.set(false);
        if (!data.courses.some((c) => c.id === this.selectedCourseId))
          this.selectedCourseId =
            data.courses.find((c) => c.status === "Active")?.id ??
            data.courses[0]?.id ??
            null;
        this.page = Math.min(this.page, this.pageCount - 1);
      },
      error: (e) => {
        if (generation === this.generation) {
          this.loading.set(false);
          this.profileError.set(apiError(e));
        }
      },
    });
  }
  chooseCourse(id: number) {
    if (id === this.selectedCourseId) return;
    this.guardDiscard(() => {
      this.clearEditor();
      this.selectedCourseId = id;
      this.page = 0;
      this.saved.set(false);
    });
  }
  setTab(tab: Tab) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    if (
      tab === "documents" &&
      !this.documents().length &&
      !this.documentsLoading()
    )
      this.retryDocuments();
  }
  tabKey(event: KeyboardEvent, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % 4;
    else if (event.key === "ArrowLeft") next = (index + 3) % 4;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = 3;
    else return;
    event.preventDefault();
    this.setTab(this.tabs[next]);
    document.getElementById("profile-tab-" + this.tabs[next])?.focus();
  }
  changePage(offset: number) {
    this.guardDiscard(() => {
      this.clearEditor();
      this.page = Math.max(0, Math.min(this.pageCount - 1, this.page + offset));
    });
  }
  openEditor(row: ProfileSession) {
    if (
      this.saving() ||
      this.pending() ||
      !row.canReschedule ||
      !row.appointmentId ||
      !this.canEdit
    )
      return;
    if (this.editing?.id === row.id) {
      this.cancelEditor();
      return;
    }
    this.guardDiscard(() => {
      this.clearEditor();
      this.editing = { ...row };
      this.draftDate = this.cairoDay(row.startTime);
      this.originalDate = this.draftDate;
      this.loadSlots();
      setTimeout(() => document.getElementById("reschedule-date")?.focus(), 0);
    });
  }
  dateChanged(value: string) {
    this.draftDate = value;
    this.selectedSlot = null;
    this.loadSlots();
  }
  loadSlots() {
    this.slotsRequest?.unsubscribe();
    const generation = ++this.slotGeneration;
    this.selectedSlot = null;
    this.slotData.set(null);
    this.slotsError.set("");
    if (
      !this.editing?.appointmentId ||
      !/^\d{4}-\d{2}-\d{2}$/.test(this.draftDate)
    ) {
      this.slotsLoading.set(false);
      return;
    }
    this.slotsLoading.set(true);
    this.slotsRequest = this.api
      .slots(this.editing.appointmentId, this.draftDate)
      .subscribe({
        next: (availability) => {
          if (
            generation !== this.slotGeneration ||
            availability.appointmentId !== this.editing?.appointmentId
          )
            return;
          this.slotData.set(availability);
          this.slotsLoading.set(false);
          if (availability.version !== this.editing.version) {
            this.editing = {
              ...this.editing,
              version: availability.version,
              startTime: availability.currentStart,
              endTime: availability.currentEnd,
              roomId: availability.currentRoomId,
            };
            this.saveError.set(
              this.t(
                "STALE",
                "This appointment changed. Review the latest schedule before saving.",
              ),
            );
          }
        },
        error: (e) => {
          if (generation === this.slotGeneration) {
            this.slotsLoading.set(false);
            this.slotsError.set(apiError(e));
          }
        },
      });
  }
  pickSlot(slot: RescheduleSlot) {
    if (!this.saving() && !this.pending()) this.selectedSlot = slot;
  }
  private storageKey() {
    return `ptcenter.profile-reschedule.${this.auth.currentUser()?.id ?? "unknown"}.${this.loadedId}`;
  }
  private persistPending(value: PendingChange | null) {
    this.pending.set(value);
    try {
      if (value)
        sessionStorage.setItem(this.storageKey(), JSON.stringify(value));
      else sessionStorage.removeItem(this.storageKey());
    } catch {}
  }
  private restorePending() {
    this.pending.set(null);
    try {
      const raw = sessionStorage.getItem(this.storageKey());
      if (raw) {
        const value = JSON.parse(raw) as PendingChange;
        if (
          value.patientId === Number(this.loadedId) &&
          value.request?.operationKey
        )
          this.pending.set(value);
      }
    } catch {}
  }
  async saveSession() {
    if (
      this.saving() ||
      this.pending() ||
      !this.editing?.appointmentId ||
      !this.selectedSlot ||
      !this.slotData() ||
      this.slotsLoading() ||
      (this.selectedSlot.startTime === this.editing.startTime &&
        this.selectedSlot.roomId === this.editing.roomId)
    )
      return;
    const pending: PendingChange = {
      patientId: Number(this.loadedId),
      appointmentId: this.editing.appointmentId,
      request: {
        operationKey: crypto.randomUUID(),
        expectedVersion: this.slotData()!.version,
        startTime: this.selectedSlot.startTime,
        roomId: this.selectedSlot.roomId,
        reason: this.reason.trim() || null,
      },
    };
    this.persistPending(pending);
    await this.sendPending(pending);
  }
  private async sendPending(pending: PendingChange) {
    this.saving.set(true);
    this.saveError.set("");
    this.confirmedMissing.set(false);
    try {
      const receipt = await firstValueFrom(
        this.api.save(pending.appointmentId, pending.request),
      );
      this.acceptReceipt(receipt);
    } catch (error) {
      this.saveError.set(apiError(error));
      if (!unknownOutcome(error)) {
        this.persistPending(null);
        if ((error as { status?: number }).status === 409) {
          this.loadSlots();
          this.reloadCourseData();
        }
      }
    } finally {
      this.saving.set(false);
    }
  }
  async reconcile() {
    const pending = this.pending();
    if (!pending || this.saving()) return;
    this.saving.set(true);
    this.saveError.set("");
    try {
      this.acceptReceipt(
        await firstValueFrom(
          this.api.reconcile(
            pending.appointmentId,
            pending.request.operationKey,
          ),
        ),
      );
    } catch (error) {
      this.saveError.set(apiError(error));
      this.confirmedMissing.set((error as { status?: number }).status === 404);
    } finally {
      this.saving.set(false);
    }
  }
  async retryOriginal() {
    const pending = this.pending();
    if (!pending || this.saving() || !this.confirmedMissing()) return;
    await this.sendPending(pending);
  }
  private acceptReceipt(receipt: RescheduleReceipt) {
    this.persistPending(null);
    this.confirmedMissing.set(false);
    this.saveError.set("");
    this.data.update((data) =>
      data
        ? {
            ...data,
            courses: data.courses.map((c) => ({
              ...c,
              sessions: c.sessions.map((s) =>
                s.appointmentId === receipt.appointmentId
                  ? {
                      ...s,
                      startTime: receipt.startTime,
                      endTime: receipt.endTime,
                      roomId: receipt.roomId,
                      roomName: receipt.roomName,
                    }
                  : s,
              ),
            })),
          }
        : data,
    );
    const session = this.editing?.id;
    this.clearEditor();
    this.saved.set(true);
    this.reloadCourseData();
    this.events.changed.next("appointments");
    setTimeout(
      () => document.getElementById("edit-session-" + session)?.focus(),
      0,
    );
  }
  cancelEditor() {
    if (this.saving() || this.pending()) return;
    const id = this.editing?.id;
    this.guardDiscard(() => {
      this.clearEditor();
      setTimeout(
        () => document.getElementById("edit-session-" + id)?.focus(),
        0,
      );
    });
  }
  private clearEditor() {
    this.slotsRequest?.unsubscribe();
    this.slotGeneration++;
    this.editing = null;
    this.draftDate = "";
    this.selectedSlot = null;
    this.reason = "";
    this.slotData.set(null);
    this.slotsLoading.set(false);
    this.slotsError.set("");
    this.saveError.set("");
    this.discardAction = null;
  }
  private guardDiscard(action: () => void) {
    if (this.saving() || this.pending()) return;
    if (this.dirty) {
      this.discardAction = action;
      setTimeout(
        () => document.getElementById("keep-profile-edit")?.focus(),
        0,
      );
    } else action();
  }
  discard() {
    const action = this.discardAction;
    this.discardAction = null;
    action?.();
  }
  keepEditing() {
    this.discardAction = null;
    setTimeout(() => document.getElementById("reschedule-date")?.focus(), 0);
  }
  closeKeepingPending() {
    if (this.saving() || !this.pending()) return;
    this.cancelReads();
    this.visible = false;
    this.visibleChange.emit(false);
  }
  onVisibleChange(value: boolean) {
    if (!value) this.closeModal();
  }
  closeModal() {
    if (this.documentService.mutation.busy()) return;
    this.guardDiscard(() => {
      this.clearEditor();
      this.cancelReads();
      this.visible = false;
      this.visibleChange.emit(false);
    });
  }
  dialogKey(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.closeModal();
    }
  }
  onShow() {
    setTimeout(() => document.getElementById("profile-close")?.focus(), 0);
  }
  retryDocuments() {
    const id = Number(this.loadedId);
    if (!id || !this.isInsurancePatient) return;
    const generation = this.generation;
    this.docsRequest?.unsubscribe();
    this.documentsLoading.set(true);
    this.documentsError.set("");
    this.docsRequest = this.documentService
      .getDocumentsForPatient(id)
      .subscribe({
        next: (docs) => {
          if (generation === this.generation) {
            this.documents.set(docs);
            this.documentsLoading.set(false);
          }
        },
        error: (e) => {
          if (generation === this.generation) {
            this.documentsError.set(apiError(e));
            this.documentsLoading.set(false);
          }
        },
      });
  }
  onFilesSelected(event: Event) {
    this.files = Array.from((event.target as HTMLInputElement).files ?? []);
    this.uploadSaved.set(false);
  }
  async uploadDocuments() {
    if (
      !this.isInsurancePatient ||
      this.documentService.mutation.busy() ||
      !this.files.length ||
      !this.currentPatient
    )
      return;
    const generation = this.generation;
    this.uploadError.set("");
    this.uploadSaved.set(false);
    try {
      await firstValueFrom(
        this.documentService.uploadDocuments(Number(this.loadedId), this.files),
      );
      if (generation === this.generation) {
        this.files = [];
        this.uploadSaved.set(true);
        this.retryDocuments();
      }
    } catch (error) {
      if (generation === this.generation) this.uploadError.set(apiError(error));
    }
  }
  async downloadDocument(document: InsuranceDocumentRecord) {
    if (document.patientId !== Number(this.loadedId)) return;
    this.documentDownloadError.set("");
    try {
      const blob = await firstValueFrom(
        this.documentService.downloadDocument(document.id),
      );
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = document.fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      this.documentDownloadError.set(apiError(error));
    }
  }
  t(key: string, fallback: string, params?: Record<string, unknown>) {
    return this.locale.text("PROFILE_" + key, fallback, params);
  }
  label(value: string) {
    const labels: Record<string, string> = {
      Pending: "Upcoming",
      InProgress: "In progress",
      NoShow: "No-show",
      NoPatientCharge: "No patient charge",
    };
    return this.t(
      value === "Unknown" ? "UNKNOWN_LABEL" : value.toUpperCase(),
      labels[value] ?? value,
    );
  }
  cairoDay(value: string | null) {
    if (!value) return "";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Cairo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    return ["year", "month", "day"]
      .map((type) => parts.find((p) => p.type === type)?.value)
      .join("-");
  }
  private format(
    value: string | null | undefined,
    options: Intl.DateTimeFormatOptions,
  ) {
    if (!value) return "\u2014";
    const date = new Date(value);
    return Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat(this.locale.language, {
          timeZone: "Africa/Cairo",
          ...options,
        }).format(date)
      : "\u2014";
  }
  formatTime(value: string | null | undefined) {
    return this.format(value, { hour: "2-digit", minute: "2-digit" });
  }
  formatDate(value: string | null | undefined) {
    return this.format(value, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
  weekday(value: string | null) {
    return this.format(value, { weekday: "short" });
  }
}
