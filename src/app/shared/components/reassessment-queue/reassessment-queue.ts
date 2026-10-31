import {
  Component,
  inject,
  input,
  OnInit,
  output,
  signal,
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

@Component({
  selector: "app-reassessment-queue",
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  template: `<section class="review-queue">
    <header>
      <h2>{{ "DOCTOR.REASSESSMENT_QUEUE" | translate }}</h2>
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
      @for (r of rows(); track r.id) {
        <article>
          <div>
            <strong>{{ r.patientName }}</strong
            ><span>{{ "DOCTOR.REVIEW_STATES." + r.state | translate }}</span>
            <p>
              {{ "DOCTOR.REASONS." + r.reasonCategory | translate }} ·
              {{ r.requestedBy }} · {{ locale.date(r.requestedAt, true) }}
            </p>
            <p>{{ r.notes }}</p>
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
              >{{ "DOCTOR.OPEN_REVIEW" | translate }}</a
            >
          }
        </article>
      } @empty {
        <p>{{ "DOCTOR.NO_PENDING_REVIEWS" | translate }}</p>
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
    .review-queue .btn {
      min-height: 42px;
      flex-shrink: 0;
    }
    @media (max-width: 600px) {
      .review-queue article {
        align-items: start;
        flex-direction: column;
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
  ngOnInit() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set("");
    this.pendingCount.emit(null);
    try {
      this.rows.set(
        (await firstValueFrom(this.api.requests())).filter(
          (r) => r.state === "Requested" || r.state === "InReview",
        ),
      );
      this.pendingCount.emit(this.rows().length);
    } catch (e) {
      this.rows.set([]);
      this.error.set(clinicalError(e, this.translate));
      this.pendingCount.emit(null);
    } finally {
      this.loading.set(false);
    }
  }
}
