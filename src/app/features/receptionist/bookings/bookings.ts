import { Component, signal, computed, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
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

@Component({
  selector: "app-receptionist-bookings",
  standalone: true,
  imports: [
    CommonModule, 
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
export class BookingsComponent {
  clinicState = inject(ClinicStateService);
  messageService = inject(MessageService);

  viewMode = signal<'Week' | 'Day'>('Day');
  isLoading = this.clinicState.isLoading;

  // Global State Signals from ClinicStateService
  sessions = this.clinicState.sessions;
  allPatients = this.clinicState.patients;
  allDoctors = this.clinicState.doctors;
  allRooms = this.clinicState.rooms;
  availableRooms = this.clinicState.availableRooms;

  // Patient Profile Modal
  selectedProfilePatientId = signal<string | null>(null);
  showProfileModal = signal<boolean>(false);

  openPatientProfile(patientId: string) {
    this.selectedProfilePatientId.set(patientId);
    this.showProfileModal.set(true);
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
  
  weekDays = [
    { label: 'Sat', value: 6 },
    { label: 'Sun', value: 0 },
    { label: 'Mon', value: 1 },
    { label: 'Tue', value: 2 },
    { label: 'Wed', value: 3 },
    { label: 'Thu', value: 4 }
  ];
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
    return Math.max(0, (this.packageTotalPrice || 0) - (this.packagePayingNow || 0));
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
        summary: 'Incomplete Selection',
        detail: 'Please select both an absent doctor and a covering senior doctor.'
      });
      return;
    }

    try {
      this.clinicState.handleDoctorAbsence(this.absentDoctorId, this.coveringSeniorId);
      this.messageService.add({
        severity: 'success',
        summary: 'Absence Recorded',
        detail: 'Absence recorded. 50% of sessions reassigned to Senior, remainder distributed to available doctors.'
      });
      this.closeAbsenceModal();
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Absence Error',
        detail: error?.message || 'Failed to record doctor absence.'
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
    return this.clinicState.getPatientById(this.selectedPatientId);
  }

  get isInsurancePending(): boolean {
    return this.selectedPatient?.paymentType === 'Insurance' && this.selectedPatient?.insuranceDetails?.status !== 'Approved';
  }

  /**
   * Strict Gender Matching Rule:
   * Male doctors treat male patients, female doctors treat female patients.
   */
  get filteredDoctors(): Doctor[] {
    if (!this.selectedPatientId) {
      return [];
    }
    const patientGender = this.clinicState.getPatientGender(this.selectedPatientId);
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

    if (this.selectedDoctorId) {
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
        summary: 'Select Patient',
        detail: 'Please select or add a patient first to find the nearest walk-in slot.'
      });
      return;
    }

    if (this.isInsurancePending) {
      this.messageService.add({
        severity: 'error',
        summary: 'Insurance Pending',
        detail: 'Insurance approval is pending. Cannot book sessions.'
      });
      return;
    }

    const eligibleDoctors = this.filteredDoctors;
    if (!eligibleDoctors || eligibleDoctors.length === 0) {
      const patientGender = this.clinicState.getPatientGender(this.selectedPatientId);
      this.messageService.add({
        severity: 'error',
        summary: 'No Matching Doctors',
        detail: `No available ${patientGender ? patientGender.toLowerCase() : ''} doctors found to treat this patient.`
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
        summary: 'Walk-In Slot Found',
        detail: `Auto-assigned Dr. ${this.clinicState.getDoctorName(slot.doctorId)} (${this.clinicState.getDoctorGender(slot.doctorId)}) in ${this.clinicState.getRoomName(slot.roomId)} at ${this.formatTime(slot.scheduledAt)}.`
      });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Slot Search Failed',
        detail: error.message || 'No suitable slot found matching gender and load criteria.'
      });
    }
  }

  async submitBooking() {
    if (!this.selectedPatientId) {
      this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Please select a patient.' });
      return;
    }
    if (this.isInsurancePending) {
      this.messageService.add({
        severity: 'error',
        summary: 'Insurance Pending',
        detail: 'Insurance approval is pending. Cannot book sessions.'
      });
      return;
    }
    if (!this.selectedDoctorId) {
      this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Please select a doctor.' });
      return;
    }
    if (!this.selectedRoomId) {
      this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Please select an available room.' });
      return;
    }
    if (!this.scheduledDate) {
      this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Please select date and time.' });
      return;
    }

    const isDocGenderValid = this.filteredDoctors.some(d => d.id === this.selectedDoctorId);
    if (!isDocGenderValid) {
      const patientGender = this.clinicState.getPatientGender(this.selectedPatientId);
      this.messageService.add({
        severity: 'error',
        summary: 'Gender Mismatch',
        detail: `Strict policy: Male doctors treat male patients, and female doctors treat female patients. Please select a ${patientGender?.toLowerCase()} doctor.`
      });
      return;
    }

    const finalType: SessionType = this.isNewPatient ? 'Assessment' : this.sessionType;

    if (finalType === 'Assessment' && !this.isFreeAssessment && this.assessmentPrice == null) {
      this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Please enter the Assessment Price.' });
      return;
    }

    const dateObj = this.scheduledDate instanceof Date ? this.scheduledDate : new Date(this.scheduledDate);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const scheduledIso = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}T${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:00`;

    const shares = this.calculatedInsuranceShare;

    try {
      await this.clinicState.addSession({
        patientId: this.selectedPatientId,
        doctorId: this.selectedDoctorId,
        roomId: this.selectedRoomId,
        scheduledAt: scheduledIso,
        type: finalType,
        isFreeAssessment: finalType === 'Assessment' && this.isFreeAssessment,
        assessmentPrice: this.assessmentPrice,
        patientShare: shares.patientShare,
        insuranceShare: shares.insuranceShare
      });

      this.messageService.add({
        severity: 'success',
        summary: 'Booking Successful',
        detail: `${finalType} booked for ${this.clinicState.getPatientName(this.selectedPatientId)} with Dr. ${this.clinicState.getDoctorName(this.selectedDoctorId)}!`
      });

      this.resetBookingForm();
    } catch (e: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Booking Failed',
        detail: e.message || 'Room is not available for booking.'
      });
    }
  }

  async submitTreatmentPlan() {
    if (!this.selectedPatientId || !this.selectedDoctorId || !this.selectedRoomId) {
      this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Please select patient, doctor, and room.' });
      return;
    }
    if (this.planPaymentMode === 'Package' && (this.packageTotalPrice == null || this.packagePayingNow == null)) {
      this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Please fill in package financial details.' });
      return;
    }
    if (this.selectedDays.length === 0) {
      this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Please select at least one preferred day.' });
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
        payingNow: this.packagePayingNow || undefined
      });

      this.messageService.add({
        severity: 'success',
        summary: 'Treatment Plan Created',
        detail: `Successfully booked ${dates.length} sessions for ${this.clinicState.getPatientName(this.selectedPatientId)}.`
      });

      this.resetBookingForm();
    } catch (e: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Plan Creation Failed',
        detail: e.message || 'Error generating treatment plan.'
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
        summary: 'Required Fields',
        detail: 'Please enter patient name and phone number.'
      });
      return;
    }

    await this.clinicState.createPatient({
      nameEn: this.quickPatient.nameEn.trim(),
      nameAr: this.quickPatient.nameAr.trim() || this.quickPatient.nameEn.trim(),
      phone: this.quickPatient.phone.trim(),
      gender: this.quickPatient.gender,
      paymentType: this.quickPatient.paymentType,
      dob: '1995-01-01',
      insuranceCompany: '',
      docs: { medicalConsent: true, liabilityWaiver: true, idCard: true }
    });

    const newPatient = this.allPatients()[0];
    if (newPatient) {
      this.selectedPatientId = newPatient.id;
      this.onPatientChange(newPatient.id);
    }

    this.closeQuickAddModal();
    this.messageService.add({
      severity: 'success',
      summary: 'Patient Registered',
      detail: 'New patient created and selected.'
    });
  }

  // Timeline slots
  timeSlots = [
    '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM'
  ];

  formatTime(isoString?: string) {
    if (!isoString) return '-';
    try {
      return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  }

  todayDate = new Date();

  /**
   * Strictly filters clinicState.sessions() to only include sessions
   * where the date part of scheduledAt matches today's date.
   */
  get todaySessions(): Session[] {
    const todayYMD = this.todayDate.toISOString().split('T')[0];
    const pad = (n: number) => n.toString().padStart(2, '0');
    const localYMD = `${this.todayDate.getFullYear()}-${pad(this.todayDate.getMonth() + 1)}-${pad(this.todayDate.getDate())}`;

    return this.sessions().filter(s => {
      if (!s.scheduledAt) return false;
      const sessionDatePart = s.scheduledAt.split('T')[0];
      return sessionDatePart === todayYMD || sessionDatePart === localYMD;
    });
  }

  /**
   * Schedule Filter:
   * Filters today's sessions based on selectedFilter.
   * 'Upcoming' includes 'Pending' and 'Confirmed'.
   */
  get filteredSchedule(): { time: string; sessions: Session[] }[] {
    const all = this.todaySessions;
    let filtered = all;

    if (this.selectedFilter === 'Upcoming') {
      filtered = all.filter(s => s.status === 'Pending' || s.status === 'Confirmed');
    } else if (this.selectedFilter === 'In Progress') {
      filtered = all.filter(s => s.status === 'In Progress');
    } else if (this.selectedFilter === 'Completed') {
      filtered = all.filter(s => s.status === 'Completed');
    }

    const grid: { time: string; sessions: Session[] }[] = this.timeSlots.map(t => ({ time: t, sessions: [] }));
    filtered.forEach(session => {
      if (!session.scheduledAt) return;
      let slot = grid.find(g => g.time === this.formatTime(session.scheduledAt));
      if (!slot) {
        // Match to the corresponding hour bucket (e.g. 09:30 AM maps into 09:00 AM slot)
        try {
          const d = new Date(session.scheduledAt);
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

  /**
   * Distinct visual class for session cards:
   * - status-completed: faded/grayscale, strike-through
   * - status-in-progress: highlighted active border & shadow
   * - status-pending / status-confirmed: clean standard border
   */
  getStatusClass(status: string): string {
    switch (status) {
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
  // Check-In Debt Modal State
  showDebtModal = false;
  pendingCheckInSessionId: string | null = null;
  installmentAmount: number = 0;
  installmentPaymentMethod: string = 'Cash';
  paymentMethods = ['Cash', 'Credit Card', 'E-Wallet'];
  debtAmount: number = 0;

  async checkInSession(sessionId: string) {
    const session = this.sessions().find(s => s.id === sessionId);
    if (!session) return;

    const patient = this.allPatients().find(p => p.id === session.patientId);
    const plan = patient?.financialPlan || patient?.treatmentPlan?.financialPlan;
    
    // If the patient has remaining debt, intercept the check-in
    if (plan && plan.remainingDebt && plan.remainingDebt > 0) {
      this.debtAmount = plan.remainingDebt;
      this.pendingCheckInSessionId = sessionId;
      this.installmentAmount = 0;
      this.installmentPaymentMethod = 'Cash';
      this.showDebtModal = true;
      return;
    }

    // Otherwise proceed normally
    await this.executeCheckIn(sessionId);
  }

  async executeCheckIn(sessionId: string) {
    try {
      await this.clinicState.checkInPatient(sessionId);
      this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Patient checked in' });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Check-in Error',
        detail: error?.message || 'Check-in failed'
      });
    }
  }

  async confirmCheckIn(withInstallment: boolean) {
    if (!this.pendingCheckInSessionId) return;
    const sessionId = this.pendingCheckInSessionId;
    
    const session = this.sessions().find(s => s.id === sessionId);
    if (!session) return;

    if (withInstallment && this.installmentAmount > 0) {
      try {
        await this.clinicState.collectInstallment(
          session.patientId, 
          this.installmentAmount, 
          this.installmentPaymentMethod, 
          sessionId
        );
        this.messageService.add({ 
          severity: 'success', 
          summary: 'Payment Collected', 
          detail: `${this.installmentAmount} EGP installment collected.` 
        });
      } catch (error: any) {
        this.messageService.add({ severity: 'error', summary: 'Payment Error', detail: 'Failed to process installment' });
        return; // Halt check-in on payment failure
      }
    }
    
    this.showDebtModal = false;
    this.pendingCheckInSessionId = null;
    await this.executeCheckIn(sessionId);
  }

  /**
   * Check-out patient action with payment gate error handling
   */
  async checkoutSession(sessionId: string) {
    try {
      await this.clinicState.checkOutPatient(sessionId);
      this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Patient checked out' });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Check-out Blocked',
        detail: error.message
      });
    }
  }

  // Alias for backward compatibility
  async checkOutPatient(sessionId: string) {
    return this.checkoutSession(sessionId);
  }

  markPatientAbsent(sessionId: string) {
    try {
      this.clinicState.markPatientAbsent(sessionId);
      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Patient marked as absent and session cancelled.'
      });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: error.message || 'Failed to mark patient absent.'
      });
    }
  }
}

