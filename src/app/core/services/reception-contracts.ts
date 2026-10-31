import { inject, Injectable, InjectionToken } from "@angular/core";
import { ReceptionError } from "./reception-api";

export interface ReceptionEnumDefinitions {
  appointmentStatus?: Record<string, number>;
  invoiceStatus?: Record<string, number>;
  invoiceType?: Record<string, number>;
  paymentMethod?: Record<string, number>;
  sessionStatus?: Record<string, number>;
  assessmentSeverity?: Record<string, number>;
  planStatus?: Record<string, number>;
  paymentStatus?: Record<string, number>;
}
/** Verified in the sibling backend's Domain/Entities/Enums/Enums.cs. Existing numeric values are preserved. */
export const BACKEND_RECEPTION_ENUMS: ReceptionEnumDefinitions = {
  appointmentStatus: { Pending: 0, Completed: 1, Cancelled: 2, NoShow: 3, 'In Progress': 4 },
  invoiceStatus: { Pending: 0, Paid: 1, Cancelled: 2, Waived: 3 },
  invoiceType: { Assessment: 0, Session: 1, Installment: 2 },
  paymentMethod: { Cash: 0, Visa: 1, EWallet: 2, BankTransfer: 3, Insurance: 4, Online: 5 },
  sessionStatus: { Pending: 0, 'In Progress': 1, Completed: 2, Cancelled: 3 },
  assessmentSeverity: { Low: 0, Medium: 1, High: 2 },
  planStatus: { Active: 0, Inactive: 1 },
  paymentStatus: { Pending: 0, Paid: 1, PackageCovered: 2 },
};
export function backendEnumNumber(kind: keyof ReceptionEnumDefinitions, value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return BACKEND_RECEPTION_ENUMS[kind]?.[value === 'InProgress' ? 'In Progress' : value] ?? value;
}
/** Populate only from authoritative backend definitions, never inferred enum order. */
export const RECEPTION_ENUMS = new InjectionToken<ReceptionEnumDefinitions>(
  "Verified reception enums",
  { providedIn: "root", factory: () => BACKEND_RECEPTION_ENUMS },
);
@Injectable({ providedIn: "root" })
export class ReceptionContracts {
  readonly enums = inject(RECEPTION_ENUMS);
  value(kind: keyof ReceptionEnumDefinitions, label: string | number): number {
    const entries = this.enums[kind];
    const value =
      typeof label === "number"
        ? Object.values(entries ?? {}).includes(label)
          ? label
          : undefined
        : entries?.[label];
    if (value === undefined)
      throw new ReceptionError(
        "ENUM_DEFINITION_PENDING",
        "This operation needs a confirmed backend status or payment method definition.",
      );
    return value;
  }
  label(kind: keyof ReceptionEnumDefinitions, value: unknown): string {
    if (typeof value === "string" && !/^\d+$/.test(value)) return value === 'InProgress' ? 'In Progress' : value;
    return (
      Object.entries(this.enums[kind] ?? {}).find(
        ([, n]) => n === Number(value),
      )?.[0] ?? "Unknown"
    );
  }
  has(kind: keyof ReceptionEnumDefinitions, label: string): boolean {
    return this.enums[kind]?.[label] !== undefined;
  }
}
