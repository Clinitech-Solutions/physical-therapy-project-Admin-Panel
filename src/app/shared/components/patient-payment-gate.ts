import { Component, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { firstValueFrom } from 'rxjs';
import { CourseFinanceService } from '../../core/services/course-finance.service';
import { AppointmentWorkflowService } from '../../core/services/appointment-workflow.service';
import { PaymentGate, BookingPaymentMethod } from '../../core/models/booking.model';
import { apiError } from '../../core/services/reception-api';
import { ReceptionistLocale } from '../receptionist-locale';

@Component({selector: 'app-patient-payment-gate', standalone: true, imports: [CommonModule, FormsModule, TranslateModule, DialogModule],
  template: `
  <p-dialog [visible]="finance.blockedAppointment() !== null" (visibleChange)="close()" [modal]="true" [closable]="!busy()" [style]="{width:'480px', maxWidth:'95vw'}" [header]="'RECEPTIONIST.UI.FINANCE_START_COVERAGE' | translate">
    @if (error()) { <p class="alert alert-warning" role="alert">{{ locale.label(error()) }}</p> }
    @if (gate(); as current) {
      <dl><dt>{{ 'RECEPTIONIST.UI.ACTUAL_AMOUNT_PAID' | translate }}</dt><dd>{{ current.patientPaid | number:'1.2-2' }}</dd><dt>{{ 'RECEPTIONIST.UI.FINANCE_REQUIRED_CUMULATIVE' | translate }}</dt><dd>{{ current.requiredCumulative | number:'1.2-2' }}</dd><dt>{{ 'RECEPTIONIST.UI.FINANCE_SHORTFALL' | translate }}</dt><dd class="fw-bold text-danger">EGP {{ current.additionalPaymentRequired | number:'1.2-2' }}</dd></dl>
      @if (retryKey) {
        <p class="alert alert-info">{{ 'RECEPTIONIST.UI.FINANCE_ORIGINAL_RECEIPT' | translate }}: EGP {{ amount | number:'1.2-2' }} / {{ locale.label(method) }}</p>
        <button class="btn btn-primary w-100" type="button" (click)="collect()" [disabled]="busy()">{{ 'RECEPTIONIST.UI.FINANCE_RETRY_RECEIPT' | translate }}</button>
      }
      @if (!retryKey && !current.canStart && current.invoiceId) {
        <label class="form-label w-100">{{ 'RECEPTIONIST.UI.AMOUNT' | translate }}<input class="form-control" type="number" [(ngModel)]="amount" [min]="current.additionalPaymentRequired" [max]="current.patientBalance" step="0.01" [disabled]="busy() || !!retryKey" /></label>
        <label class="form-label w-100">{{ 'RECEPTIONIST.UI.PAYMENT_METHOD' | translate }}<select class="form-select" [(ngModel)]="method" [disabled]="busy() || !!retryKey"><option value="Cash">{{ locale.label('Cash') }}</option><option value="Visa">{{ locale.label('Visa') }}</option><option value="Online">{{ locale.label('Online') }}</option></select></label>
        <button class="btn btn-primary w-100 mt-3" type="button" (click)="collect()" [disabled]="busy() || amount < current.additionalPaymentRequired || amount > current.patientBalance">{{ (retryKey ? 'RECEPTIONIST.UI.FINANCE_RETRY_RECEIPT' : 'RECEPTIONIST.UI.FINANCE_COLLECT_SHORTFALL') | translate }}</button>
      } @else if (current.canStart) { <button class="btn btn-primary w-100" type="button" (click)="start()" [disabled]="busy() || !!retryKey">{{ 'RECEPTIONIST.UI.FINANCE_START_SESSION' | translate }}</button> }
      @else { <p role="alert">{{ 'RECEPTIONIST.UI.FINANCE_REVIEW_LEGACY' | translate }}</p> }
    } @else { <button type="button" class="btn btn-outline-secondary" (click)="load()" [disabled]="busy()">{{ 'RECEPTIONIST.UI.RETRY' | translate }}</button> }
  </p-dialog>`})
export class PatientPaymentGateComponent {
  readonly finance = inject(CourseFinanceService); private readonly workflow = inject(AppointmentWorkflowService);
  readonly locale = new ReceptionistLocale(); readonly gate = signal<PaymentGate | null>(null); readonly error = signal(''); readonly busy = signal(false);
  amount = 0; method: BookingPaymentMethod = 'Cash'; retryKey: string | null = null;
  constructor() { effect(() => { if (this.finance.blockedAppointment() !== null) untracked(() => { void this.load(); }); }); }
  async load() {
    const id = this.finance.blockedAppointment(); if (id === null || this.busy()) return;
    const original=this.finance.pending(`patient-${id}`);
    this.retryKey=original?.key ?? null;
    if(original){this.amount=original.body['amount'] as number;this.method=original.body['method'] as BookingPaymentMethod;}
    this.busy.set(true); this.error.set(''); this.gate.set(null);
    try { const gate = await firstValueFrom(this.finance.gate(id)); this.gate.set(gate); if (!this.retryKey) this.amount = gate.additionalPaymentRequired; }
    catch(error) { this.error.set(apiError(error)); } finally { this.busy.set(false); }
  }
  async collect() {
    const id = this.finance.blockedAppointment(); if (id === null || this.busy()) return;
    this.busy.set(true); this.error.set(''); this.retryKey ??= crypto.randomUUID();
    try { this.gate.set(await firstValueFrom(this.finance.collect(id, this.retryKey, this.amount, this.method))); this.retryKey = null; }
    catch(error) { if (!this.finance.needsRetry(error)) this.retryKey = null; this.error.set(apiError(error)); } finally { this.busy.set(false); }
  }
  async start() {
    const id = this.finance.blockedAppointment(); if (id === null || this.busy() || this.retryKey) return;
    this.busy.set(true); this.error.set('');
    try { await firstValueFrom(this.workflow.transition(id, 'In Progress')); this.finance.blockedAppointment.set(null); }
    catch(error) {
      this.error.set(apiError(error));
      try { const current = await firstValueFrom(this.finance.gate(id)); this.gate.set(current); this.amount = current.additionalPaymentRequired; } catch { /* Keep the start error visible; retry remains safe. */ }
    } finally { this.busy.set(false); }
  }
  close() { if (!this.busy()) { this.retryKey=null; this.finance.blockedAppointment.set(null); this.gate.set(null); } }
}
