import { inject, Injectable, InjectionToken } from "@angular/core";
import { ReceptionError } from "./reception-api";

export interface ReceptionEnumDefinitions {
  appointmentStatus?: Record<string, number>;
  invoiceStatus?: Record<string, number>;
  invoiceType?: Record<string, number>;
  paymentMethod?: Record<string, number>;
  sessionStatus?: Record<string, number>;
}
/** Populate only from authoritative backend definitions, never inferred enum order. */
export const RECEPTION_ENUMS = new InjectionToken<ReceptionEnumDefinitions>(
  "Verified reception enums",
  { providedIn: "root", factory: () => ({}) },
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
    if (typeof value === "string" && !/^\d+$/.test(value)) return value;
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
