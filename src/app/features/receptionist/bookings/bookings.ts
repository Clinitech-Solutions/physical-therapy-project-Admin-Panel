import { BookingService } from '../../../core/services/booking.service';
import { BookingContext, BookingPreview, BookingReceipt, BookingRequest, BookingPaymentMethod } from '../../../core/models/booking.model';
import { ClinicalRecordsService } from "../../../core/services/clinical-records.service";
import { AppointmentWorkflowService } from "../../../core/services/appointment-workflow.service";
import { ReceptionContracts } from "../../../core/services/reception-contracts";
import {
  apiError,
  localDay,
  numericId,
  ReceptionError,
} from "../../../core/services/reception-api";
import { RoomService } from "../../../core/services/room.service";
import {
  ClinicianService,
  Clinician,
} from "../../../core/services/clinician.service";
import { PatientRegistrationFieldsComponent } from "../../../shared/components/patient-registration-fields/patient-registration-fields";
import {
  ReceptionistLocale,
  ReceptionistTextPipe,
} from "../../../shared/receptionist-locale";
import { Component, signal, computed, inject, OnInit, ViewChild, DestroyRef } from "@angular/core";
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RoomRecord } from '../../../core/models/room-api.model';
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { TranslateModule } from "@ngx-translate/core";
import { FormsModule } from "@angular/forms";
import { firstValueFrom, Subscription, Subject, takeUntil } from "rxjs";
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from "primeng/api";
import { SelectModule } from "primeng/select";
import { DatePickerModule } from "primeng/datepicker";
import { DialogModule } from "primeng/dialog";
import { SelectButtonModule } from "primeng/selectbutton";
import { ButtonModule } from "primeng/button";
import { TooltipModule } from "primeng/tooltip";
import { InputNumberModule } from "primeng/inputnumber";
import { MultiSelectModule } from "primeng/multiselect";
import { SessionType } from "../../../core/models/session.model";
import { Patient } from "../../../core/models/patient.model";
import { PatientProfileComponent } from "../../../shared/components/patient-profile/patient-profile.component";
import {
  AppointmentService,
  Appointment,
} from "../../../core/services/appointment.service";
import { PatientService } from "../../../core/services/patient.service";
import { InsuranceService } from "../../../core/services/insurance.service";
import {
  emptyPatientRegistration,
  PatientInputError,
  PatientValidationError,
  patientOutcomeIsUnknown,
  patientServerError,
} from "../../../core/services/patient-registration";
import { BillingService } from "../../../core/services/billing.service";

