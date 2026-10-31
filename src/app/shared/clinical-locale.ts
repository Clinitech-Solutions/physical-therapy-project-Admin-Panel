import { ReceptionistLocale } from "./receptionist-locale";

/** Clinic times do not change when a clinician's device uses another time zone. */
export class ClinicalLocale extends ReceptionistLocale {
  override date(
    value: string | Date | null | undefined,
    withTime = false,
  ): string {
    if (!value) return "—";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "—";
    return date.toLocaleString(this.language, {
      timeZone: "Africa/Cairo",
      year: "numeric",
      month: "short",
      day: "numeric",
      ...(withTime ? ({ hour: "2-digit", minute: "2-digit" } as const) : {}),
    });
  }
  time(value: string): string {
    return new Date(value).toLocaleTimeString(this.language, {
      timeZone: "Africa/Cairo",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}
