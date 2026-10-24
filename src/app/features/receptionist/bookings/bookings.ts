import { ReceptionistLocale, ReceptionistTextPipe } from '../../../shared/receptionist-locale';
import { Component, signal, computed, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { MessageService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { InputNumberModule } from 'primeng/inputnumber';
import { MultiSelectModule } from 'primeng/multiselect';
import { Session, SessionType } from '../../../core/models/session.model';
import { Doctor } from '../../../core/models/doctor.model';
import { Patient } from '../../../core/models/patient.model';
import { PatientProfileComponent } from '../../../shared/components/patient-profile/patient-profile.component';
import { AppointmentService, Appointment } from '../../../core/services/appointment.service';
import { PatientService } from '../../../core/services/patient.service';
import { BillingService, CreateInvoiceDto } from '../../../core/services/billing.service';

@Component({
  selector: "app-receptionist-bookings",
  standalone: true,
  imports: [ReceptionistTextPipe,
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
    PatientProfileComponent
  ],
  templateUrl: "./bookings.html",
  styleUrls: ["./bookings.css"]
})
export class BookingsComponent implements OnInit {
  readonly locale = new ReceptionistLocale();
  clinicState = inject(ClinicStateService);
  messageService = inject(MessageService);
  appointmentService = inject(AppointmentService, { optional: true })!;
  patientService = inject(PatientService, { optional: true })!;
  billingService = inject(BillingService, { optional: true }) ?? new BillingService();

  viewMode = signal<'Week' | 'Day'>('Day');
  isLoading = this.appointmentService?.loading ?? this.clinicState.isLoading;

  // Global State Signals
  appointments = this.appointmentService?.appointments ?? signal<Appointment[]>([]);
  allPatients = this.patientService?.patients ?? this.clinicState.patients;
  allDoctors = this.clinicState.doctors;
  allRooms = this.clinicState.rooms;
  availableRooms = this.clinicState.availableRooms;

  // Patient Profile Modal
  selectedProfilePatientId = signal<string | null>(null);
  showProfileModal = signal<boolean>(false);

  openPatientProfile(patientId: string | number) {
    this.selectedProfilePatientId.set(patientId.toString());
    this.showProfileModal.set(true);
  }

  ngOnInit() {
    this.appointmentService?.getAppointments();
    this.patientService?.getPatients().subscribe();
    this.billingService.getInvoices();
  }

  // Unified Booking State Variables
  selectedPatientId: string = '';
  selectedDoctorId: string = '';
  selectedRoomId: string = '';
  sessionType: SessionType = 'Assessment';
  scheduledDate: Date | null = new Date();
  isFreeAssessment: boolean = false;
  assessmentPrice: number | null = null;
  
  // Treatment Plan State Variables
  bookingMode: 'single' | 'plan' = 'single';
  planSessionCount: number = 10;
  planStartDate: Date | null = new Date();
  planPreferredTime: Date | null = new Date();
  planPaymentMode: 'Package' | 'Per-Session' = 'Per-Session';
  packageTotalPrice: number | null = null;
  packagePayingNow: number | null = null;
  packageDiscount: number | null = null;
  
  weekDays = [
    { label: 'Sat', value: 6 },
    { label: 'Sun', value: 0 },
    { label: 'Mon', value: 1 },
    { label: 'Tue', value: 2 },
    { label: 'Wed', value: 3 },
    { label: 'Thu', value: 4 }
  ];
  get localizedWeekDays() { return this.weekDays.map(day => ({ ...day, label: this.locale.label(day.label) })); }
  selectedDays: number[] = [6, 0, 1, 2, 3, 4]; // Friday (5) excluded by default

  get calculatedInsuranceShare(): { patientShare: number, insuranceShare: number } {
    if (this.selectedPatient?.paymentType === 'Insurance' && this.selectedPatient?.insuranceDetails?.copayPercentage != null) {
      const totalAmount = this.bookingMode === 'single' ? (this.assessmentPrice || 0) : (this.packageTotalPrice || 0);
      const copay = this.selectedPatient.insuranceDetails.copayPercentage;
      const patientShare = Math.round(totalAmount * (copay / 100));
      return {
        patientShare,
        insuranceShare: totalAmount - patientShare
      };
    }
    return {
      patientShare: this.bookingMode === 'single' ? (this.assessmentPrice || 0) : (this.packageTotalPrice || 0),
      insuranceShare: 0
    };
  }

  get packageRemainingDebt(): number {
    const total = this.packageTotalPrice || 0;
    const discount = this.packageDiscount || 0;
    const paid = this.packagePayingNow || 0;
    return Math.max(0, (total - discount) - paid);
  }

  generateBulkDates(): Date[] {
    if (!this.planStartDate || this.planSessionCount <= 0 || this.selectedDays.length === 0) return [];
    
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
  selectedFilter: 'All' | 'Upcoming' | 'In Progress' | 'Completed' = 'All';
  filterOptions = [
    { label: 'All', value: 'All' },
    { label: 'Upcoming', value: 'Upcoming' },
    { label: 'In Progress', value: 'In Progress' },
    { label: 'Completed', value: 'Completed' }
  ];

  // Session type options
  sessionTypeOptions: { label: string; value: SessionType }[] = [
    { label: 'Assessment', value: 'Assessment' },
    { label: 'Session', value: 'Session' }
  ];

  // Quick Add Patient Modal State
  isQuickAddModalOpen = false;
  quickPatient = {
    nameEn: '',
    nameAr: '',
    phone: '',
    gender: 'Male' as 'Male' | 'Female',
    paymentType: 'Cash' as 'Cash' | 'Online' | 'Insurance'
  };

  // Doctor Absence Reporting State
  showAbsenceModal = false;
  absentDoctorId: string | null = null;
  coveringSeniorId: string | null = null;

  getDoctorGender(doctorId: string | null): string {
    return this.clinicState.getDoctorGender(doctorId);
  }

  /**
   * Covering Senior options:
   * Strictly filtered to doctors with the SAME GENDER as the selected absent doctor,
   * excluding the absent doctor themselves.
   */
  get coveringSeniors(): Doctor[] {
    if (!this.absentDoctorId) {
      return [];
    }
    const absentGender = this.getDoctorGender(this.absentDoctorId);
    if (!absentGender) {
      return [];
    }
    return this.allDoctors().filter(
      doc => doc.id !== this.absentDoctorId && doc.gender === absentGender
    );
  }

  onAbsentDoctorChange() {
    if (this.coveringSeniorId) {
      const isValid = this.coveringSeniors.some(d => d.id === this.coveringSeniorId);
      if (!isValid) {
        this.coveringSeniorId = null;
      }
    }
  }

  confirmAbsence() {
    if (!this.absentDoctorId || !this.coveringSeniorId) {
      this.messageService.add({
        severity: 'warn',
        summary: this.locale.text('INCOMPLETE_SELECTION', "Incomplete Selection"),
        detail: this.locale.text('PLEASE_SELECT_BOTH_AN_ABSENT_DOCTOR_AND_A_COVERING_SENIOR_DOCTOR_', "Please select both an absent doctor and a covering senior doctor.")
      });
      return;
    }

    try {
      this.clinicState.handleDoctorAbsence(this.absentDoctorId, this.coveringSeniorId);
      this.messageService.add({
        severity: 'success',
        summary: this.locale.text('ABSENCE_RECORDED', "Absence Recorded"),
        detail: this.locale.text('ABSENCE_RECORDED_50_OF_SESSIONS_REASSIGNED_TO_SENIOR_REMAINDER_DISTRIBUTED_TO_AVAILABLE_DOCTORS_', "Absence recorded. 50% of sessions reassigned to Senior, remainder distributed to available doctors.")
      });
      this.closeAbsenceModal();
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.locale.text('ABSENCE_ERROR', "Absence Error"),
        detail: this.locale.error(error, 'FAILED_TO_RECORD_DOCTOR_ABSENCE_', "Failed to record doctor absence.")
      });
    }
  }

  closeAbsenceModal() {
    this.showAbsenceModal = false;
    this.absentDoctorId = null;
    this.coveringSeniorId = null;
  }

  // Assessment First check
  get isNewPatient(): boolean {
    return this.selectedPatientId ? this.clinicState.isPatientNew(this.selectedPatientId) : false;
  }

  get selectedPatient(): Patient | undefined {
    return (
      this.allPatients().find((p) => p.id === this.selectedPatientId) ||
      this.clinicState.getPatientById(this.selectedPatientId)
    );
  }

  get isInsurancePending(): boolean {
    return this.selectedPatient?.paymentType === 'Insurance' && this.selectedPatient?.insuranceDetails?.status !== 'Approved';
  }

  get selectedDoctorName(): string {
    if (!this.selectedDoctorId) return '';
    return this.allDoctors().find((d) => d.id === this.selectedDoctorId)?.name || this.clinicState.getDoctorName(this.selectedDoctorId);
  }

  get selectedRoomName(): string {
    if (!this.selectedRoomId) return '';
    return this.allRooms().find((r) => r.id === this.selectedRoomId)?.displayName || this.clinicState.getRoomName(this.selectedRoomId);
  }

  /**
   * Strict Gender Matching Rule:
   * Male doctors treat male patients, female doctors treat female patients.
   */
  get filteredDoctors(): Doctor[] {
    if (!this.selectedPatientId) {
      return [];
    }
    const patientGender =
      this.selectedPatient?.gender ||
      this.clinicState.getPatientGender(this.selectedPatientId);
    if (!patientGender) {
      return [];
    }
    return this.allDoctors().filter(doc => doc.gender === patientGender);
  }

  onPatientChange(patientId?: string) {
    if (patientId !== undefined) {
      this.selectedPatientId = patientId;
    }

    if (this.isNewPatient) {
      this.sessionType = 'Assessment';
    }

    // Auto-patch assigned doctor if patient has one
    const patient = this.selectedPatient;
    if (patient?.assignedDoctorId) {
      const isAssignedDocValid = this.filteredDoctors.some(d => d.id === patient.assignedDoctorId);
      if (isAssignedDocValid) {
        this.selectedDoctorId = patient.assignedDoctorId;
      } else {
        this.selectedDoctorId = '';
      }
    } else if (this.selectedDoctorId) {
      const isDocValid = this.filteredDoctors.some(d => d.id === this.selectedDoctorId);
      if (!isDocValid) {
        this.selectedDoctorId = '';
      }
    }
  }

  handleWalkInNearestSlot() {
    if (!this.selectedPatientId) {
      this.messageService.add({
        severity: 'warn',
        summary: this.locale.text('SELECT_PATIENT', "Select Patient"),
        detail: this.locale.text('PLEASE_SELECT_OR_ADD_A_PATIENT_FIRST_TO_FIND_THE_NEAREST_WALK_IN_SLOT_', "Please select or add a patient first to find the nearest walk-in slot.")
      });
      return;
    }

    if (this.isInsurancePending) {
      this.messageService.add({
        severity: 'error',
        summary: this.locale.text('INSURANCE_PENDING', "Insurance Pending"),
        detail: this.locale.text('INSURANCE_APPROVAL_IS_PENDING_CANNOT_BOOK_SESSIONS_', "Insurance approval is pending. Cannot book sessions.")
      });
      return;
    }

    const eligibleDoctors = this.filteredDoctors;
    if (!eligibleDoctors || eligibleDoctors.length === 0) {
      const patientGender = this.selectedPatient?.gender || this.clinicState.getPatientGender(this.selectedPatientId);
      this.messageService.add({
        severity: 'error',
        summary: this.locale.text('NO_MATCHING_DOCTORS', "No Matching Doctors"),
        detail: this.locale.text('NO_GENDER_MATCH', "No available doctors matching the patient’s gender were found.")
      });
      return;
    }

    try {
      const slot = this.clinicState.findNearestSlot(this.selectedPatientId, eligibleDoctors);
      this.selectedDoctorId = slot.doctorId;
      this.selectedRoomId = slot.roomId;
      this.scheduledDate = new Date(slot.scheduledAt);

      if (this.isNewPatient) {
        this.sessionType = 'Assessment';
      }

      this.messageService.add({
        severity: 'success',
        summary: this.locale.text('WALK_IN_SLOT_FOUND', "Walk-In Slot Found"),
        detail: this.locale.text('SLOT_ASSIGNED', "Assigned {{doctor}} in {{room}} at {{time}}.", { doctor: this.clinicState.getDoctorName(slot.doctorId), room: this.clinicState.getRoomName(slot.roomId), time: this.formatTime(slot.scheduledAt) })
      });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.locale.text('SLOT_SEARCH_FAILED', "Slot Search Failed"),
        detail: this.locale.error(error, 'NO_SUITABLE_SLOT_FOUND_MATCHING_GENDER_AND_LOAD_CRITERIA_', "No suitable slot found matching gender and load criteria.")
      });
    }
  }

  async submitBooking() {
    if (!this.selectedPatientId) {
      this.messageService.add({ severity: 'error', summary: this.locale.text('VALIDATION_ERROR', "Validation Error"), detail: this.locale.text('PLEASE_SELECT_A_PATIENT_', "Please select a patient.") });
      return;
    }
    if (this.isInsurancePending) {
      this.messageService.add({
        severity: 'error',
        summary: this.locale.text('INSURANCE_PENDING', "Insurance Pending"),
        detail: this.locale.text('INSURANCE_APPROVAL_IS_PENDING_CANNOT_BOOK_SESSIONS_', "Insurance approval is pending. Cannot book sessions.")
      });
      return;
    }
    if (!this.selectedDoctorId) {
      this.messageService.add({ severity: 'error', summary: this.locale.text('VALIDATION_ERROR', "Validation Error"), detail: this.locale.text('PLEASE_SELECT_A_DOCTOR_', "Please select a doctor.") });
      return;
    }
    if (!this.selectedRoomId) {
      this.messageService.add({ severity: 'error', summary: this.locale.text('VALIDATION_ERROR', "Validation Error"), detail: this.locale.text('PLEASE_SELECT_AN_AVAILABLE_ROOM_', "Please select an available room.") });
      return;
    }
    if (!this.scheduledDate) {
      this.messageService.add({ severity: 'error', summary: this.locale.text('VALIDATION_ERROR', "Validation Error"), detail: this.locale.text('PLEASE_SELECT_DATE_AND_TIME_', "Please select date and time.") });
      return;
    }

    const isDocGenderValid = this.filteredDoctors.some(d => d.id === this.selectedDoctorId);
    if (!isDocGenderValid) {
      const patientGender = this.selectedPatient?.gender || this.clinicState.getPatientGender(this.selectedPatientId);
      this.messageService.add({
        severity: 'error',
        summary: this.locale.text('GENDER_MISMATCH', "Gender Mismatch"),
        detail: this.locale.text('GENDER_POLICY', "Please select a doctor of the same gender as the patient.")
      });
      return;
    }

    const finalType: SessionType = this.isNewPatient ? 'Assessment' : this.sessionType;

    if (finalType === 'Assessment' && !this.isFreeAssessment && this.assessmentPrice == null) {
      this.messageService.add({ severity: 'error', summary: this.locale.text('VALIDATION_ERROR', "Validation Error"), detail: this.locale.text('PLEASE_ENTER_THE_ASSESSMENT_PRICE_', "Please enter the Assessment Price.") });
      return;
    }

    const dateObj = this.scheduledDate instanceof Date ? this.scheduledDate : new Date(this.scheduledDate);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const scheduledIso = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}T${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:00`;

    const shares = this.calculatedInsuranceShare;
    const patient = this.selectedPatient;
    const financialPlan = patient?.financialPlan || patient?.treatmentPlan?.financialPlan;

    let totalAmount = 500;
    let insuranceAmount = 0;
    let patientAmount = 500;

    if (finalType === 'Assessment') {
      if (this.isFreeAssessment) {
        totalAmount = 0;
        insuranceAmount = 0;
        patientAmount = 0;
      } else {
        totalAmount = this.assessmentPrice || 0;
        insuranceAmount = shares.insuranceShare;
        patientAmount = shares.patientShare;
      }
    } else if (financialPlan) {
      if (financialPlan.paymentMode === 'Package' || financialPlan.paymentMode === 'Upfront-Copay') {
        totalAmount = 0;
        insuranceAmount = 0;
        patientAmount = 0;
      } else if (financialPlan.paymentMode === 'Per-Session') {
        totalAmount = financialPlan.sessionPrice || 500;
        patientAmount = totalAmount;
        insuranceAmount = 0;
      }
    } else if (patient?.paymentType === 'Insurance' && patient.insuranceDetails?.copayPercentage != null) {
      const copay = patient.insuranceDetails.copayPercentage;
      patientAmount = Math.round(totalAmount * (copay / 100));
      insuranceAmount = totalAmount - patientAmount;
    }

    try {
      let appointmentId = 0;

      if (this.appointmentService) {
        const createdAppointment = await new Promise<any>((resolve, reject) => {
          this.appointmentService.addAppointment({
            patientId: Number(this.selectedPatientId),
            doctorId: Number(this.selectedDoctorId),
            roomId: Number(this.selectedRoomId),
            appointmentType: finalType,
            startTime: scheduledIso,
            endTime: scheduledIso
          }).subscribe({
            next: (res) => resolve(res),
            error: (err) => reject(err)
          });
        });

        appointmentId = Number(
          createdAppointment?.id ??
            createdAppointment?.value?.id ??
            createdAppointment?.data?.id ??
            0
        );
      }

      // Construct exact CreateInvoiceDto expected by /api/Billing/invoices
      const invoiceDto: CreateInvoiceDto = {
        appointmentId,
        patientId: Number(this.selectedPatientId),
        type: this.billingService.mapTypeToNumber(finalType),
        totalAmount,
        insuranceAmount,
        patientAmount
      };

      this.billingService.createInvoice(invoiceDto).subscribe({
        next: (createdInv) => {
          if (createdInv?.id && (this.isFreeAssessment || patientAmount === 0)) {
            const targetStatus = this.billingService.mapStatusToNumber(
              this.isFreeAssessment ? 'Waived' : 'Paid'
            );
            this.billingService
              .updateInvoiceStatus(createdInv.id, targetStatus)
              .subscribe();
          }
        },
        error: () => {}
      });

      const patientDisplayName =
        this.locale.patientName(this.selectedPatient) ||
        this.clinicState.getPatientName(this.selectedPatientId);

      this.messageService.add({
        severity: 'success',
        summary: this.locale.text('BOOKING_SUCCESSFUL', "Booking Successful"),
        detail: this.locale.text('BOOKING_CREATED', "{{type}} booked for {{patient}} with {{doctor}}.", { type: this.locale.label(finalType), patient: patientDisplayName, doctor: this.clinicState.getDoctorName(this.selectedDoctorId) })
      });

      this.resetBookingForm();
    } catch (e: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.locale.text('BOOKING_FAILED', "Booking Failed"),
        detail: this.locale.error(e, 'ROOM_IS_NOT_AVAILABLE_FOR_BOOKING_', "Room is not available for booking.")
      });
    }
  }

  async submitTreatmentPlan() {
    if (!this.selectedPatientId || !this.selectedDoctorId || !this.selectedRoomId) {
      this.messageService.add({ severity: 'error', summary: this.locale.text('VALIDATION_ERROR', "Validation Error"), detail: this.locale.text('PLEASE_SELECT_PATIENT_DOCTOR_AND_ROOM_', "Please select patient, doctor, and room.") });
      return;
    }
    if (this.planPaymentMode === 'Package' && (this.packageTotalPrice == null || this.packagePayingNow == null)) {
      this.messageService.add({ severity: 'error', summary: this.locale.text('VALIDATION_ERROR', "Validation Error"), detail: this.locale.text('PLEASE_FILL_IN_PACKAGE_FINANCIAL_DETAILS_', "Please fill in package financial details.") });
      return;
    }
    if (this.selectedDays.length === 0) {
      this.messageService.add({ severity: 'error', summary: this.locale.text('VALIDATION_ERROR', "Validation Error"), detail: this.locale.text('PLEASE_SELECT_AT_LEAST_ONE_PREFERRED_DAY_', "Please select at least one preferred day.") });
      return;
    }

    const dates = this.generateBulkDates();
    if (dates.length === 0) return;

    try {
      await this.clinicState.createTreatmentPlan({
        patientId: this.selectedPatientId,
        doctorId: this.selectedDoctorId,
        roomId: this.selectedRoomId,
        dates: dates,
        paymentMode: this.planPaymentMode,
        packagePrice: this.packageTotalPrice || undefined,
        discount: this.packageDiscount || undefined,
        payingNow: this.packagePayingNow || undefined
      });

      const numericPatientId = Number(this.selectedPatientId);
      const pad = (n: number) => n.toString().padStart(2, '0');
      let firstAppointmentId = 0;

      // 1. Create each session appointment and its corresponding session invoice
      for (const date of dates) {
        const scheduledIso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
        let sessionApptId = 0;

        if (this.appointmentService) {
          try {
            const createdAppt: any = await firstValueFrom(
              this.appointmentService.addAppointment({
                patientId: numericPatientId,
                doctorId: Number(this.selectedDoctorId),
                roomId: Number(this.selectedRoomId),
                appointmentType: 'Session',
                startTime: scheduledIso,
                endTime: scheduledIso
              })
            );
            sessionApptId = Number(
              createdAppt?.id ?? createdAppt?.value?.id ?? createdAppt?.data?.id ?? 0
            );
            if (!firstAppointmentId && sessionApptId) {
              firstAppointmentId = sessionApptId;
            }
          } catch {
            // Continue creating invoices if appointment creation partially succeeds
          }
        }

        if (this.planPaymentMode === 'Package') {
          // Package session invoices: patientAmount = 0 and status mapped to 'Paid' (covered by package)
          const sessionInvoiceDto: CreateInvoiceDto = {
            appointmentId: sessionApptId,
            patientId: numericPatientId,
            type: this.billingService.mapTypeToNumber('Session'),
            totalAmount: 0,
            insuranceAmount: 0,
            patientAmount: 0
          };

          this.billingService.createInvoice(sessionInvoiceDto).subscribe({
            next: (createdSessionInv) => {
              if (createdSessionInv?.id) {
                this.billingService
                  .updateInvoiceStatus(
                    createdSessionInv.id,
                    this.billingService.mapStatusToNumber('Paid')
                  )
                  .subscribe();
              }
            },
            error: () => {}
          });
        } else {
          // Per-Session mode: create Pending session invoice with per-session price
          const sessionTotal = this.packageTotalPrice || 500;
          const copay = this.selectedPatient?.insuranceDetails?.copayPercentage;
          const isIns =
            this.selectedPatient?.paymentType === 'Insurance' && copay != null;
          const patAmount = isIns
            ? Math.round(sessionTotal * (copay! / 100))
            : sessionTotal;
          const insAmount = isIns ? sessionTotal - patAmount : 0;

          const sessionInvoiceDto: CreateInvoiceDto = {
            appointmentId: sessionApptId,
            patientId: numericPatientId,
            type: this.billingService.mapTypeToNumber('Session'),
            totalAmount: sessionTotal,
            insuranceAmount: insAmount,
            patientAmount: patAmount
          };

          this.billingService.createInvoice(sessionInvoiceDto).subscribe();
        }
      }

      // 2. If Package mode, create initial Installment invoice and record upfront payment via recordPayment
      if (this.planPaymentMode === 'Package') {
        const netTotal = Math.max(
          0,
          (this.packageTotalPrice || 0) - (this.packageDiscount || 0)
        );
        const shares = this.calculatedInsuranceShare;
        const insuranceAmount =
          this.selectedPatient?.paymentType === 'Insurance'
            ? shares.insuranceShare
            : 0;
        const patientAmount =
          this.selectedPatient?.paymentType === 'Insurance'
            ? Math.max(0, netTotal - insuranceAmount)
            : netTotal;

        const installmentDto: CreateInvoiceDto = {
          appointmentId: firstAppointmentId,
          patientId: numericPatientId,
          type: this.billingService.mapTypeToNumber('Installment'),
          totalAmount: netTotal,
          insuranceAmount,
          patientAmount
        };

        this.billingService.createInvoice(installmentDto).subscribe({
          next: (createdInstallmentInv) => {
            if (
              createdInstallmentInv?.id &&
              this.packagePayingNow &&
              this.packagePayingNow > 0
            ) {
              this.billingService
                .recordPayment({
                  invoiceId: Number(createdInstallmentInv.id),
                  amount: this.packagePayingNow,
                  method: this.billingService.mapPaymentMethodToNumber('Cash')
                })
                .subscribe();
            }
          },
          error: () => {}
        });
      }

      const patientDisplayName =
        this.selectedPatient?.nameEn ||
        this.clinicState.getPatientName(this.selectedPatientId);

      this.messageService.add({
        severity: 'success',
        summary: this.locale.text('TREATMENT_PLAN_CREATED', "Treatment Plan Created"),
        detail: this.locale.text('PLAN_CREATED', "Successfully booked {{count}} sessions for {{patient}}.", { count: dates.length, patient: patientDisplayName })
      });

      this.resetBookingForm();
    } catch (e: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.locale.text('PLAN_CREATION_FAILED', "Plan Creation Failed"),
        detail: this.locale.error(e, 'ERROR_GENERATING_TREATMENT_PLAN_', "Error generating treatment plan.")
      });
    }
  }

  resetBookingForm() {
    this.selectedPatientId = '';
    this.selectedDoctorId = '';
    this.selectedRoomId = '';
    this.sessionType = 'Assessment';
    this.scheduledDate = new Date();
    this.isFreeAssessment = false;
    this.assessmentPrice = null;
    this.bookingMode = 'single';
    this.planSessionCount = 10;
    this.packageTotalPrice = null;
    this.packagePayingNow = null;
    this.packageDiscount = null;
  }

  openQuickAddModal() {
    this.quickPatient = {
      nameEn: '',
      nameAr: '',
      phone: '',
      gender: 'Male',
      paymentType: 'Cash'
    };
    this.isQuickAddModalOpen = true;
  }

  closeQuickAddModal() {
    this.isQuickAddModalOpen = false;
  }

  async saveQuickPatient() {
    if (!this.quickPatient.nameEn.trim() || !this.quickPatient.phone.trim()) {
      this.messageService.add({
        severity: 'error',
        summary: this.locale.text('REQUIRED_FIELDS', "Required Fields"),
        detail: this.locale.text('PLEASE_ENTER_PATIENT_NAME_AND_PHONE_NUMBER_', "Please enter patient name and phone number.")
      });
      return;
    }

    try {
      await new Promise<void>((resolve, reject) => {
        this.patientService.addPatient({
          nameEn: this.quickPatient.nameEn.trim(),
          nameAr: this.quickPatient.nameAr.trim() || this.quickPatient.nameEn.trim(),
          phone: this.quickPatient.phone.trim(),
          gender: this.quickPatient.gender,
          paymentType: this.quickPatient.paymentType,
          dob: '1995-01-01',
          insuranceCompany: '',
          docs: { medicalConsent: true, liabilityWaiver: true, idCard: true }
        }).subscribe({
          next: (res) => {
            const newPatientId = res?.id || res?.data?.id || (res?.items && res.items[0]?.id) || Date.now();
            this.selectedPatientId = newPatientId.toString();
            this.onPatientChange(this.selectedPatientId);
            resolve();
          },
          error: (err) => reject(err)
        });
      });

      this.patientService.getPatients().subscribe();
      this.closeQuickAddModal();
      this.messageService.add({
        severity: 'success',
        summary: this.locale.text('PATIENT_REGISTERED', "Patient Registered"),
        detail: this.locale.text('NEW_PATIENT_CREATED_AND_SELECTED_', "New patient created and selected.")
      });
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: this.locale.text('REGISTRATION_FAILED', "Registration Failed"),
        detail: this.locale.text('COULD_NOT_REGISTER_NEW_PATIENT_', "Could not register new patient.")
      });
    }
  }

  // Timeline slots
  timeSlots = [
    '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM'
  ];

  formatTime(isoString?: string) {
    if (!isoString) return '-';
    try {
      return new Date(isoString).toLocaleTimeString(this.locale.language, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  }

  todayDate = new Date();

  /**
   * Strictly filters sessions/appointments to only include sessions
   * where the date part matches today's date.
   */
  get todaySessions(): Appointment[] {
    const todayYMD = this.todayDate.toISOString().split('T')[0];
    const pad = (n: number) => n.toString().padStart(2, '0');
    const localYMD = `${this.todayDate.getFullYear()}-${pad(this.todayDate.getMonth() + 1)}-${pad(this.todayDate.getDate())}`;

    const apiApps = this.appointments();
    const source: Appointment[] =
      apiApps.length > 0
        ? apiApps
        : (this.clinicState.sessions().map((s) => ({
            id: s.id as any,
            patientId: s.patientId as any,
            doctorId: s.doctorId as any,
            roomId: s.roomId as any,
            appointmentType: s.type,
            startTime: s.scheduledAt || '',
            endTime: s.scheduledAt || '',
            status: s.status
          })) as Appointment[]);

    return source.filter(a => {
      if (!a.startTime) return false;
      const sessionDatePart = a.startTime.toString().split('T')[0];
      return sessionDatePart === todayYMD || sessionDatePart === localYMD;
    });
  }

  /**
   * Schedule Filter:
   * Filters today's sessions based on selectedFilter.
   * 'Upcoming' includes 'Pending' and 'Confirmed'.
   */
  get filteredSchedule(): { time: string; sessions: Appointment[] }[] {
    const all = this.todaySessions;
    let filtered = all;

    if (this.selectedFilter === 'Upcoming') {
      filtered = all.filter(s => String(s.status) === 'Pending' || String(s.status) === 'Confirmed');
    } else if (this.selectedFilter === 'In Progress') {
      filtered = all.filter(s => String(s.status) === 'In Progress');
    } else if (this.selectedFilter === 'Completed') {
      filtered = all.filter(s => String(s.status) === 'Completed');
    }

    const grid: { time: string; sessions: Appointment[] }[] = this.timeSlots.map(t => ({ time: t, sessions: [] }));
    filtered.forEach(session => {
      if (!session.startTime) return;
      let slot = grid.find(g => g.time === this.formatTime(session.startTime as string));
      if (!slot) {
        try {
          const d = new Date(session.startTime);
          d.setMinutes(0, 0, 0);
          const hourStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          slot = grid.find(g => g.time === hourStr);
        } catch {}
      }
      if (slot) {
        slot.sessions.push(session);
      }
    });
    return grid;
  }

  // Alias for backward compatibility
  calendarGrid = computed(() => this.filteredSchedule);

  getSessionBadge(appointment: Appointment): string {
    const mockSession: any = {
      ...appointment,
      patientId: appointment.patientId?.toString(),
      type: appointment.appointmentType,
      scheduledAt: appointment.startTime
    };
    return this.clinicState.getSessionBadge(mockSession);
  }

  getStatusClass(status: string | number): string {
    const strStatus = String(status);
    switch (strStatus) {
      case 'Completed':
        return 'status-completed';
      case 'In Progress':
        return 'status-in-progress';
      case 'Pending':
        return 'status-pending';
      case 'Confirmed':
        return 'status-confirmed';
      case 'Cancelled':
        return 'status-cancelled';
      default:
        return 'status-confirmed';
    }
  }

  /**
   * Check-in patient action with Debt Gate interceptor
   */
  showDebtModal = false;
  pendingCheckInSessionId: number | null = null;
  installmentAmount: number = 0;
  installmentPaymentMethod: string = 'Cash';
  paymentMethods = ['Cash', 'Credit Card', 'E-Wallet', 'InstaPay'];
  debtAmount: number = 0;

  async checkInSession(sessionId: number | undefined) {
    if (sessionId === undefined) return;
    const session = this.appointments().find(s => s.id === sessionId);
    if (!session) return;

    const patient =
      this.allPatients().find(p => p.id === session.patientId.toString()) ||
      this.clinicState.getPatientById(session.patientId.toString());
    const plan = patient?.financialPlan || patient?.treatmentPlan?.financialPlan;

    // Calculate debt from patient's plan OR unpaid/partial invoices in BillingService
    const unpaidInvoicesDebt = this.billingService
      .invoices()
      .filter((inv) => {
        const st = this.billingService.mapStatusToString(inv.status);
        return (
          Number(inv.patientId) === Number(session.patientId) &&
          (st === 'Pending' || st === 'Partial')
        );
      })
      .reduce(
        (sum, inv) => sum + (inv.remainingBalance ?? inv.patientAmount ?? 0),
        0
      );

    const totalOutstandingDebt = Math.max(
      plan?.remainingDebt ?? 0,
      unpaidInvoicesDebt
    );

    if (totalOutstandingDebt > 0) {
      this.debtAmount = totalOutstandingDebt;
      this.pendingCheckInSessionId = sessionId;
      this.installmentAmount = totalOutstandingDebt;
      this.installmentPaymentMethod = 'Cash';
      this.showDebtModal = true;
      return;
    }

    await this.executeCheckIn(sessionId);
  }

  async executeCheckIn(sessionId: number) {
    try {
      await new Promise<void>((resolve, reject) => {
        this.appointmentService.updateStatus(sessionId, 'In Progress').subscribe({
          next: () => resolve(),
          error: (e) => reject(e)
        });
      });
      this.messageService.add({ severity: 'success', summary: this.locale.text('SUCCESS', "Success"), detail: this.locale.text('PATIENT_CHECKED_IN', "Patient checked in") });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.locale.text('CHECK_IN_ERROR', "Check-in Error"),
        detail: this.locale.error(error, 'CHECK_IN_FAILED', "Check-in failed")
      });
    }
  }

  async confirmCheckIn(withInstallment: boolean) {
    if (this.pendingCheckInSessionId === null) return;
    const sessionId = this.pendingCheckInSessionId;
    
    const session = this.appointments().find(s => s.id === sessionId);
    if (!session) return;

    if (withInstallment && this.installmentAmount > 0) {
      try {
        const methodNum = this.billingService.mapPaymentMethodToNumber(
          this.installmentPaymentMethod
        );

        let targetInvoice =
          this.billingService.getInvoiceBySessionId(sessionId) ||
          this.billingService
            .invoices()
            .find((inv) => {
              const st = this.billingService.mapStatusToString(inv.status);
              return (
                Number(inv.patientId) === Number(session.patientId) &&
                (st === 'Pending' || st === 'Partial')
              );
            });

        if (!targetInvoice) {
          targetInvoice = await firstValueFrom(
            this.billingService.createInvoice({
              appointmentId: sessionId,
              patientId: Number(session.patientId),
              type: this.billingService.mapTypeToNumber('Installment'),
              totalAmount: this.installmentAmount,
              insuranceAmount: 0,
              patientAmount: this.installmentAmount
            })
          );
        }

        if (targetInvoice?.id) {
          await firstValueFrom(
            this.billingService.recordPayment({
              invoiceId: Number(targetInvoice.id),
              amount: this.installmentAmount,
              method: methodNum
            })
          );
        }

        this.messageService.add({ 
          severity: 'success', 
          summary: this.locale.text('PAYMENT_COLLECTED', "Payment Collected"),
          detail: this.locale.text('INSTALLMENT_COLLECTED_DETAIL', "{{amount}} EGP installment collected.", { amount: this.installmentAmount.toLocaleString(this.locale.language) })
        });
      } catch (error: any) {
        this.messageService.add({ severity: 'error', summary: this.locale.text('PAYMENT_ERROR', "Payment Error"), detail: this.locale.text('FAILED_TO_PROCESS_INSTALLMENT', "Failed to process installment") });
        return; // Halt check-in on payment failure
      }
    }
    
    this.showDebtModal = false;
    this.pendingCheckInSessionId = null;
    await this.executeCheckIn(sessionId);
  }

  /**
   * Check-out Gate:
   * Strictly checks BillingService.getInvoiceBySessionId(sessionId) and halts
   * if the invoice status is not 'Paid' or 'Waived'.
   */
  async checkoutSession(sessionId: number | undefined) {
    if (sessionId === undefined) return;
    try {
      const sessionInvoice = this.billingService.getInvoiceBySessionId(sessionId);
      if (sessionInvoice) {
        const statusStr = this.billingService.mapStatusToString(sessionInvoice.status);
        if (statusStr !== 'Paid' && statusStr !== 'Waived') {
          throw new Error(
            this.locale.text('CANNOT_CHECK_OUT_THE_INVOICE_FOR_THIS_SESSION_IS_PENDING_PLEASE_PROCESS_PAYMENT_FIRST_', 'Cannot check out: The invoice for this session is pending. Please process payment first.')
          );
        }
      }

      await new Promise<void>((resolve, reject) => {
        this.appointmentService.updateStatus(sessionId, 'Completed').subscribe({
          next: () => resolve(),
          error: (e) => reject(e)
        });
      });
      this.messageService.add({ severity: 'success', summary: this.locale.text('SUCCESS', "Success"), detail: this.locale.text('PATIENT_CHECKED_OUT', "Patient checked out") });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.locale.text('CHECK_OUT_BLOCKED', "Check-out Blocked"),
        detail: this.locale.error(error, 'FAILED_TO_CHECK_OUT', "Failed to check out")
      });
    }
  }

  // Alias for backward compatibility
  async checkOutPatient(sessionId: number) {
    return this.checkoutSession(sessionId);
  }

  markPatientAbsent(sessionId: number | undefined) {
    if (sessionId === undefined) return;
    try {
      this.appointmentService.updateStatus(sessionId, 'Cancelled').subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.locale.text('SUCCESS', "Success"),
            detail: this.locale.text('PATIENT_MARKED_AS_ABSENT_AND_SESSION_CANCELLED_', "Patient marked as absent and session cancelled.")
          });
        },
        error: (error) => {
          this.messageService.add({
            severity: 'error',
            summary: this.locale.text('ERROR', "Error"),
            detail: this.locale.error(error, 'FAILED_TO_MARK_PATIENT_ABSENT_', "Failed to mark patient absent.")
          });
        }
      });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.locale.text('ERROR', "Error"),
        detail: this.locale.error(error, 'FAILED_TO_MARK_PATIENT_ABSENT_', "Failed to mark patient absent.")
      });
    }
  }
}
