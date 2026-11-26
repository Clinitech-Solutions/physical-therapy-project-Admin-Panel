import { PrintService } from '../../../shared/printing/print.service';
import { PrintButtonComponent } from '../../../shared/printing/print-button.component';
import { firstValueFrom as printValue } from 'rxjs';
import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { catchError, of, switchMap, tap } from "rxjs";
import {
  CeoReport,
  CeoWorkspaceService,
  Filters,
  ReportRow,
} from "../../../core/services/ceo-workspace.service";
import { CeoLocale } from "../workspace/ceo-locale";

@Component({
  selector: "app-ceo-reports",
  standalone: true,
  imports: [FormsModule, RouterLink, PrintButtonComponent],
  templateUrl: "./reports.html",
  styleUrl: "../workspace/workspace.css",
})
export class Reports {
  readonly printer = inject(PrintService);
  readonly preparePrint = async () => {
    const kind=this.kind, filters={...this.applied}, data=this.data();
    this.printer.limit(data?.total ?? 0);
    const scope=[this.printer.t(data?.dateBasis ?? ''),this.printer.t(data?.scope ?? ''),...this.chips.map(([k,v])=>this.label(k)+': '+(k==='clinicianId'?(this.options().clinicians.find(c=>c.id===v)?.name ?? this.t('Unavailable')):k==='companyId'?(this.options().companies.find(c=>c.id===Number(v))?.name ?? String(v)):this.t(String(v))))];
    return this.printer.csv(await printValue(this.api.export(kind,filters)),this.t(this.kinds.find(k=>k[0]===kind)?.[1] ?? 'Reports'),scope,kind);
  };
  readonly api = inject(CeoWorkspaceService);
  readonly locale = new CeoLocale();
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly data = signal<CeoReport | null>(null);
  readonly loading = signal(false);
  readonly error = signal("");
  readonly exporting = signal(false);
  readonly options = signal<{
    companies: { id: number; name: string }[];
    clinicians: { id: string; name: string }[];
  }>({ companies: [], clinicians: [] });
  readonly optionsError = signal("");
  kinds = [
    ["patient-collections", "Patient collections"],
    ["insurer-collections", "Insurer collections"],
    ["patient-outstanding", "Patient outstanding"],
    ["insurer-receivables", "Earned insurer receivables"],
    ["activity", "Appointment activity"],
    ["workload", "Clinician workload"],
    ["statements", "Monthly insurer statements"],
  ];
  kind = "patient-collections";
  filtersOpen = false;
  applied: Filters = {};
  draft: Filters = {};
  detail: ReportRow | null = null;
  constructor() {
    this.loadOptions();
    this.route.queryParamMap
      .pipe(
        tap((p) => {
          this.kind = p.get("kind") ?? "patient-collections";
          this.applied = {};
          for (const k of p.keys) {
            const v = p.get(k);
            if (k !== "kind" && k !== "retry" && v) this.applied[k] = v;
          }
          if (!this.balance && !this.statement) {
            this.applied["to"] ??= this.locale.today();
            this.applied["from"] ??=
              String(this.applied["to"]).slice(0, 7) + "-01";
          }
          this.draft = { ...this.applied };
          this.data.set(null);
          this.error.set("");
          this.loading.set(!this.statement);
          this.detail = null;
        }),
        switchMap(() =>
          this.statement
            ? of(null)
            : this.api.report(this.kind, this.applied).pipe(
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
  get balance() {
    return (
      this.kind === "patient-outstanding" || this.kind === "insurer-receivables"
    );
  }
  get activity() {
    return this.kind === "activity" || this.kind === "workload";
  }
  get statement() {
    return this.kind === "statements";
  }
  loadOptions() {
    this.optionsError.set("");
    this.api
      .reportOptions()
      .subscribe({
        next: (x) => this.options.set(x),
        error: (e) =>
          this.optionsError.set(
            this.locale.failure(e, "Could not load data. Retry."),
          ),
      });
  }
  get chips() {
    return Object.entries(this.applied).filter(
      ([k, v]) => k !== "page" && v !== "" && v != null,
    );
  }
  label(k: string) {
    return this.t(
      (
        {
          from: "From",
          to: "To",
          search: "Search",
          patientId: "Patient ID",
          companyId: "Company ID",
          clinicianId: "Clinician ID",
          funding: "Funding",
          status: "Status",
          method: "Method",
        } as Record<string, string>
      )[k] ?? k,
    );
  }
  changeKind() {
    this.applied = {};
    this.draft = {};
    this.navigate();
  }
  navigate(extra: Filters = {}) {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { kind: this.kind, ...this.applied, ...extra },
    });
  }
  retry() {
    this.navigate({ retry: Date.now() });
  }
  apply() {
    this.applied = { ...this.draft, page: 1 };
    this.filtersOpen = false;
    this.navigate();
  }
  clear() {
    this.applied = {};
    this.navigate();
  }
  remove(key: string) {
    delete this.applied[key];
    this.navigate({ page: 1 });
  }
  page(step: number) {
    this.navigate({ page: (this.data()?.page ?? 1) + step });
  }
  export() {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.error.set("");
    this.api.export(this.kind, this.applied).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "ceo-" + this.kind + ".csv";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.exporting.set(false);
      },
      error: (e) => {
        this.error.set(this.locale.failure(e, "Could not load data. Retry."));
        this.exporting.set(false);
      },
    });
  }
  get pageCount() {
    return Math.max(
      1,
      Math.ceil((this.data()?.total ?? 0) / (this.data()?.pageSize ?? 20)),
    );
  }
}
