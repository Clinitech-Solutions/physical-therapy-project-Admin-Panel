import { TableLoadingComponent } from '../../../../shared/table-ui/table-ui';
import { ActionButtonDirective } from '../../../../shared/action-ui/action-button';
import { TableEmptyComponent, TablePagerComponent, TablePresentationDirective, TableRegionDirective } from '../../../../shared/table-ui/table-ui';
import { CeoNotifications } from "../../../../core/services/ceo-notifications";
import { Component, ElementRef, inject, signal } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { catchError, of, switchMap, tap } from "rxjs";
import {
  CeoWorkspaceService,
  StaffRow,
  StaffPage,
  Filters,
} from "../../../../core/services/ceo-workspace.service";
import { UserService } from "../../../../core/services/user.service";
import { AddUserComponent } from "../add-user/add-user.component";
import { StaffWorkingHoursComponent } from "../staff-working-hours/staff-working-hours";
import {
  validStaffWorkingHours,
  serializeStaffWorkingHours,
} from "../../../../core/models/staff-working-hours.model";
import { CeoLocale } from "../../workspace/ceo-locale";

@Component({
  selector: "app-staff-list",
  standalone: true,
  imports: [TableLoadingComponent, ActionButtonDirective, TableEmptyComponent, TablePagerComponent, TablePresentationDirective, TableRegionDirective,
    FormsModule,
    RouterLink,
    AddUserComponent,
    StaffWorkingHoursComponent,
  ],
  templateUrl: "./staff-list.component.html",
  styleUrl: "../../workspace/workspace.css",
})
export class StaffListComponent {
  readonly api = inject(CeoWorkspaceService);
  readonly users = inject(UserService);
  readonly locale = new CeoLocale();
  readonly notices = inject(CeoNotifications);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly element: ElementRef<HTMLElement> = inject(ElementRef);
  readonly data = signal<StaffPage | null>(null);
  readonly loading = signal(false);
  readonly error = signal("");
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly roles = [
    "Admin",
    "Owner",
    "Doctor",
    "Senior",
    "Receptionist",
    "Ceo",
  ];
  draft: Filters = {};
  applied: Filters = {};
  filtersOpen = false;
  showAddForm = false;
  selected: StaffRow | null = null;
  statusTarget: StaffRow | null = null;
  dialogError = "";
  private focusBefore: HTMLElement | null = null;
  constructor() {
    this.route.queryParamMap
      .pipe(
        tap((p) => {
          this.applied = {};
          for (const k of ["search", "role", "active", "page"])
            if (p.get(k) != null) this.applied[k] = p.get(k);
          this.draft = { ...this.applied };
          this.loading.set(true);
          this.error.set("");
          this.data.set(null);
        }),
        switchMap(() =>
          this.api.staff(this.applied).pipe(
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
      ([k, v]) => k !== "page" && v !== null && v !== undefined && v !== "",
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
  added() {
    this.showAddForm = false;
    this.saved.set(true);
    this.refresh();
  }
  show() {
    this.focusBefore = document.activeElement as HTMLElement;
    this.dialogError = "";
    setTimeout(() =>
      this.element.nativeElement
        .querySelector<HTMLDialogElement>("dialog")
        ?.showModal(),
    );
  }
  edit(row: StaffRow) {
    this.selected = structuredClone(row);
    this.show();
  }
  reviewStatus(row: StaffRow) {
    this.statusTarget = row;
    this.show();
  }
  close(event?: Event) {
    event?.preventDefault();
    if (this.saving()) return;
    this.element.nativeElement
      .querySelector<HTMLDialogElement>("dialog")
      ?.close();
    this.selected = null;
    this.statusTarget = null;
    this.focusBefore?.focus();
  }
  setRole(role: string, event: Event) {
    if (!this.selected) return;
    this.selected.roles = (event.target as HTMLInputElement).checked
      ? [...this.selected.roles, role]
      : this.selected.roles.filter((r) => r !== role);
  }
  save(form: NgForm) {
    if (this.saving() || !this.selected) return;
    const row = this.selected;
    if (
      form.invalid ||
      !row.roles.length ||
      !row.fullName.trim() ||
      !row.userName.trim() ||
      !validStaffWorkingHours(row.workingHours ?? [])
    ) {
      form.control.markAllAsTouched();
      this.dialogError = this.t("Enter the required fields.");
      return;
    }
    this.saving.set(true);
    this.dialogError = "";
    this.users
      .updateUser({
        ...row,
        userId: row.id,
        gender:
          row.gender === "Male"
            ? 0
            : row.gender === "Female"
              ? 1
              : Number(row.gender),
        workingHours: serializeStaffWorkingHours(row.workingHours ?? []),
      })
      .subscribe({
        next: () => this.finished(),
        error: (e) => {
          this.saving.set(false);
          this.dialogError = this.locale.failure(e);
          this.notices.show(this.dialogError);
        },
      });
  }
  status() {
    if (this.saving() || !this.statusTarget) return;
    this.saving.set(true);
    this.dialogError = "";
    this.api.status(this.statusTarget, !this.statusTarget.isActive).subscribe({
      next: () => this.finished(),
      error: (e) => {
        this.saving.set(false);
        this.dialogError = this.locale.failure(e);
        this.notices.show(this.dialogError);
      },
    });
  }
  private finished() {
    this.saving.set(false);
    this.close();
    this.saved.set(true);
    this.refresh();
  }
}
