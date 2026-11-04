import { DestroyRef, inject, Injectable, signal } from "@angular/core";

/** Display only: elapsed time is always based on the persisted clinical start. */
@Injectable({ providedIn: "root" })
export class ClinicalClock {
  now = signal(Date.now());
  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 30000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
  minutes(start: string | null, end?: string | null): number | null {
    if (!start) return null;
    const delta = (end ? Date.parse(end) : this.now()) - Date.parse(start);
    return Number.isFinite(delta)
      ? Math.max(0, Math.floor(delta / 60000))
      : null;
  }
}
