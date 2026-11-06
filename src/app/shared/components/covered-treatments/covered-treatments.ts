import { Component, DestroyRef, inject, OnInit, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { interval } from "rxjs";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  DoctorWorkspaceService,
  clinicDate,
} from "../../../core/services/doctor-workspace.service";
import { DoctorSchedule } from "../../../core/models/doctor-workspace.model";
import { PatientAvatar } from "../../../features/doctor/patient-avatar";

@Component({
  selector: "app-covered-treatments",
  standalone: true,
  imports: [RouterLink, TranslateModule, PatientAvatar],
  template: `<section class="covered-treatments">
    <header>
      <h4>{{ "ABSENCE.COVERED_TREATMENTS" | translate }}</h4>
      <button
        type="button"
        class="btn btn-outline-secondary"
        [disabled]="loading()"
        (click)="load()"
        [attr.aria-label]="'ABSENCE.REFRESH' | translate"
      >
        <i class="bi bi-arrow-clockwise" aria-hidden="true"></i>
      </button>
    </header>
    @if (error()) {
      <p role="alert">{{ "ABSENCE.REQUEST_FAILED" | translate }}</p>
    } @else if (loading() && !data()) {
      <p role="status">{{ "ABSENCE.LOADING" | translate }}</p>
    }
    @for (visit of data()?.appointments; track visit.appointmentId) {
      @if (visit.coveringTreatment) {
        <article>
          <app-patient-avatar [name]="visit.patientName" />
          <div>
            <strong>{{ visit.patientName }}</strong
            ><small
              >{{ "ABSENCE.COVERING_TREATMENT" | translate }} ·
              {{ time(visit.plannedStart) }} · {{ visit.roomName }}</small
            >
            @if (visit.needsAttention) {
              <span class="warning">{{
                "ABSENCE.NEEDS_ATTENTION" | translate
              }}</span>
            }
          </div>
          <a
            class="btn btn-outline-primary"
            [routerLink]="['/senior/session-notes', visit.appointmentId]"
            >{{ "ABSENCE.OPEN_TREATMENT" | translate }}</a
          >
        </article>
      }
    }
    @if (!loading() && !error() && !data()?.appointments?.length) {
      <p>{{ "ABSENCE.NO_COVERAGE" | translate }}</p>
    }
  </section>`,
  styles: [
    `
      :host {
        display: block;
        margin-top: 16px;
      }
      .covered-treatments {
        border-top: 1px solid var(--border-color);
        padding-top: 14px;
      }
      header,
      article {
        display: flex;
        align-items: center;
        gap: 10px;
        justify-content: space-between;
      }
      h4 {
        font-size: 16px;
        margin: 0;
      }
      article {
        padding: 12px 0;
        border-bottom: 1px solid var(--border-color);
        font-size: 13px;
      }
      article > div {
        flex: 1;
        min-width: 0;
      }
      small {
        display: block;
        color: var(--text-secondary);
        font-size: 12px;
        line-height: 1.6;
      }
      .btn {
        min-height: 40px;
        font-size: 12px;
      }
      p {
        font-size: 13px;
        margin: 12px 0;
        color: var(--text-secondary);
      }
      .warning {
        color: var(--color-warning);
      }
      @media (max-width: 500px) {
        article {
          flex-wrap: wrap;
        }
        .btn {
          min-height: 44px;
        }
        article > a {
          margin-inline-start: 48px;
        }
      }
    `,
  ],
})
export class CoveredTreatments implements OnInit {
  private api = inject(DoctorWorkspaceService);
  private destroy = inject(DestroyRef);
  private translate = inject(TranslateService);
  readonly data = signal<DoctorSchedule | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  ngOnInit() {
    this.load();
    interval(30000)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => {
        if (!document.hidden && !this.loading()) this.load();
      });
  }
  load() {
    this.loading.set(true);
    this.error.set(false);
    this.api.schedule(clinicDate()).subscribe({
      next: (data) => {
        this.data.set({
          ...data,
          appointments: [
            ...new Map(
              [...data.appointments, ...data.activeTreatments]
                .filter((visit) => visit.coveringTreatment)
                .map((visit) => [visit.appointmentId, visit]),
            ).values(),
          ].sort((a, b) => a.plannedStart.localeCompare(b.plannedStart)),
        });
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
  time(value: string) {
    return new Date(value).toLocaleTimeString(
      this.translate.currentLang === "ar" ? "ar-EG" : "en-US",
      { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit" },
    );
  }
}