@Component({
  selector: "app-receptionist-bookings",
  standalone: true,
  imports: [
    PatientRegistrationFieldsComponent,
    ReceptionistTextPipe,
    CommonModule,
    RouterModule,
    TranslateModule,
    FormsModule,
    SelectModule,
    DatePickerModule,
    DialogModule,
    SelectButtonModule,
    ButtonModule,
    TooltipModule,
    InputNumberModule,
    MultiSelectModule,
    PatientProfileComponent,
  ],
  templateUrl: "./bookings.html",
  styleUrls: ["./bookings.css", "./booking-layout.css", "./booking-controls.css", "./booking-table.css", "./booking-financial.css"],
})
export class BookingsComponent implements OnInit {
  readonly locale = new ReceptionistLocale();
  clinical = inject(ClinicalRecordsService);
  workflow = inject(AppointmentWorkflowService);
  contracts = inject(ReceptionContracts);
  readonly bookingBusy = signal(false);
  readonly bookingError = signal("");
  readonly bookingApi = inject(BookingService);
  readonly bookingContext = signal<BookingContext | null>(null);
  readonly contextLoading = signal(false);
  readonly preview = signal<BookingPreview | null>(null);
  readonly lastReceipt = signal<BookingReceipt | null>(null);
  private contextGeneration = 0;
  private clinicianGeneration = 0;
  private previewFingerprint = '';
  private pendingBooking: BookingRequest | null = null;
  private recoveryEditing = false;
  get hasUnresolvedBooking(): boolean { return !!this.bookingApi.uncertainKey() && !this.recoveryEditing; }
  assessmentCharge: 'Free' | 'Paid' | null = null;
  pricingMode: 'PerSession' | 'Package' = 'PerSession';
  unitPrice: number | null = null;
  packagePrice: number | null = null;
  discount = 0;
  discountType: 'None' | 'Percent' | 'Fixed' = 'None';
  discountValue = 0;
  private readonly patientChanged = new Subject<void>();
  private readonly planChanged = new Subject<void>();
  get agreement() { return this.chosenPlan?.financial; }
  get maxBookingSessions() { return Math.min(this.chosenPlan?.remainingSessions ?? 1, this.bookingContext()?.remainingApprovedSessions ?? 200); }
  get canPreview(): boolean {
    const context = this.bookingContext();
    if (!context || this.bookingBusy() || this.contextLoading() || this.hasUnresolvedBooking || this.clinicianService.loading() || this.roomAvailabilityLoading() || this.roomAvailabilityError()) return false;
    if (context.hasCompletedAssessment && (!this.chosenPlan || this.maxBookingSessions <= 0 || context.isInsurance && !context.insuranceApproved)) return false;
    if (!this.selectedDoctorId || !this.selectedRoomId || !this.bookingDates.length || this.bookingMode === 'plan' && this.planSessionCount > this.maxBookingSessions) return false;
    return this.isWaivedAssessment || (this.assessmentCharge === 'Paid' || context.hasCompletedAssessment) &&
      (!!this.agreement || Number(this.unitPrice) > 0) && this.deposit >= 0 && (this.deposit === 0 || !!this.paymentMethod) &&
      (this.discountType === 'None' || this.discountValue >= 0 && (this.discountType !== 'Percent' || this.discountValue <= 100));
  }
  get bookingDates(): Date[] { return this.bookingMode === 'plan' ? this.generateBulkDates() : this.scheduledDate && Number.isFinite(this.scheduledDate.getTime()) ? [this.scheduledDate] : []; }
  get bookingDate() { return this.bookingMode === 'plan' ? this.planStartDate : this.scheduledDate; }
  get bookingTime() { return this.bookingMode === 'plan' ? this.planPreferredTime : this.scheduledDate; }
  onBookingDateChange(date: Date | null) {
    if (this.bookingMode === 'plan') this.planStartDate = date;
    else if (!date) this.scheduledDate = null;
    else { const time = this.scheduledDate; this.scheduledDate = new Date(date); if (time) this.scheduledDate.setHours(time.getHours(), time.getMinutes(), 0, 0); }
    this.refreshRoomAvailability();
  }
  onBookingTimeChange(time: Date | null) {
    if (this.bookingMode === 'plan') this.planPreferredTime = time;
    else if (!time) this.scheduledDate = null;
    else { const date = new Date(this.scheduledDate ?? new Date()); date.setHours(time.getHours(), time.getMinutes(), 0, 0); this.scheduledDate = date; }
    this.refreshRoomAvailability();
  }
  get bookingWeekDays() { return [1, 2, 3, 4, 5, 6, 0].map(value => this.localizedWeekDays.find(day => day.value === value)!); }
  toggleBookingDay(day: number) {
    this.selectedDays = this.selectedDays.includes(day) ? this.selectedDays.filter(value => value !== day) : [...this.selectedDays, day];
    this.refreshRoomAvailability();
  }
  setPricingMode(mode: 'PerSession' | 'Package') {
    if (this.agreement || this.bookingContext()?.isInsurance || this.isNewPatient || this.bookingBusy() || this.hasUnresolvedBooking) return;
    this.pricingMode = mode; this.preview.set(null);
  }
  get summaryQuote() { return this.previewIsCurrent ? this.preview() : null; }
  get summaryFinancial() { return this.summaryQuote?.financial ?? this.agreement ?? null; }
  get appointmentRows() {
    return this.summaryQuote?.appointments ?? this.bookingDates.map(date => ({startTime: date.toISOString(), endTime: new Date(date.getTime() + 3600000).toISOString(), conflicts: null}));
  }
  formatWeekday(value: string) { return new Date(value).toLocaleDateString(this.locale.language, {weekday: 'short'}); }
  syncAgreement() {
    const agreement = this.agreement;
    this.pricingMode = agreement?.pricingMode ?? (this.bookingContext()?.isInsurance ? 'Package' : 'PerSession');
    this.unitPrice = agreement?.unitPrice ?? null; this.discountType = agreement?.discountType ?? 'None';
    this.discountValue = agreement?.discountValue ?? 0; this.preview.set(null);
  }
  deposit = 0;
  paymentMethod: BookingPaymentMethod | null = null;
  installments: { dueDate: string; amount: number | null }[] = [];
  readonly paymentMethods: BookingPaymentMethod[] = ['Cash', 'Visa', 'Online'];
  get scheduledEndDate(): Date | null { return this.scheduledDate ? new Date(this.scheduledDate.getTime() + 3600000) : null; }
  selectedPlanId: number | null = null;
  readonly bulkProgress = signal<number[]>([]);
  messageService = inject(MessageService);
  appointmentService = inject(AppointmentService, { optional: true })!;
  patientService = inject(PatientService);
  insuranceService = inject(InsuranceService);
  readonly registeringPatient = signal(false);
  readonly quickRegistrationError = signal("");
  readonly quickRegistrationValidationErrors = signal<PatientInputError[]>([]);
  @ViewChild(PatientRegistrationFieldsComponent) private registrationFields?: PatientRegistrationFieldsComponent;
  billingService =
    inject(BillingService, { optional: true }) ?? new BillingService();

