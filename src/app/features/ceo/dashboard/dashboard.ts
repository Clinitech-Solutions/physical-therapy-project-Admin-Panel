import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { switchMap, catchError, of, tap } from "rxjs";
import {
  CeoWorkspaceService,
  Overview,
} from "../../../core/services/ceo-workspace.service";
import { CeoLocale } from "../workspace/ceo-locale";

@Component({
  selector: "app-ceo-dashboard",
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: "./dashboard.html",
  styleUrl: "../workspace/workspace.css",
})
export class Dashboard {
  readonly api = inject(CeoWorkspaceService);
  readonly locale = new CeoLocale();
  readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  readonly data = signal<Overview | null>(null);
  readonly loading = signal(true);
  readonly error = signal("");
  from = "";
  to = "";
  constructor() {
    this.route.queryParamMap
      .pipe(
        tap((p) => {
          this.to = p.get("to") ?? this.locale.today();
          this.from = p.get("from") ?? this.to.slice(0, 7) + "-01";
          this.loading.set(true);
          this.error.set("");
          this.data.set(null);
        }),
        switchMap(() =>
          this.api.overview({ from: this.from, to: this.to }).pipe(
            catchError((e) => {
              this.error.set(
                this.locale.failure(e, "Could not load data. Retry."),
              );
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((x) => {
        this.data.set(x);
        this.loading.set(false);
      });
  }
  t(s: string) {
    return this.locale.t(s);
  }
  money(n: number) {
    return this.locale.money(n);
  }
  apply() {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { from: this.from, to: this.to },
    });
  }
  retry() {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { from: this.from, to: this.to, retry: Date.now() },
    });
  }
  report(kind: string, period = true) {
    return {
      kind,
      ...(period ? { from: this.data()?.from, to: this.data()?.to } : {}),
    };
  }
  get chart() {
    return this.data()?.collections.filter((x) => x.patient || x.insurer) ?? [];
  }
  get chartMax() {
    return Math.max(1, ...this.chart.flatMap((x) => [x.patient, x.insurer]));
  }
}
