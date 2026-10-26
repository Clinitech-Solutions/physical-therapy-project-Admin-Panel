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
import { Component, signal, computed, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { TranslateModule } from "@ngx-translate/core";
import { FormsModule } from "@angular/forms";
import { firstValueFrom } from "rxjs";
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
  styleUrls: ["./bookings.css"],
})
export class BookingsComponent implements OnInit {
  readonly locale = new ReceptionistLocale();
  clinical = inject(ClinicalRecordsService);
  workflow = inject(AppointmentWorkflowService);
  contracts = inject(ReceptionContracts);
  readonly bookingBusy = signal(false);
  readonly bookingError = signal("");
  scheduledEndDate: Date | null = null;
  planEndTime: Date | null = null;
  selectedPlanId: number | null = null;
  readonly bulkProgress = signal<number[]>([]);
  private bulkBatch:
    | {
        sessionId: number;
        payload: import("../../../core/services/appointment.service").AddAppointmentPayload;
      }[]
    | null = null;
  messageService = inject(MessageService);
  appointmentService = inject(AppointmentService, { optional: true })!;
  patientService = inject(PatientService);
  insuranceService = inject(InsuranceService);
  readonly registeringPatient = signal(false);
  readonly quickRegistrationError = signal("");
  billingService =
    inject(BillingService, { optional: true }) ?? new BillingService();

  viewMode = signal<"Week" | "Day">("Day");
  isLoading = computed(
    () => this.bookingBusy() || !!this.appointmentService?.loading(),
  );

  // Global State Signals
  appointments =
    this.appointmentService?.appointments ?? signal<Appointment[]>([]);
  allPatients = this.patientService.patients;
  roomService = inject(RoomService);
  clinicianService = inject(ClinicianService);
  allDoctors = this.clinicianService.clinicians;
  allRooms = computed(() =>
    this.roomService
      .rooms()
      .map((r) => ({ ...r, id: String(r.id), displayName: r.name })),
  );
  availableRooms = computed(() => this.allRooms().filter((r) => r.isActive));

  // Patient Profile Modal
  selectedProfilePatientId = signal<string | null>(null);
  showProfileModal = signal<boolean>(false);

  openPatientProfile(patientId: string | number) {
    this.selectedProfilePatientId.set(patientId.toString());
    this.showProfileModal.set(true);
  }

  ngOnInit() {
    this.appointmentService?.getAppointments();
    this.roomService.load();
    this.clinicianService.load();
    this.refreshPatients();
    this.insuranceService.getCompanies();
    this.billingService.getInvoices();
  }

  // Unified Booking State Variables
  selectedPatientId: string = "";
  selectedDoctorId: string = "";
  selectedRoomId: string = "";
  sessionType: SessionType = "Assessment";
  scheduledDate: Date | null = new Date();

  // Treatment Plan State Variables
  bookingMode: "single" | "plan" = "single";
  planSessionCount: number = 10;
  planStartDate: Date | null = new Date();
  planPreferredTime: Date | null = new Date();

  weekDays = [
    { label: "Sat", value: 6 },
    { label: "Sun", value: 0 },
    { label: "Mon", value: 1 },
    { label: "Tue", value: 2 },
    { label: "Wed", value: 3 },
    { label: "Thu", value: 4 },
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
      this.planSessionCount <= 0 ||
      !this.selectedDays.some(
        (day) => Number.isInteger(day) && day >= 0 && day <= 6,
      ) ||
      !Number.isFinite(this.planStartDate.getTime())
    )
      return [];

    const dates: Date[] = [];
    const current = new Date(this.planStartDate);
    const preferredTime = this.planPreferredTime || new Date();

