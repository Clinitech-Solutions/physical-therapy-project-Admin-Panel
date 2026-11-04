import { Component, input } from "@angular/core";
import { TranslateModule } from "@ngx-translate/core";
import { ReassessmentRequest } from "../../../core/models/doctor-workspace.model";
import { ClinicalLocale } from "../../clinical-locale";

/** Displays only the saved clinical result; it never derives an outcome from a recommendation. */
@Component({
  selector: "app-reassessment-outcome",
  standalone: true,
  imports: [TranslateModule],
  template: `@if (request().state === "Completed") {
    <section class="saved-outcome" aria-live="polite">
      <header>
        <strong>{{ "DOCTOR.SENIOR_OUTCOME" | translate }}</strong>
        @if (request().decision) {
          <span>{{
            "DOCTOR.DECISIONS." + request().decision | translate
          }}</span>
        }
      </header>
      @if (request().reviewNotes) {
        <p class="outcome-notes">{{ request().reviewNotes }}</p>
      }
      <p class="outcome-meta">
        @if (request().resolvedBy || request().seniorName) {
          <span>{{ request().resolvedBy || request().seniorName }}</span>
        }
        @if (request().resolvedAt) {
          <time [attr.datetime]="request().resolvedAt">{{
            locale.date(request().resolvedAt, true)
          }}</time>
        }
      </p>
    </section>
  }`,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .saved-outcome {
      padding: 12px 14px;
      background: color-mix(
        in srgb,
        var(--mq-teal, #008b8f) 8%,
        var(--bg-card, #fff)
      );
      border-inline-start: 3px solid var(--mq-teal, #008b8f);
      border-radius: 8px;
      color: var(--text-primary);
      margin-block: 12px;
    }
    header {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: space-between;
    }
    header span {
      font-size: 12px;
      color: var(--mq-teal, #008b8f);
    }
    p {
      margin: 8px 0 0;
    }
    .outcome-notes {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      line-height: 1.5;
    }
    .outcome-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 14px;
      color: var(--text-secondary);
      font-size: 12px;
    }
  `,
})
export class ReassessmentOutcome {
  request = input.required<ReassessmentRequest>();
  readonly locale = new ClinicalLocale();
}
