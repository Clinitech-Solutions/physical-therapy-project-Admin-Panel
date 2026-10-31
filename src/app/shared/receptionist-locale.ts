import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/** Presentation-only localization. API enum values and schedule bucket keys stay unchanged. */
export class ReceptionistLocale {
  private readonly translate = inject(TranslateService, { optional: true });

  get language(): string {
    return this.translate?.currentLang === 'ar' ? 'ar-EG' : 'en-US';
  }

  text(key: string, fallback: string, params?: Record<string, unknown>): string {
    const path = `RECEPTIONIST.UI.${key}`;
    const result = this.translate?.instant(path, params);
    if (typeof result === 'string' && result !== path) return result;
    return fallback.replace(/\{\{(\w+)\}\}/g, (_, name) => String(params?.[name] ?? ''));
  }

  label(value: unknown): string {
    const label = String(value ?? '');
    const numbered = /^(Doctor #|Room |Patient #)(\d+)$/.exec(label);
    if (numbered) {
      const kind = numbered[1].startsWith('Doctor') ? 'DOCTOR' : numbered[1].startsWith('Room') ? 'ROOM' : 'PATIENT';
      return this.text(`${kind}_NUMBER`, label, { id: numbered[2] });
    }
    const key = label.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase();
    const fallback=/^BOOKING_RULE_[A-Z_]+$/.test(label)?this.text('BUSINESS_REVIEW_REQUIRED','Review the saved details and current availability before retrying.'):label;
    return this.text(key, fallback);
  }

  patientName(patient?: { nameEn?: string; nameAr?: string } | null): string {
    return (this.language === 'ar-EG' ? patient?.nameAr || patient?.nameEn : patient?.nameEn || patient?.nameAr) || '';
  }

  error(error: unknown, key: string, fallback: string): string {
    const message = (error as { message?: string } | null)?.message;
    if (message) {
      const translated = this.label(message);
      if (this.language === 'en-US' || translated !== message || /[\u0600-\u06ff]/.test(message)) return translated;
    }
    return this.text(key, fallback);
  }

  date(value: string | Date | null | undefined, withTime = false): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString(this.language, {
      year: 'numeric', month: 'short', day: 'numeric',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } as const : {})
    });
  }

  hour(bucket: string): string {
    const match = /^(\d+):(\d+) (AM|PM)$/.exec(bucket);
    if (!match) return bucket;
    const date = new Date(2000, 0, 1, Number(match[1]) % 12 + (match[3] === 'PM' ? 12 : 0), Number(match[2]));
    return date.toLocaleTimeString(this.language, { hour: '2-digit', minute: '2-digit' });
  }
}

@Pipe({ name: 'receptionistText', standalone: true, pure: false })
export class ReceptionistTextPipe implements PipeTransform {
  private readonly locale = new ReceptionistLocale();
  transform(value: unknown): string { return this.locale.label(value); }
}
