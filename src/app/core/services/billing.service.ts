import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Invoice {
  id: number;
  appointmentId: number;
  patientId: number;
  type: number | string;
  totalAmount: number;
  insuranceAmount: number;
  patientAmount: number;
  paidAmount?: number;
  remainingBalance?: number;
  status: number | string;
  createdAt?: string;
  payments?: Payment[];
  paymentMethod?: number | string;

  // Fallback UI properties
  patientName?: string;
  appointmentDetails?: string;
}

export interface CreateInvoiceDto {
  appointmentId: number;
  patientId: number;
  type: number;
  totalAmount: number;
  insuranceAmount: number;
  patientAmount: number;
}

export interface Payment {
  id?: number;
  invoiceId: number;
  amount: number;
  method: number | string;
  paymentDate?: string;
  createdAt?: string;
}

export interface CreatePaymentDto {
  invoiceId: number;
  amount: number;
  method: number;
}

@Injectable({
  providedIn: 'root'
})
export class BillingService {
  private http = inject(HttpClient, { optional: true });
  private apiUrl = `${environment.apiUrl}/Billing`;

  invoices = signal<Invoice[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  // Real-time Financial & Revenue Computed Signals (strictly using totalAmount, insuranceAmount, patientAmount)
  todayInvoices = computed(() => {
    const today = new Date();
    const todayYMD = today.toISOString().split('T')[0];
    const pad = (n: number) => n.toString().padStart(2, '0');
    const localYMD = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    return this.invoices().filter((inv) => {
      if (!inv.createdAt) return true;
      const invDate = new Date(inv.createdAt);
      const isSameDay =
        !isNaN(invDate.getTime()) &&
        invDate.getFullYear() === today.getFullYear() &&
        invDate.getMonth() === today.getMonth() &&
        invDate.getDate() === today.getDate();
      const invDatePart = inv.createdAt.toString().split('T')[0];
      return isSameDay || invDatePart === todayYMD || invDatePart === localYMD;
    });
  });

  expectedTodayRevenue = computed(() =>
    this.todayInvoices().reduce(
      (sum, inv) => sum + (inv.totalAmount || 0),
      0
    )
  );

  collectedTodayRevenue = computed(() =>
    this.todayInvoices().reduce((sum, inv) => {
      if (inv.paidAmount !== undefined && inv.paidAmount > 0) {
        return sum + inv.paidAmount;
      }
      if (this.mapStatusToString(inv.status) === 'Paid') {
        return sum + (inv.patientAmount ?? inv.totalAmount ?? 0);
      }
      return sum;
    }, 0)
  );

  pendingTodayRevenue = computed(() =>
    this.todayInvoices()
      .filter((inv) => {
        const st = this.mapStatusToString(inv.status);
        return st === 'Pending' || st === 'Partial';
      })
      .reduce((sum, inv) => {
        const rem =
          inv.remainingBalance !== undefined
            ? inv.remainingBalance
            : inv.patientAmount ?? inv.totalAmount ?? 0;
        return sum + rem;
      }, 0)
  );

  cashCollectedToday = computed(() =>
    this.todayInvoices().reduce((sum, inv) => {
      const method = this.mapMethodToString(inv.paymentMethod);
      if (method !== 'Cash') return sum;
      if (inv.paidAmount !== undefined && inv.paidAmount > 0) {
        return sum + inv.paidAmount;
      }
      if (this.mapStatusToString(inv.status) === 'Paid') {
        return sum + (inv.patientAmount ?? inv.totalAmount ?? 0);
      }
      return sum;
    }, 0)
  );

  digitalCollectedToday = computed(() =>
    this.todayInvoices().reduce((sum, inv) => {
      const method = inv.paymentMethod !== undefined ? this.mapMethodToString(inv.paymentMethod) : '';
      const isDigital =
        method === 'Credit Card' ||
        method === 'E-Wallet' ||
        method === 'InstaPay';
      if (!isDigital) return sum;
      if (inv.paidAmount !== undefined && inv.paidAmount > 0) {
        return sum + inv.paidAmount;
      }
      if (this.mapStatusToString(inv.status) === 'Paid') {
        return sum + (inv.patientAmount ?? inv.totalAmount ?? 0);
      }
      return sum;
    }, 0)
  );

  collectionRateToday = computed(() => {
    const expected = this.expectedTodayRevenue();
    if (expected === 0) return 0;
    return Math.min(100, Math.round((this.collectedTodayRevenue() / expected) * 100));
  });

  pendingPaymentsCount = computed(() =>
    this.invoices().filter((inv) => {
      const st = this.mapStatusToString(inv.status);
      return st === 'Pending' || st === 'Partial';
    }).length
  );

  // Enum & Schema Mapping Helpers
  mapTypeToNumber(type: string | number): number {
    if (typeof type === 'number') return type;
    switch (type) {
      case 'Assessment':
        return 0;
      case 'Session':
        return 1;
      case 'Re-Assessment':
      case 'ReAssessment':
        return 2;
      case 'Installment':
        return 3;
      default:
        return 1;
    }
  }

  mapTypeToString(type: number | string | undefined): string {
    switch (type) {
      case 0:
      case '0':
      case 'Assessment':
        return 'Assessment';
      case 1:
      case '1':
      case 'Session':
        return 'Session';
      case 2:
      case '2':
      case 'Re-Assessment':
      case 'ReAssessment':
        return 'Re-Assessment';
      case 3:
      case '3':
      case 'Installment':
        return 'Installment';
      default:
        return type !== undefined && type !== null ? String(type) : 'Session';
    }
  }

  mapTypeToLabel(type: number | string | undefined): string {
    return this.mapTypeToString(type);
  }

  mapStatusToNumber(status: string | number): number {
    if (typeof status === 'number') return status;
    switch (status) {
      case 'Pending':
      case 'Unpaid':
        return 0;
      case 'Paid':
        return 1;
      case 'Partial':
      case 'PartiallyPaid':
        return 2;
      case 'Waived':
      case 'Cancelled':
        return 3;
      case 'Refunded':
        return 4;
      default:
        return 0;
    }
  }

  mapStatusToString(
    status: number | string | undefined
  ): 'Pending' | 'Paid' | 'Partial' | 'Waived' | 'Refunded' {
    switch (status) {
      case 0:
      case '0':
      case 'Pending':
      case 'Unpaid':
        return 'Pending';
      case 1:
      case '1':
      case 'Paid':
        return 'Paid';
      case 2:
      case '2':
      case 'Partial':
      case 'PartiallyPaid':
        return 'Partial';
      case 3:
      case '3':
      case 'Waived':
      case 'Cancelled':
        return 'Waived';
      case 4:
      case '4':
      case 'Refunded':
        return 'Refunded';
      default:
        return 'Pending';
    }
  }

  mapStatusToLabel(
    status: number | string | undefined
  ): 'Pending' | 'Paid' | 'Partial' | 'Waived' | 'Refunded' {
    return this.mapStatusToString(status);
  }

  mapPaymentMethodToNumber(method: string | number): number {
    if (typeof method === 'number') return method;
    switch (method) {
      case 'Cash':
        return 0;
      case 'Credit Card':
      case 'Card':
      case 'Visa':
        return 1;
      case 'E-Wallet':
      case 'Wallet':
        return 2;
      case 'InstaPay':
      case 'Bank Transfer':
      case 'Online':
        return 3;
      default:
        return 0;
    }
  }

  mapMethodToString(method: number | string | undefined): string {
    switch (method) {
      case 0:
      case '0':
      case 'Cash':
        return 'Cash';
      case 1:
      case '1':
      case 'Credit Card':
      case 'Card':
      case 'Visa':
        return 'Credit Card';
      case 2:
      case '2':
      case 'E-Wallet':
      case 'Wallet':
        return 'E-Wallet';
      case 3:
      case '3':
      case 'InstaPay':
      case 'Bank Transfer':
      case 'Online':
        return 'InstaPay';
      default:
        return 'Cash';
    }
  }

  mapPaymentMethodToLabel(method: number | string | undefined): string {
    return this.mapMethodToString(method);
  }

  normalizeInvoice(raw: any): Invoice {
    const totalAmount = Number(raw?.totalAmount ?? 0);
    const insuranceAmount = Number(raw?.insuranceAmount ?? 0);
    const patientAmount = Number(
      raw?.patientAmount ?? Math.max(0, totalAmount - insuranceAmount)
    );
    const statusLabel = this.mapStatusToString(raw?.status);
    const typeLabel = this.mapTypeToString(raw?.type);
    const payments: Payment[] | undefined = Array.isArray(raw?.payments)
      ? raw.payments.map((p: any) => ({
          ...p,
          amount: Number(p?.amount ?? 0),
          method: this.mapMethodToString(p?.method)
        }))
      : undefined;

    const paidFromPayments = payments
      ? payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
      : undefined;

    const paidAmount =
      raw?.paidAmount !== undefined
        ? Number(raw.paidAmount)
        : paidFromPayments !== undefined
        ? paidFromPayments
        : statusLabel === 'Paid'
        ? patientAmount
        : 0;

    const remainingBalance =
      raw?.remainingBalance !== undefined
        ? Number(raw.remainingBalance)
        : statusLabel === 'Paid' || statusLabel === 'Waived'
        ? 0
        : Math.max(0, patientAmount - paidAmount);

    const resolvedStatus =
      statusLabel === 'Pending' && paidAmount > 0
        ? remainingBalance <= 0
          ? 'Paid'
          : 'Partial'
        : statusLabel;

    const paymentMethod =
      payments && payments.length > 0
        ? this.mapMethodToString(payments[payments.length - 1].method)
        : raw?.paymentMethod !== undefined
        ? this.mapMethodToString(raw.paymentMethod)
        : undefined;

    return {
      id: Number(raw?.id ?? 0),
      appointmentId: Number(raw?.appointmentId ?? 0),
      patientId: Number(raw?.patientId ?? 0),
      type: typeLabel,
      totalAmount,
      insuranceAmount,
      patientAmount,
      paidAmount,
      remainingBalance,
      status: resolvedStatus,
      createdAt:
        raw?.createdAt ||
        raw?.issuedAt ||
        raw?.invoiceDate ||
        raw?.date ||
        new Date().toISOString(),
      payments,
      paymentMethod,
      patientName: raw?.patientName,
      appointmentDetails: raw?.appointmentDetails
    };
  }

  findInvoiceById(id: number | string | null | undefined): Invoice | undefined {
    if (id === null || id === undefined) return undefined;
    return this.invoices().find((inv) => String(inv.id) === String(id));
  }

  getInvoiceBySessionId(sessionId: number | string | null | undefined): Invoice | undefined {
    if (sessionId === null || sessionId === undefined) return undefined;
    return this.invoices().find(
      (inv) => String(inv.appointmentId) === String(sessionId)
    );
  }

  // CRUD Methods
  getInvoices(): void {
    if (!this.http) return;
    this.loading.set(true);
    this.error.set(null);

    this.http.get<Invoice[]>(`${this.apiUrl}/invoices`).subscribe({
      next: (data: any) => {
        const result =
          data?.value !== undefined
            ? data.value
            : data?.data !== undefined
            ? data.data
            : data?.items !== undefined
            ? data.items
            : data;
        const list = Array.isArray(result)
          ? result.map((item: any) => this.normalizeInvoice(item))
          : [];
        this.invoices.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to fetch invoices');
        this.loading.set(false);
      }
    });
  }

  getInvoiceById(id: number): Observable<Invoice> {
    if (!this.http) return of({} as Invoice);
    return this.http.get<Invoice>(`${this.apiUrl}/invoices/${id}`).pipe(
      map((data: any) => {
        const raw =
          data?.value !== undefined
            ? data.value
            : data?.data !== undefined
            ? data.data
            : data;
        return this.normalizeInvoice(raw);
      })
    );
  }

  createInvoice(payload: CreateInvoiceDto): Observable<Invoice> {
    if (!this.http) return of({} as Invoice);
    return this.http.post<Invoice>(`${this.apiUrl}/invoices`, payload).pipe(
      map((data: any) => {
        const raw =
          data?.value !== undefined
            ? data.value
            : data?.data !== undefined
            ? data.data
            : data;
        return raw ? this.normalizeInvoice(raw) : (raw as Invoice);
      }),
      tap(() => {
        this.getInvoices();
      })
    );
  }

  deleteInvoice(id: number): Observable<void> {
    if (!this.http) return of(undefined);
    return this.http.delete<void>(`${this.apiUrl}/invoices/${id}`).pipe(
      tap(() => {
        this.invoices.update((invs) => invs.filter((inv) => inv.id !== id));
      })
    );
  }

  updateInvoiceStatus(id: number, status: number): Observable<any> {
    if (!this.http) return of(null);
    return this.http
      .patch(`${this.apiUrl}/invoices/${id}/status`, { status })
      .pipe(
        tap(() => {
          this.getInvoices();
        })
      );
  }

  // Payments Methods
  getPaymentsForInvoice(invoiceId: number): Observable<Payment[]> {
    if (!this.http) return of([]);
    return this.http
      .get<Payment[]>(`${this.apiUrl}/invoices/${invoiceId}/payments`)
      .pipe(
        map((data: any) => {
          const result =
            data?.value !== undefined
              ? data.value
              : data?.data !== undefined
              ? data.data
              : data?.items !== undefined
              ? data.items
              : data;
          return Array.isArray(result)
            ? result.map((p: any) => ({
                ...p,
                amount: Number(p?.amount ?? 0),
                method: this.mapMethodToString(p?.method)
              }))
            : [];
        })
      );
  }

  recordPayment(payload: CreatePaymentDto): Observable<Payment> {
    if (!this.http) return of({} as Payment);
    return this.http.post<Payment>(`${this.apiUrl}/payments`, payload).pipe(
      tap(() => {
        this.getInvoices();
      })
    );
  }
}