    while (dates.length < this.planSessionCount) {
      if (this.selectedDays.includes(current.getDay())) {
        const d = new Date(current);
        d.setHours(preferredTime.getHours(), preferredTime.getMinutes(), 0, 0);
        dates.push(d);
      }
      current.setDate(current.getDate() + 1);
    }
    return dates;
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
  sessionTypeOptions: { label: string; value: SessionType }[] = [
    { label: "Assessment", value: "Assessment" },
    { label: "Session", value: "Session" },
  ];

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
    return false;
  }
  get selectedPatient(): Patient | undefined {
    return this.allPatients().find((p) => p.id === this.selectedPatientId);
  }
  get isInsurancePending(): boolean {
    return false;
  } // Registration insurance status does not establish appointment eligibility.
  get selectedDoctorName(): string {
    return (
      this.allDoctors().find((d) => d.id === this.selectedDoctorId)?.name ?? ""
    );
  }
  get selectedRoomName(): string {
    return (
      this.allRooms().find((r) => r.id === this.selectedRoomId)?.displayName ??
      ""
    );
  }
  get filteredDoctors(): Clinician[] {
    return this.selectedPatient ? this.allDoctors() : [];
  }
  get patientPlans() {
    return this.selectedPatientId
      ? this.clinical.plansForPatient(Number(this.selectedPatientId))
      : [];
  }
  onPatientChange(id?: string) {
    if (id !== undefined) this.selectedPatientId = id;
    this.selectedPlanId = null;
    this.bulkProgress.set([]);
    this.bulkBatch = null;
    if (this.selectedPatientId)
      this.clinical.load(numericId(this.selectedPatientId));
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
  private bookingPayload(
    start: Date,
    end: Date,
    treatmentPlanSessionId?: number,
  ) {
    if (
      !this.selectedPatient ||
      !this.selectedDoctorId ||
      !this.availableRooms().some((r) => r.id === this.selectedRoomId)
    ) {
      throw new ReceptionError(
        "BOOKING_SELECTION_REQUIRED",
        "Select a saved patient, clinician and active room record.",
      );
    }
    const clinician = this.allDoctors().find(
      (d) => d.id === this.selectedDoctorId,
    );
    if (!clinician)
      throw new ReceptionError(
        "CLINICIAN_REQUIRED",
        "Select a clinician from the server directory.",
      );
    return {
      patientId: numericId(this.selectedPatientId),
      doctorId: clinician.roles.includes("Doctor") ? clinician.id : null,
      seniorId: clinician.roles.includes("Doctor") ? null : clinician.id,
      roomId: numericId(this.selectedRoomId),
      appointmentType: treatmentPlanSessionId ? "Session" : this.sessionType,
      startTime: start,
      endTime: end,
      treatmentPlanSessionId: treatmentPlanSessionId ?? null,
    };
  }
  async submitBooking() {
    if (this.bookingBusy()) return;
    this.bookingError.set("");
    this.bookingBusy.set(true);
    try {
      if (!this.scheduledDate || !this.scheduledEndDate)
        throw new ReceptionError(
          "BOOKING_TIME_REQUIRED",
          "Select both start and end times.",
        );
      await firstValueFrom(
        this.appointmentService.addAppointment(
          this.bookingPayload(this.scheduledDate, this.scheduledEndDate),
        ),
      );
    } catch (error) {
      this.bookingError.set(
        error instanceof ReceptionError
          ? this.locale.text(error.key, error.message)
          : apiError(error),
      );
      this.bookingBusy.set(false);
      return;
    }
    this.bookingBusy.set(false);
    this.messageService.add({
      severity: "success",
      summary: this.locale.text("SUCCESS", "Success"),
      detail: this.locale.text(
        "BOOKING_SAVED_CHECK_BILLING",
        "Booking saved. Refresh invoices to verify billing separately.",
      ),
    });
    this.resetBookingForm();
    this.appointmentService.getAppointments();
    this.billingService.getInvoices();
  }
  async submitTreatmentPlan() {
    if (this.bookingBusy()) return;
    this.bookingBusy.set(true);
    this.bookingError.set("");
    let saved = 0;
    try {
      const plan = this.patientPlans.find(
        (p) => Number(p.id) === Number(this.selectedPlanId),
      );
      if (
        !plan ||
        plan.doctorId !== this.selectedDoctorId ||
        !this.planPreferredTime ||
        !this.planEndTime
      ) {
        throw new ReceptionError(
          "EXISTING_PLAN_REQUIRED",
          "Select a saved treatment plan for this patient, its clinician and an end time.",
        );
      }
      if (!this.bulkBatch) {
        const slots = this.clinical
          .sessions()
          .filter(
            (s) =>
              Number(s.treatmentPlanId) === Number(plan.id) &&
              s.sessionDate == null,
          )
          .filter(
            (s) =>
              !this.appointmentService
                .bookedPlanSessions()
                .includes(Number(s.id)),
          )
          .filter(
            (s) =>
              !this.appointments().some(
                (a) => Number(a.treatmentPlanSessionId) === Number(s.id),
              ),
          )
          .sort((a, b) => a.sessionNumber - b.sessionNumber);
        const dates = this.generateBulkDates();
        if (!dates.length || dates.length > slots.length)
          throw new ReceptionError(
            "PLAN_SESSIONS_REQUIRED",
            "The saved plan has fewer unscheduled session records than requested.",
          );
        this.bulkBatch = dates.map((start, index) => {
          const end = new Date(start);
          end.setHours(
            this.planEndTime!.getHours(),
            this.planEndTime!.getMinutes(),
            0,
            0,
          );
          return {
            sessionId: numericId(slots[index].id),
            payload: this.bookingPayload(
              start,
              end,
              numericId(slots[index].id),
            ),
          };
        });
        // Validate every interval before creating the first record.
        if (
          this.bulkBatch.some(
            (item) =>
              new Date(item.payload.endTime) <=
              new Date(item.payload.startTime),
          )
        ) {
          this.bulkBatch = null;
          throw new ReceptionError(
            "BOOKING_TIME_INVALID",
            "End time must be after a valid start time.",
          );
        }
      }
      for (const item of this.bulkBatch) {
        if (this.bulkProgress().includes(item.sessionId)) continue;
        await firstValueFrom(
          this.appointmentService.addAppointment(item.payload),
        );
        this.bulkProgress.update((ids) => [...ids, item.sessionId]);
        saved++;
      }
    } catch (error) {
      this.bookingError.set(
        this.locale.text(
          "BULK_PARTIAL_RESULT",
          "{{count}} appointment(s) saved before stopping. Completed sessions will not be submitted again.",
          { count: this.bulkProgress().length },
        ) +
          " " +
          (error instanceof ReceptionError
            ? this.locale.text(error.key, error.message)
            : apiError(error)),
      );
      this.bookingBusy.set(false);
      // Preserve the batch and its session IDs. Refresh only after the batch is finished or reconciled.
      return;
    }
    this.bookingBusy.set(false);
    this.messageService.add({
      severity: "success",
      summary: this.locale.text("SUCCESS", "Success"),
      detail: this.locale.text(
        "BULK_BOOKINGS_SAVED",
        "{{count}} appointment(s) saved.",
        { count: saved },
      ),
    });
    this.resetBookingForm();
    this.appointmentService.getAppointments();
    this.billingService.getInvoices();
  }
  resetBookingForm() {
    if (this.bookingBusy()) return;
    this.selectedPatientId = "";
    this.selectedDoctorId = "";
    this.selectedRoomId = "";
    this.scheduledDate = new Date();
    this.scheduledEndDate = null;
    this.selectedPlanId = null;
    this.bulkProgress.set([]);
    this.bulkBatch = null;
    this.bookingMode = "single";
  }
  openQuickAddModal() {
    if (this.registeringPatient()) return;
    this.quickPatient = emptyPatientRegistration();
    this.quickRegistrationError.set("");
    this.isQuickAddModalOpen = true;
  }

  closeQuickAddModal() {
    if (!this.registeringPatient()) this.isQuickAddModalOpen = false;
  }

  refreshPatients(afterSave = false) {
    this.patientService.getPatients().subscribe({
      error: () =>
        this.messageService.add({
          severity: "warn",
          summary: this.locale.text("ERROR", "Error"),
          detail: this.locale.text(
            afterSave ? "PATIENT_SAVED_REFRESH_FAILED" : "PATIENT_LIST_FAILED",
            afterSave
              ? "Patient saved. The list could not refresh; do not register again."
              : "Could not load patients. Please retry.",
          ),
        }),
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
        : error instanceof PatientInputError
          ? this.locale.text(error.key, error.message)
          : patientServerError(error) ||
            this.locale.text(
              "COULD_NOT_REGISTER_NEW_PATIENT_",
              "Could not register new patient.",
            );
      this.quickRegistrationError.set(detail);
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
