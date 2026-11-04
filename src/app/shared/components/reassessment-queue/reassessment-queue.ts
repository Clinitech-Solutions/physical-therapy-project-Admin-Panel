import {
  Component,
  inject,
  input,
  OnInit,
  output,
  signal,
  computed,
  DestroyRef,
  ElementRef,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { firstValueFrom } from "rxjs";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  DoctorWorkspaceService,
  clinicalError,
} from "../../../core/services/doctor-workspace.service";
import { ReassessmentRequest } from "../../../core/models/doctor-workspace.model";
import { ClinicalLocale } from "../../clinical-locale";
import { PatientAvatar } from "../../../features/doctor/patient-avatar";

@Component({
  selector: "app-reassessment-queue",
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, PatientAvatar],
  template: `@if (!review()) {
      <section class="review-queue legacy-queue">
        <header>
          <h2>
            {{ "DOCTOR.REASSESSMENT_QUEUE" | translate }}
            @if (!loading() && !error()) {
              <span class="queue-count"
                >{{ pending() }}
                {{ "DOCTOR.PENDING_REVIEWS" | translate }}</span
              >
            }
          </h2>
          <button
            type="button"
            class="btn btn-outline-secondary"
            [disabled]="loading()"
            (click)="load()"
          >
            {{ "DOCTOR.REFRESH" | translate }}
          </button>
        </header>
        <p>{{ "DOCTOR.REVIEW_NO_FINANCE" | translate }}</p>
        <label class="history-toggle"
          ><input
            type="checkbox"
            [checked]="includeHistory()"
            (change)="includeHistory.set($any($event.target).checked)"
          />
          {{ "DOCTOR.INCLUDE_REVIEW_HISTORY" | translate }}</label
        >
        @if (loading()) {
          <p role="status">{{ "DOCTOR.LOADING" | translate }}</p>
        }
        @if (error()) {
          <p role="alert">
            {{ error() }}
            <button
              type="button"
              class="btn btn-outline-secondary"
              (click)="load()"
            >
              {{ "DOCTOR.RETRY" | translate }}
            </button>
          </p>
        }
        @if (!loading() && !error()) {
          @for (r of legacyVisible(); track r.id) {
            <article [attr.data-review-id]="r.id">
              <app-patient-avatar [name]="r.patientName" />
              <div class="request-context">
                <strong>{{ r.patientName }}</strong
                ><span class="request-status" [attr.data-state]="r.state">{{
                  "DOCTOR.REVIEW_STATES." + r.state | translate
                }}</span>
                <p>
                  {{ "DOCTOR.REASONS." + r.reasonCategory | translate }} ·
                  {{ r.requestedBy }} · {{ locale.date(r.requestedAt, true) }}
                </p>
                <small
                  >{{
                    "DOCTOR.RECOMMENDATIONS." + r.recommendation | translate
                  }}
                  · {{ "DOCTOR.RECOMMENDATION_ONLY" | translate }}</small
                >
              </div>
              @if (review()) {
                <a
                  class="btn btn-primary"
                  routerLink="/senior/re-assessment-form"
                  [queryParams]="{ requestId: r.id }"
                  >{{
                    (r.state === "Completed"
                      ? "DOCTOR.VIEW_REVIEW_RESULT"
                      : "DOCTOR.OPEN_REVIEW"
                    ) | translate
                  }}</a
                >
              }
            </article>
          } @empty {
            <p>
              {{
                (includeHistory()
                  ? "DOCTOR.NO_REVIEWS"
                  : "DOCTOR.NO_PENDING_REVIEWS"
                ) | translate
              }}
            </p>
          }
        }
      </section>
    } @else {
      <section
        class="review-queue"
        [class.embedded]="embedded()"
        [attr.aria-label]="'DOCTOR.REASSESSMENT_QUEUE' | translate"
      >
        @if (!embedded()) {
          <h2>{{ "DOCTOR.REASSESSMENT_QUEUE" | translate }}</h2>
        }
        <div class="queue-toolbar">
          <div
            class="queue-filters"
            role="group"
            [attr.aria-label]="'SENIOR_REVIEW.FILTER_LABEL' | translate"
          >
            @for (value of ["open", "history"]; track value) {
              <button
                type="button"
                [class.selected]="filter() === value"
                [attr.aria-pressed]="filter() === value"
                (click)="selectFilter(value === 'history' ? 'history' : 'open')"
              >
                {{
                  (value === "open"
                    ? "SENIOR_REVIEW.OPEN"
                    : "SENIOR_REVIEW.HISTORY"
                  ) | translate
                }}
              </button>
            }
          </div>
          <button
            type="button"
            class="btn btn-outline-secondary queue-refresh"
            [disabled]="loading()"
            (click)="load()"
            [attr.aria-label]="'SENIOR_REVIEW.REFRESH_REQUESTS' | translate"
          >
            <i class="bi bi-arrow-clockwise" aria-hidden="true"></i
            ><span>{{ "DOCTOR.REFRESH" | translate }}</span>
          </button>
        </div>
        @if (loading() && !rows().length) {
          <p class="queue-state" role="status">
            {{ "DOCTOR.LOADING" | translate }}
          </p>
        }
        @if (error()) {
          <p class="queue-error" role="alert">
            {{ error() }} {{ "SENIOR_REVIEW.REFRESH_HELP" | translate }}
          </p>
        }
        @if (!error() && (rows().length || !loading())) {
          @for (r of visible(); track r.id) {
            <article class="request-row" [attr.data-review-id]="r.id">
              <app-patient-avatar [name]="r.patientName" />
              <div class="request-context">
                <div class="request-title">
                  <strong>{{ r.patientName }}</strong
                  ><span class="request-status" [attr.data-state]="r.state">{{
                    "DOCTOR.REVIEW_STATES." + r.state | translate
                  }}</span>
                </div>
                <p>{{ "DOCTOR.REASONS." + r.reasonCategory | translate }}</p>
                <small
                  >{{ r.requestedBy }} &middot;
                  <time [attr.datetime]="r.requestedAt">{{
                    locale.date(r.requestedAt, true)
                  }}</time></small
                >
              </div>
              @if (review()) {
                <a
                  class="btn btn-outline-primary request-action"
                  [attr.data-review-link]="r.id"
                  routerLink="/senior/re-assessment-form"
                  [queryParams]="{
                    requestId: r.id,
                    origin: origin(),
                    reviewFilter: filter(),
                  }"
                  [attr.aria-label]="
                    ((r.state === 'Completed' || r.state === 'Cancelled'
                      ? 'DOCTOR.VIEW_REVIEW_RESULT'
                      : 'DOCTOR.OPEN_REVIEW'
                    ) | translate) +
                    ': ' +
                    r.patientName
                  "
                  >{{
                    (r.state === "Completed" || r.state === "Cancelled"
                      ? "DOCTOR.VIEW_REVIEW_RESULT"
                      : "DOCTOR.OPEN_REVIEW"
                    ) | translate
                  }}</a
                >
              }
            </article>
          } @empty {
            <p class="queue-state">
              {{
                (filter() === "history"
                  ? "SENIOR_REVIEW.NO_HISTORY"
                  : "DOCTOR.NO_PENDING_REVIEWS"
                ) | translate
              }}
            </p>
          }
        }
      </section>
    }`,
  styleUrl: "./reassessment-queue.css",
})
export class ReassessmentQueue implements OnInit {
  pendingCount = output<number | null>();
  review = input(false);
  embedded = input(false);
  origin = input<"dashboard" | "queue">("queue");
  private api = inject(DoctorWorkspaceService);
  private translate = inject(TranslateService);
  private route = inject(ActivatedRoute, { optional: true });
  private router = inject(Router, { optional: true });
  private host = inject<ElementRef<HTMLElement>>(ElementRef, {
    optional: true,
  });
  private destroy = inject(DestroyRef);
  readonly locale = new ClinicalLocale();
  readonly loading = signal(false);
  readonly error = signal("");
  readonly rows = signal<ReassessmentRequest[]>([]);
  readonly filter = signal<"open" | "history">("open");
  readonly includeHistory = signal(false);
  readonly legacyVisible = computed(() =>
    [...this.rows()]
      .filter(
        (r) =>
          this.includeHistory() || ["Requested", "InReview"].includes(r.state),
      )
      .sort((a, b) => {
        const priority = (r: ReassessmentRequest) =>
          r.state === "InReview" ? 0 : r.state === "Requested" ? 1 : 2;
        return (
          priority(a) - priority(b) ||
          Date.parse(b.requestedAt) - Date.parse(a.requestedAt)
        );
      }),
  );
  readonly pending = computed(
    () =>
      this.rows().filter((r) => ["Requested", "InReview"].includes(r.state))
        .length,
  );
  readonly visible = computed(() =>
    [...this.rows()]
      .filter((r) =>
        this.filter() === "open"
          ? ["Requested", "InReview"].includes(r.state)
          : ["Completed", "Cancelled"].includes(r.state),
      )
      .sort((a, b) => {
        const priority = (r: ReassessmentRequest) =>
          r.state === "InReview" ? 0 : r.state === "Requested" ? 1 : 2;
        return (
          priority(a) - priority(b) ||
          Date.parse(b.resolvedAt ?? b.requestedAt) -
            Date.parse(a.resolvedAt ?? a.requestedAt)
        );
      }),
  );
  private focusId = 0;
  private focusRestored = false;
  ngOnInit() {
    this.route?.queryParamMap
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((params) => {
        this.filter.set(
          params.get("reviewFilter") === "history" ? "history" : "open",
        );
        this.focusId = Number(params.get("focusReview")) || 0;
        if (this.rows().length) this.restoreFocus();
      });
    void this.load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void this.load();
    }, 30000);
    this.destroy.onDestroy(() => clearInterval(timer));
  }
  selectFilter(value: "open" | "history") {
    this.filter.set(value);
    if (this.router && this.route)
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { reviewFilter: value },
        queryParamsHandling: "merge",
        replaceUrl: true,
      });
  }
  private restoreFocus() {
    if (!this.focusId || this.focusRestored || !this.host) return;
    this.focusRestored = true;
    requestAnimationFrame(() => {
      if (this.destroy.destroyed) return;
      const row = this.host?.nativeElement.querySelector<HTMLElement>(
        '[data-review-link="' + this.focusId + '"]',
      );
      (
        row ?? document.getElementById("senior-task-tab-reassessments")
      )?.focus();
    });
  }
  async load() {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set("");
    this.pendingCount.emit(null);
    try {
      this.rows.set(await firstValueFrom(this.api.requests()));
      this.pendingCount.emit(this.pending());
    } catch (e) {
      this.rows.set([]);
      this.error.set(clinicalError(e, this.translate));
      this.pendingCount.emit(null);
    } finally {
      this.loading.set(false);
      this.restoreFocus();
    }
  }
}