  viewMode = signal<"Week" | "Day">("Day");
  isLoading = computed(
    () => this.bookingBusy() || !!this.appointmentService?.loading(),
  );

  // Global State Signals
  appointments =
    this.appointmentService?.appointments ?? signal<Appointment[]>([]);
  allPatients = signal<Patient[]>([]);
  readonly directoryLoading = signal(false);
  readonly directoryError = signal('');
  roomService = inject(RoomService);
  clinicianService = inject(ClinicianService);
  allDoctors = this.clinicianService.clinicians;
  allRooms = computed(() =>
    this.roomService
      .rooms()
      .map((r) => ({ ...r, id: String(r.id), displayName: r.name })),
  );
  private readonly availableRoomRecords = signal<RoomRecord[]>([]);
  readonly roomAvailabilityLoading = signal(false);
  readonly roomAvailabilityError = signal('');
  private roomAvailabilityRequest?: Subscription;
  private roomAvailabilityGeneration = 0;
  private readonly destroyRef = inject(DestroyRef);
  availableRooms = computed(() => this.availableRoomRecords().filter(room => room.isActive && room.capacity > 0 && room.status === 'Available')
    .map(room => ({ ...room, id: String(room.id), displayName: room.name })));

  constructor() {
    this.roomService.refreshed.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.bookingContext()) this.refreshRoomAvailability();
    });
  }

  refreshRoomAvailability() {
    const generation = ++this.roomAvailabilityGeneration;
    this.roomAvailabilityRequest?.unsubscribe();
    this.preview.set(null); this.availableRoomRecords.set([]); this.roomAvailabilityError.set('');
    const dates = this.bookingMode === 'plan' ? this.generateBulkDates() : this.scheduledDate ? [this.scheduledDate] : [];
    if (!this.bookingContext() || !dates.length || dates.some(date => !Number.isFinite(date.getTime()))) {
      this.roomAvailabilityLoading.set(false); this.selectedRoomId = ''; return;
    }
    this.roomAvailabilityLoading.set(true);
    this.roomAvailabilityRequest = this.roomService.availability(dates.map(date => date.toISOString())).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rooms => {
        if (generation !== this.roomAvailabilityGeneration) return;
        this.availableRoomRecords.set(rooms); this.roomAvailabilityLoading.set(false);
        if (!rooms.some(room => String(room.id) === this.selectedRoomId)) this.selectedRoomId = '';
      },
      error: error => {
        if (generation !== this.roomAvailabilityGeneration) return;
        this.roomAvailabilityLoading.set(false); this.roomAvailabilityError.set(apiError(error)); this.selectedRoomId = '';
      },
    });
  }

  // Patient Profile Modal
  selectedProfilePatientId = signal<string | null>(null);
  showProfileModal = signal<boolean>(false);

  openPatientProfile(patientId: string | number) {
    this.selectedProfilePatientId.set(patientId.toString());
    this.showProfileModal.set(true);
  }

  ngOnInit() { this.refreshPatients(); }

  // Unified Booking State Variables
  selectedPatientId: string = "";
  selectedDoctorId: string = "";
  selectedRoomId: string = "";
  sessionType: SessionType = "Assessment";
  scheduledDate: Date | null = new Date();

  // Treatment Plan State Variables
  bookingMode: "single" | "plan" = "single";
  planSessionCount: number = 1;
  planStartDate: Date | null = new Date();
  planPreferredTime: Date | null = new Date();

  weekDays = [
    { label: "Sat", value: 6 },
    { label: "Sun", value: 0 },
    { label: "Mon", value: 1 },
    { label: "Tue", value: 2 },
    { label: "Wed", value: 3 },
    { label: "Thu", value: 4 },
    { label: "Fri", value: 5 },
  ];
  get localizedWeekDays() {
    return this.weekDays.map((day) => ({
      ...day,
      label: this.locale.label(day.label),
    }));
  }
  selectedDays: number[] = [6, 0, 1, 2, 3, 4]; // Friday (5) excluded by default

  generateBulkDates(): Date[] {
    if (
      !this.planStartDate ||
      !Number.isInteger(this.planSessionCount) ||
      this.planSessionCount <= 0 || this.planSessionCount > 200 || !this.planPreferredTime ||
      !this.selectedDays.some(
        (day) => Number.isInteger(day) && day >= 0 && day <= 6,
      ) ||
      !Number.isFinite(this.planStartDate.getTime())
    )
      return [];

    const dates: Date[] = [];
    const current = new Date(this.planStartDate);
    const preferredTime = this.planPreferredTime;
    if (!preferredTime || !Number.isFinite(preferredTime.getTime())) return [];

    let attempts = 0;
    while (dates.length < this.planSessionCount && attempts++ < this.planSessionCount * 7 + 7) {
      if (!Number.isFinite(current.getTime())) return [];
      if (this.selectedDays.includes(current.getDay())) {
        const d = new Date(current);
        d.setHours(preferredTime.getHours(), preferredTime.getMinutes(), 0, 0);
        dates.push(d);
      }
      current.setDate(current.getDate() + 1);
    }
    return dates.length === this.planSessionCount ? dates : [];
  }

  // Status Filter State for Schedule
  selectedFilter: "All" | "Upcoming" | "In Progress" | "Completed" = "All";
  filterOptions = [
    { label: "All", value: "All" },
    { label: "Upcoming", value: "Upcoming" },
    { label: "In Progress", value: "In Progress" },
    { label: "Completed", value: "Completed" },
  ];

  // Session type options
  get sessionTypeOptions(): { label: string; value: SessionType }[] {
    return this.bookingContext()?.hasCompletedAssessment ? [{ label: 'Session', value: 'Session' }] : [{ label: 'Assessment', value: 'Assessment' }];
  }

  // Quick Add Patient Modal State
  isQuickAddModalOpen = false;
  quickPatient = emptyPatientRegistration();

  showAbsenceModal = false;
  absentDoctorId: string | null = null;
  coveringSeniorId: string | null = null;
  getDoctorGender(id: string | null): string {
    return this.allDoctors().find((d) => d.id === id)?.gender ?? "";
  }
  get coveringSeniors(): Clinician[] {
    return this.allDoctors().filter(
      (d) => d.roles.includes("Senior") && d.id !== this.absentDoctorId,
    );
  }
  onAbsentDoctorChange() {
    this.coveringSeniorId = null;
  }
  confirmAbsence() {
    this.unsupported(
      "ABSENCE_OPERATION_PENDING",
      "Staff absence and automatic reassignment are not available.",
    );
  }
  closeAbsenceModal() {
    this.showAbsenceModal = false;
  }
  // The clinical assessment status enum is unknown; absence of a cached session is not evidence of a new patient.
  get isNewPatient(): boolean {
    return this.bookingContext()?.hasCompletedAssessment === false;
  }
  get selectedPatient(): Patient | undefined {
    return this.allPatients().find((p) => p.id === this.selectedPatientId) ?? this.patientService.patients().find(p => p.id === this.selectedPatientId);
  }
  get isInsurancePending(): boolean {
    const context = this.bookingContext();
    return !!context?.hasCompletedAssessment && context.isInsurance && !context.insuranceApproved;
  }
  get selectedDoctorName(): string {
    return (
      this.allDoctors().find((d) => d.id === this.selectedDoctorId)?.name ?? ""
    );
  }
  get selectedRoomName(): string {
    return (
      this.allRooms().find((r) => r.id === this.selectedRoomId)?.displayName ??
      this.availableRooms().find((r) => r.id === this.selectedRoomId)?.displayName ??
      ""
    );
  }
  get filteredDoctors(): Clinician[] {
    const context = this.bookingContext();
    if (!context) return [];
    const role = context.hasCompletedAssessment ? 'Doctor' : 'Senior';
    return this.allDoctors().filter(d => d.gender === context.gender && d.roles.includes(role));
  }
  get patientPlans() { return this.bookingContext()?.plans ?? []; }
  get chosenPlan() { return this.patientPlans.find(p => p.id === this.selectedPlanId); }
  get isWaivedAssessment(): boolean { return this.isNewPatient && (!!this.bookingContext()?.isInsurance || this.assessmentCharge === 'Free'); }
  setBookingMode(mode: 'single' | 'plan') {
    if (this.bookingBusy() || this.hasUnresolvedBooking) return;
    const next = mode === 'plan' && this.bookingContext()?.hasCompletedAssessment ? 'plan' : 'single';
    if (this.bookingMode === next) return;
    this.bookingMode = next;
    this.preview.set(null);
    this.refreshRoomAvailability();
  }
  async onPatientChange(id?: string | null) {
    if (this.bookingBusy() || this.hasUnresolvedBooking) return;
    if (id !== undefined) this.selectedPatientId = id ?? '';
    const generation = ++this.contextGeneration;
    this.clinicianGeneration++;
    this.patientChanged.next(); this.planChanged.next();
    this.clinicianService.loading.set(false); this.clinicianService.error.set(null);
    this.bookingContext.set(null); this.preview.set(null); this.selectedPlanId = null;
    this.refreshRoomAvailability();
    this.selectedDoctorId = ''; this.selectedRoomId = ''; this.bookingMode = 'single'; this.bookingError.set('');
    this.assessmentCharge = null; this.unitPrice = null; this.packagePrice = null; this.discount = 0; this.deposit = 0; this.paymentMethod = null; this.installments = [];
    this.lastReceipt.set(null);
    this.contextLoading.set(false);
    if (!this.selectedPatientId) return;
    this.contextLoading.set(true);
    try {
      const context = await firstValueFrom(this.bookingApi.context(numericId(this.selectedPatientId)).pipe(takeUntil(this.patientChanged), takeUntilDestroyed(this.destroyRef)));
      if (generation !== this.contextGeneration) return;
      this.bookingContext.set(context);
      this.allPatients.update(patients => patients.map(p => p.id === String(context.patientId)
        ? { ...p, nameEn: context.patientName, nameAr: context.patientName, gender: context.gender, paymentType: context.paymentType, insuranceCompanyName: context.insuranceCompanyName } : p));
      this.sessionType = context.hasCompletedAssessment ? 'Session' : 'Assessment';
      if (context.plans.length === 1) this.selectedPlanId = context.plans[0].id;
      if (context.isInsurance && !context.hasCompletedAssessment) this.assessmentCharge = 'Free';
      this.syncAgreement();
      if (!context.hasCompletedAssessment || this.selectedPlanId != null) {
        this.refreshRoomAvailability();
        await this.loadEligibleClinicians();
      }
    } catch (error) { if (generation === this.contextGeneration) this.bookingError.set(apiError(error)); }
    finally { if (generation === this.contextGeneration) this.contextLoading.set(false); }
  }
  async loadEligibleClinicians() {
    const context = this.bookingContext(); if (!context) return;
    const generation = ++this.clinicianGeneration;
    this.planChanged.next();
    this.clinicianService.loading.set(true); this.clinicianService.error.set(null);
    try {
      const clinicians = await firstValueFrom(this.bookingApi.clinicians(context.patientId, this.selectedPlanId).pipe(takeUntil(this.patientChanged), takeUntil(this.planChanged), takeUntilDestroyed(this.destroyRef)));
      if (generation !== this.clinicianGeneration || context.patientId !== this.bookingContext()?.patientId) return;
      this.clinicianService.clinicians.set(clinicians.map(c => ({ ...c, roles: [c.role] })));
      this.selectedDoctorId = clinicians.find(c => c.preferred)?.id ?? '';
    } catch (error) { if (generation === this.clinicianGeneration) this.clinicianService.error.set(apiError(error)); }
    finally { if (generation === this.clinicianGeneration) this.clinicianService.loading.set(false); }
  }
  onPlanChange() {
    this.clinicianGeneration++; this.planChanged.next();
    this.syncAgreement(); this.selectedDoctorId = '';
    if (this.selectedPlanId != null) { this.refreshRoomAvailability(); void this.loadEligibleClinicians(); }
    else this.clinicianService.loading.set(false);
  }
  onAssessmentChargeChange() {
    this.preview.set(null);
    if (this.isWaivedAssessment) { this.unitPrice = null; this.packagePrice = null; this.discount = 0; this.deposit = 0; this.installments = []; }
  }
  handleWalkInNearestSlot() {
    this.unsupported(
      "AVAILABILITY_OPERATION_PENDING",
      "Automatic slot selection is unavailable. Select a start and end time for server validation.",
    );
  }
  private unsupported(key: string, fallback: string) {
    const detail = this.locale.text(key, fallback);
    this.bookingError.set(detail);
    this.messageService.add({
      severity: "warn",
      summary: this.locale.text("ERROR", "Error"),
      detail,
    });
  }
  private buildBooking(): BookingRequest {
    const context = this.bookingContext();
    if (!context || context.patientId !== Number(this.selectedPatientId) || !this.selectedDoctorId || !this.selectedRoomId)
      throw new ReceptionError('BOOKING_SELECTION_REQUIRED', 'Select a saved patient, eligible clinician and active room.');
    const dates = this.bookingMode === 'plan' ? this.generateBulkDates() : this.scheduledDate ? [this.scheduledDate] : [];
    if (!dates.length || dates.some(d => !Number.isFinite(d.getTime()))) throw new ReceptionError('BOOKING_TIME_REQUIRED', 'Select a valid appointment time.');
    const waived = this.isWaivedAssessment;
    return {
      idempotencyKey: '', patientId: context.patientId, clinicianId: this.selectedDoctorId, roomId: numericId(this.selectedRoomId),
      treatmentPlanId: context.hasCompletedAssessment ? this.selectedPlanId : null, startsAt: dates.map(d => d.toISOString()),
      assessmentCharge: context.hasCompletedAssessment ? null : context.isInsurance ? 'Free' : this.assessmentCharge,
      pricingMode: context.hasCompletedAssessment ? this.pricingMode : 'PerSession', unitPrice: waived ? null : this.unitPrice,
      packagePrice: null, discount: 0, discountType: waived ? 'None' : this.discountType,
      discountValue: waived ? 0 : this.discountType === 'None' ? 0 : this.discountValue, deposit: waived ? 0 : this.deposit,
      paymentMethod: waived ? null : this.paymentMethod,
      installments: waived || !!this.agreement ? [] : this.installments.map(i => ({ dueDate: i.dueDate, amount: i.amount ?? 0 }))
    };
  }
  private bookingErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.error?.title === 'Booking.Validation' && typeof error.error.detail === 'string')
      return error.error.detail.split(',').map((code: string) => this.bookingRuleLabel(code.trim())).join('\n');
    return error instanceof ReceptionError ? this.locale.text(error.key, error.message) : apiError(error);
  }
  get previewIsCurrent(): boolean {
    try { return !!this.preview() && this.previewFingerprint === JSON.stringify(this.buildBooking()); } catch { return false; }
  }
  get canConfirm(): boolean { return this.previewIsCurrent && !!this.preview()?.canSave && !this.bookingBusy() && !this.hasUnresolvedBooking && !this.contextLoading() && !this.roomAvailabilityLoading() && !this.roomAvailabilityError(); }
  async previewBooking() {
    if (this.bookingBusy() || this.hasUnresolvedBooking) return;
    this.bookingBusy.set(true); this.bookingError.set(''); this.preview.set(null);
    try {
      const request = this.buildBooking();
      const preview = await firstValueFrom(this.bookingApi.preview(request));
      this.previewFingerprint = JSON.stringify(request); this.preview.set(preview);
    } catch (error) { this.bookingError.set(error instanceof ReceptionError ? this.locale.text(error.key, error.message) : apiError(error)); }
    finally { this.bookingBusy.set(false); }
  }
  async submitBooking() {
    if (!this.canConfirm) return;
    const request = this.buildBooking(); request.idempotencyKey = this.bookingApi.uncertainKey() ?? crypto.randomUUID(); this.pendingBooking = request;
    await this.sendBooking(request);
  }
  submitTreatmentPlan() { return this.submitBooking(); }
  private async sendBooking(request: BookingRequest) {
    if (this.bookingBusy()) return;
    this.bookingBusy.set(true); this.bookingError.set('');
    try {
      const receipt = await firstValueFrom(this.bookingApi.create(request));
      this.lastReceipt.set(receipt); this.pendingBooking = null; this.preview.set(null); this.recoveryEditing = false;
      this.bookingApi.invalidatePatient(request.patientId); this.deposit = 0;
      this.messageService.add({ severity: 'success', summary: this.locale.text('SUCCESS', 'Success'),
        detail: this.locale.text('BOOKING_COMMITTED', 'Booking and financial records saved. Payments are recorded only for the amount collected.') });
      const context = await firstValueFrom(this.bookingApi.context(request.patientId));
      if (Number(this.selectedPatientId) === request.patientId) { this.bookingContext.set(context); this.syncAgreement(); }
    } catch (error) {
      this.bookingError.set(this.lastReceipt()?.idempotencyKey === request.idempotencyKey
        ? this.locale.text('BOOKING_SAVED_CONTEXT_FAILED', 'Booking saved. Patient information could not refresh; do not book again.')
        : this.bookingApi.uncertainKey() ? this.locale.text('BOOKING_RECONCILE_REQUIRED', 'The booking outcome is unknown. Reconcile it before retrying.')
        : this.bookingErrorMessage(error));
    } finally { this.bookingBusy.set(false); }
  }
  async reconcileBooking() {
    if (this.bookingBusy()) return;
    this.bookingBusy.set(true); this.bookingError.set('');
    try { const receipt = await firstValueFrom(this.bookingApi.reconcile()); this.lastReceipt.set(receipt); this.pendingBooking = null; this.preview.set(null); }
    catch {
      if (!this.pendingBooking) this.recoveryEditing = true;
      this.bookingError.set(this.locale.text('BOOKING_NOT_CONFIRMED', 'No committed booking has been confirmed. Retry the original details with the same key, or reconcile again.'));
    }
    finally { this.bookingBusy.set(false); }
  }
  get canRetryPending(): boolean { return !!this.pendingBooking && !!this.bookingApi.uncertainKey() && !this.bookingBusy(); }
  retryPendingBooking() { if (this.canRetryPending) return this.sendBooking(this.pendingBooking!); return Promise.resolve(); }
  bookingRuleLabel(code: string): string { return this.locale.text('BOOKING_RULE_' + code.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase(), code); }
  resetBookingForm() {
    if (this.bookingBusy() || this.bookingApi.uncertainKey()) return;
    this.contextGeneration++; this.clinicianGeneration++;
    this.patientChanged.next(); this.planChanged.next();
    this.selectedPatientId = ''; this.selectedDoctorId = ''; this.selectedRoomId = ''; this.selectedPlanId = null;
    this.assessmentCharge = null; this.pricingMode = 'PerSession'; this.unitPrice = null; this.packagePrice = null;
    this.discount = 0; this.discountType = 'None'; this.discountValue = 0; this.deposit = 0; this.paymentMethod = null; this.installments = [];
    this.clinicianService.loading.set(false); this.clinicianService.error.set(null);
    this.bookingContext.set(null); this.preview.set(null); this.bookingMode = 'single'; this.bookingError.set(''); this.lastReceipt.set(null);
    this.refreshRoomAvailability();
    this.contextLoading.set(false);
  }
  openQuickAddModal() {
    if (this.registeringPatient()) return;
    this.quickPatient = emptyPatientRegistration();
    this.quickRegistrationError.set("");
    this.quickRegistrationValidationErrors.set([]);
    this.isQuickAddModalOpen = true;
  }

  closeQuickAddModal() {
    if (!this.registeringPatient()) this.isQuickAddModalOpen = false;
  }

  refreshPatients(afterSave = false) {
    this.directoryLoading.set(true); this.directoryError.set('');
    this.bookingApi.directory().subscribe({
      next: patients => {
        const context = this.bookingContext();
        this.allPatients.set(patients.map(patient => context?.patientId === Number(patient.id)
          ? { ...patient, paymentType: context.paymentType, gender: context.gender, insuranceCompanyName: context.insuranceCompanyName } : patient));
        this.directoryLoading.set(false);
      },
      error: error =>
      { this.directoryLoading.set(false); this.directoryError.set(apiError(error)); this.messageService.add({
          severity: "warn",
          summary: this.locale.text("ERROR", "Error"),
          detail: this.locale.text(
            afterSave ? "PATIENT_SAVED_REFRESH_FAILED" : "PATIENT_LIST_FAILED",
            afterSave
              ? "Patient saved. The list could not refresh; do not register again."
              : "Could not load patients. Please retry.",
          ),
        }); },
    });
  }

  async saveQuickPatient() {
    if (
      this.registeringPatient() ||
      this.patientService.creationOutcomeUnknown()
    )
      return;
    this.registeringPatient.set(true);
    this.quickRegistrationError.set("");
    this.quickRegistrationValidationErrors.set([]);
    let patient: Patient;
    try {
      patient = await firstValueFrom(
        this.patientService.addPatient(this.quickPatient),
      );
    } catch (error) {
      const detail = patientOutcomeIsUnknown(error)
        ? this.locale.text(
            "PATIENT_OUTCOME_UNKNOWN",
            "The patient may have been saved. Check the patient list before registering again.",
          )
        : error instanceof PatientValidationError
          ? error.errors.map(item => this.locale.text(item.key, item.message)).join("\n")
        : error instanceof PatientInputError
          ? this.locale.text(error.key, error.message)
          : patientServerError(error) ||
            this.locale.text(
              "COULD_NOT_REGISTER_NEW_PATIENT_",
              "Could not register new patient.",
            );
      this.quickRegistrationError.set(detail);
      this.quickRegistrationValidationErrors.set(error instanceof PatientValidationError ? error.errors : error instanceof PatientInputError ? [error] : []);
      this.registrationFields?.focusFirstInvalid();
      this.messageService.add({
        severity: "error",
        summary: this.locale.text("REGISTRATION_FAILED", "Registration Failed"),
        detail,
      });
      this.registeringPatient.set(false);
      return;
    }
    this.registeringPatient.set(false);
    // addPatient caches the normalized response before selection; refresh is independent.
    this.selectedPatientId = patient.id;
    this.allPatients.update(patients => [patient, ...patients.filter(p => p.id !== patient.id)]);
    this.onPatientChange(patient.id);
    this.closeQuickAddModal();
    this.messageService.add({
      severity: "success",
      summary: this.locale.text("PATIENT_REGISTERED", "Patient Registered"),
      detail: this.locale.text(
        "NEW_PATIENT_CREATED_AND_SELECTED_",
        "New patient created and selected.",
      ),
    });
    this.refreshPatients(true);
  }

  timeSlots = [
    "08:00 AM",
    "09:00 AM",
    "10:00 AM",
    "11:00 AM",
    "12:00 PM",
    "01:00 PM",
    "02:00 PM",
    "03:00 PM",
  ];
  todayDate = new Date();
  formatTime(value?: string) {
    return value
      ? new Date(value).toLocaleTimeString(this.locale.language, {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "?";
  }
  get todaySessions() {
    return this.appointments().filter(
      (a) => localDay(a.startTime) === localDay(this.todayDate),
    );
  }
  get filteredSchedule() {
    return this.timeSlots.map((time) => ({
      time,
      sessions: this.todaySessions.filter(
        (a) =>
          new Date(a.startTime).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }) === time,
      ),
    }));
  }
  calendarGrid = computed(() => this.filteredSchedule);
  getSessionBadge(appointment: Appointment): string {
    return "";
  }
  getStatusClass(status: string | number) {
    return (
      "status-" +
      this.contracts
        .label("appointmentStatus", status)
        .toLowerCase()
        .replace(/ /g, "-")
    );
  }
  async checkInSession(id: number | undefined) {
    if (id !== undefined) await this.runTransition(id, "In Progress");
  }
  async executeCheckIn(id: number) {
    await this.runTransition(id, "In Progress");
  }
  async checkoutSession(id: number | undefined) {
    if (id !== undefined) await this.runTransition(id, "Completed");
  }
  async checkOutPatient(id: number) {
    await this.runTransition(id, "Completed");
  }
  async markPatientAbsent(id: number | undefined) {
    if (id === undefined) return;
    try {
      await firstValueFrom(this.workflow.cancel(id));
      this.appointmentService.getAppointments();
    } catch (error) {
      this.bookingError.set(apiError(error));
    }
  }
  private async runTransition(id: number, status: "In Progress" | "Completed") {
    try {
      await firstValueFrom(this.workflow.transition(id, status));
      this.appointmentService.getAppointments();
    } catch (error) {
      this.bookingError.set(
        error instanceof ReceptionError
          ? this.locale.text(error.key, error.message)
          : apiError(error),
      );
    }
  }
}
