import { CeoNotifications } from "../../../core/services/ceo-notifications";
import { Component, ElementRef, inject, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { FormsModule, NgForm } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { catchError, of, switchMap, tap } from "rxjs";
import {
  CeoWorkspaceService,
  Filters,
} from "../../../core/services/ceo-workspace.service";
import {
  InsuranceService,
  InsuranceCompany,
} from "../../../core/services/insurance.service";
import { environment } from "../../../../environments/environment";
import { CeoLocale } from "../workspace/ceo-locale";
interface CompanyRow extends InsuranceCompany {
  id: number;
  linkedPatients: number;
}
interface CompanyPage {
  items: CompanyRow[];
  total: number;
  page: number;
  pageSize: number;
}
@Component({
  selector: "app-insurance-management",
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: "./insurance-management.component.html",
  styleUrl: "../workspace/workspace.css",
})
export class InsuranceManagementComponent {
  readonly locale = new CeoLocale();
  readonly notices = inject(CeoNotifications);
  readonly api = inject(CeoWorkspaceService);
  private readonly companies = inject(InsuranceService);
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly element: ElementRef<HTMLElement> = inject(ElementRef);
  readonly data = signal<CompanyPage | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal("");
  applied: Filters = {};
  draft: Filters = {};
  filtersOpen = false;
  model: InsuranceCompany | null = null;
  dialogError = "";
  private focusBefore: HTMLElement | null = null;
  constructor() {
    this.route.queryParamMap
      .pipe(
        tap((p) => {
          this.applied = {};
          for (const k of ["search", "active", "page"])
            if (p.get(k) != null) this.applied[k] = p.get(k);
          this.draft = { ...this.applied };
          this.loading.set(true);
          this.error.set("");
          this.data.set(null);
        }),
        switchMap(() =>
          this.http
            .get<CompanyPage>(
              environment.apiUrl + "/InsuranceCompanies/Search",
              { params: this.api.params(this.applied) },
            )
            .pipe(
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
  get chips() {
    return Object.entries(this.applied).filter(
      ([k, v]) => k !== "page" && v !== "" && v != null,
    );
  }
  get pageCount() {
    return Math.max(
      1,
      Math.ceil((this.data()?.total ?? 0) / (this.data()?.pageSize ?? 20)),
    );
  }
  navigate(extra: Filters = {}) {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...this.applied, ...extra },
    });
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
  remove(k: string) {
    delete this.applied[k];
    this.navigate({ page: 1 });
  }
  refresh() {
    this.navigate({ refresh: Date.now() });
  }
  page(step: number) {
    this.navigate({ page: (this.data()?.page ?? 1) + step });
  }
  open(row?: InsuranceCompany) {
    this.focusBefore = document.activeElement as HTMLElement;
    this.dialogError = "";
    this.model = row
      ? structuredClone(row)
      : { name: "", portalUrl: null, hotline: "", isActive: true };
    setTimeout(() =>
      this.element.nativeElement
        .querySelector<HTMLDialogElement>("dialog")
        ?.showModal(),
    );
  }
  close(event?: Event) {
    event?.preventDefault();
    if (this.saving()) return;
    this.element.nativeElement
      .querySelector<HTMLDialogElement>("dialog")
      ?.close();
    this.model = null;
    this.focusBefore?.focus();
  }
  save(form: NgForm) {
    if (this.saving() || !this.model) return;
    if (form.invalid || !this.model.name.trim()) {
      form.control.markAllAsTouched();
      this.dialogError = this.t("Enter the required fields.");
      return;
    }
    this.saving.set(true);
    this.dialogError = "";
    const m = this.model;
    const request = m.id
      ? this.companies.updateCompany(m.id, m)
      : this.companies.addCompany(m);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.close();
        this.saved.set(true);
        this.refresh();
      },
      error: (e) => {
        this.saving.set(false);
        this.dialogError = this.locale.failure(e);
        this.notices.show(this.dialogError);
      },
    });
  }
}
