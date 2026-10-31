import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { CourseFinanceService, FinancialIntent } from '../../../core/services/course-finance.service';
import { BookingPaymentMethod, InsuranceAccounts, InsuranceReceivable } from '../../../core/models/booking.model';
import { apiError } from '../../../core/services/reception-api';
import { ReceptionistLocale } from '../../../shared/receptionist-locale';

@Component({selector: 'app-insurer-accounts', standalone: true, imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './insurer-accounts.html', styles: [`:host{display:block}.insurer-totals{display:flex;gap:1.5rem;flex-wrap:wrap;margin:1rem 0}.insurer-totals div{min-width:110px}.insurer-totals dt{font-size:.8rem;color:var(--text-secondary);font-weight:400}.insurer-totals dd{font-weight:600}.claim-fields{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}td,th{white-space:nowrap}details{margin-bottom:1rem}summary{cursor:pointer}small{display:block;overflow-wrap:anywhere}`]})
export class InsurerAccountsComponent implements OnInit {
  readonly finance = inject(CourseFinanceService); readonly locale = new ReceptionistLocale();
  readonly accounts = signal<InsuranceAccounts | null>(null); readonly error = signal(''); readonly busy = signal(false);
  selected: InsuranceReceivable | null = null; reference = ''; amount = 0; method: BookingPaymentMethod = 'Online'; retryKey: string | null = null;
  originalOperation: FinancialIntent | null = null;
  get isSettlement() { return this.originalOperation ? this.originalOperation.scope.startsWith('settle-') : !!this.selected?.claimId; }
  readonly columns = ['PLANNED', 'EARNED', 'SUBMITTED', 'COLLECTED', 'OUTSTANDING'];
  ngOnInit() { void this.load(); }
  async load() {
    if (this.busy()) return; this.busy.set(true); this.error.set('');
    try { this.accounts.set(await firstValueFrom(this.finance.accounts()));
      const original=this.finance.pendingInsurance()[0];
      if(original){const claim=original.scope.startsWith('claim-');const id=Number(original.scope.split('-')[1]);
        this.selected=this.accounts()!.receivables.find(row=>claim?row.invoiceId===id:row.claimId===id) ?? null;
        if(this.selected){this.originalOperation=original;this.retryKey=original.key;this.reference=String(original.body[claim?'submissionReference':'settlementReference']);this.amount=Number(original.body['amount'] ?? this.selected.outstandingAmount);this.method=(original.body['method'] ?? 'Online') as BookingPaymentMethod;}
        else this.error.set(this.locale.text('FINANCE_RECOVERY_REVIEW','An unresolved financial operation needs review before another receipt.'));
      }
    } catch(error) { this.error.set(apiError(error)); } finally { this.busy.set(false); }
  }
  select(row: InsuranceReceivable) { if (this.busy() || this.retryKey) return; this.selected = row; this.reference = ''; this.amount = row.outstandingAmount; this.error.set(''); }
  async save() {
    if (!this.selected || this.busy() || !this.reference.trim() || !this.retryKey && this.isSettlement && (this.amount <= 0 || this.amount > this.selected.outstandingAmount)) return;
    this.busy.set(true); this.error.set(''); this.retryKey ??= crypto.randomUUID();
    try {
      const row = this.selected;
      if (this.isSettlement) await firstValueFrom(this.finance.settle(row.claimId!, this.retryKey, this.amount, this.method, this.reference));
      else await firstValueFrom(this.finance.claim(row.invoiceId, this.retryKey, this.reference));
      this.retryKey = null; this.originalOperation=null; this.selected = null; this.busy.set(false); await this.load();
    } catch(error) { if (!this.finance.needsRetry(error)) this.retryKey = null; this.error.set(apiError(error)); }
    finally { this.busy.set(false); }
  }
}
