import {
  Component,
  inject,
  input,
  OnInit,
  output,
  signal,
  computed,
  DestroyRef,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { firstValueFrom } from "rxjs";
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
  template: `<section class="review-queue">
    <header>
      <h2>
        {{ "DOCTOR.REASSESSMENT_QUEUE" | translate }}
        @if (!loading() && !error()) {
          <span class="queue-count"
            >{{ pending() }} {{ "DOCTOR.PENDING_REVIEWS" | translate }}</span
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
      @for (r of visible(); track r.id) {
        <article [attr.data-review-id]="r.id">
          <app-patient-avatar [name]="r.patientName" />
          <div class="request-context">
            <strong>{{ r.patientName }}</strong
            ><span class="request-status" [attr.data-state]="r.state">{{ "DOCTOR.REVIEW_STATES." + r.state | translate }}</span>
            <p>
              {{ "DOCTOR.REASONS." + r.reasonCategory | translate }} ·
              {{ r.requestedBy }} · {{ locale.date(r.requestedAt, true) }}
            </p>
            <small
              >{{ "DOCTOR.RECOMMENDATIONS." + r.recommendation | translate }} ·
              {{ "DOCTOR.RECOMMENDATION_ONLY" | translate }}</small
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
  </section>`,
  styles: `
    :host {
      display: block;
    }
    .review-queue {
      padding: 18px;
      border: 1px solid var(--border-color);
      border-radius: 12px;
      background: var(--bg-card);
      color: var(--text-primary);
      margin-bottom: 20px;
    }
    .review-queue header {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: center;
    }
    .review-queue h2 {
      font-size: 18px;
      margin: 0;
    }
    .review-queue p,
    .review-queue small {
      color: var(--text-secondary);
      font-size: 13px;
      margin: 6px 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .review-queue article {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 12px 0;
      border-top: 1px solid var(--border-color);
      margin-top: 10px;
    }
    .review-queue article span {
      margin-inline-start: 10px;
      font-size: 12px;
      color: var(--mq-teal);
    }
    .request-status {
      display: inline-block;
      border-radius: 6px;
      padding: 3px 7px;
      background: color-mix(in srgb, var(--mq-teal) 10%, var(--bg-card));
    }
    .request-status[data-state='Requested'] { color: var(--color-primary, #0665db); background: color-mix(in srgb, var(--color-primary, #0665db) 10%, var(--bg-card)); }
    .request-status[data-state='Cancelled'] { color: var(--text-secondary); background: var(--bg-secondary); }
    .request-context {
      flex: 1;
      min-width: 0;
    }
    .queue-count {
      display: inline-block;
      margin-inline-start: 8px;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-secondary);
    }
    .history-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--text-secondary);
      margin-block: 10px;
    }
    .history-toggle input {
      width: 16px;
      height: 16px;
      accent-color: var(--mq-teal);
    }
    .review-queue .btn {
      min-height: 42px;
      flex-shrink: 0;
    }
    @media (max-width: 600px) {
      .review-queue article {
        align-items: start;
        flex-wrap: wrap;
      }
      .request-context {
        flex-basis: calc(100% - 60px);
      }
      .review-queue article a {
        margin-inline-start: 60px;
      }
    }
  `,
})
export class ReassessmentQueue implements OnInit {
  pendingCount = output<number | null>();
  review = input(false);
  private api = inject(DoctorWorkspaceService);
  private translate = inject(TranslateService);
  readonly locale = new ClinicalLocale();
  readonly loading = signal(false);
  readonly error = signal("");
  readonly rows = signal<ReassessmentRequest[]>([]);
  readonly includeHistory = signal(false);
  readonly pending = computed(
    () =>
      this.rows().filter((r) => ["Requested", "InReview"].includes(r.state))
        .length,
  );
  readonly visible = computed(() =>
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
  private destroy = inject(DestroyRef);
  ngOnInit() {
    void this.load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void this.load();
    }, 30000);
    this.destroy.onDestroy(() => clearInterval(timer));
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
    }
  }
}
