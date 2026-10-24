/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs';
import { TestBed } from '@angular/core/testing';
import { signal, Injector, runInInjectionContext } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ReceptionistLocale } from './receptionist-locale';
import { ScheduleComponent } from '../features/receptionist/schedule/schedule';
import { ReceptionistService } from '../core/services/receptionist.service';
import { BillingService } from '../core/services/billing.service';

const en = JSON.parse(readFileSync('public/assets/i18n/en.json', 'utf8'));
const ar = JSON.parse(readFileSync('public/assets/i18n/ar.json', 'utf8'));
const lookup = (dictionary: any, key: string) => key.split('.').reduce((value, part) => value?.[part], dictionary);

describe('Receptionist localization', () => {
  let translate: TranslateService;
  let locale: ReceptionistLocale;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TranslateModule.forRoot()] });
    translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', en);
    translate.setTranslation('ar', ar);
    translate.use('en');
    locale = TestBed.runInInjectionContext(() => new ReceptionistLocale());
  });

  it('switches enum labels, interpolated messages, names, and times without recreating the page', () => {
    const patient = { nameEn: 'Ahmed Mohamed', nameAr: 'أحمد محمد' };
    expect(locale.label('In Progress')).toBe('In Progress');
    expect(locale.patientName(patient)).toBe('Ahmed Mohamed');
    expect(locale.hour('09:00 AM')).toBe('09:00 AM');
    translate.use('ar');
    expect(locale.label('In Progress')).toBe('قيد التنفيذ');
    expect(locale.label('Per-Session')).toBe('لكل جلسة');
    expect(locale.patientName(patient)).toBe('أحمد محمد');
    expect(locale.hour('09:00 AM')).toMatch(/[٠-٩]/);
    expect(locale.text('SESSION_PROGRESS', '', { number: 2, total: 10 })).toBe('الجلسة 2 من 10');
    expect(locale.label('Bupa')).toBe('Bupa');
  });

  it('keeps every appointment in its timeline bucket after switching to Arabic', () => {
    const receptionist = {
      todaySessions: signal([{ id: 1, patientId: 1, startTime: `${new Date().toISOString().slice(0, 10)}T09:30:00`, status: 'Confirmed' }]),
      stats: signal(null), loading: signal(false), mapStatusToString: (value: string) => value
    };
    const injector = Injector.create({ providers: [
      { provide: TranslateService, useValue: translate },
      { provide: ReceptionistService, useValue: receptionist },
      { provide: BillingService, useValue: {} },
      MessageService
    ] });
    const schedule = runInInjectionContext(injector, () => new ScheduleComponent());
    const before = schedule.filteredSchedule.find(slot => slot.time === '09:00 AM');
    translate.use('ar');
    const after = schedule.filteredSchedule.find(slot => slot.time === '09:00 AM');
    expect(before?.sessions.map(session => session.id)).toEqual([1]);
    expect(after?.sessions.map(session => session.id)).toEqual([1]);
    expect(schedule.formatTime(receptionist.todaySessions()[0].startTime)).toMatch(/[٠-٩]/);
  });

  it('provides both languages for every receptionist and profile translation reference', () => {
    const directories = ['src/app/features/receptionist', 'src/app/shared/components/patient-profile'];
    for (const directory of directories) {
      for (const file of readdirSync(directory, { recursive: true }).filter(file => /\.(html|ts)$/.test(String(file)) && !String(file).endsWith('.spec.ts'))) {
        const source = readFileSync(`${directory}/${file}`, 'utf8');
        for (const match of source.matchAll(/['"]((?:RECEPTIONIST|COMMON|SIDEBAR)\.[A-Z0-9_.]+)['"]/g)) {
          for (const dictionary of [en, ar]) expect(lookup(dictionary, match[1]), `${file}: ${match[1]}`).toBeTypeOf('string');
        }
      }
    }
  });

  it('has matching translation keys and interpolation parameters without Arabic placeholders', () => {
    expect(Object.keys(ar.RECEPTIONIST).sort()).toEqual(Object.keys(en.RECEPTIONIST).sort());
    expect(Object.keys(ar.RECEPTIONIST.UI).sort()).toEqual(Object.keys(en.RECEPTIONIST.UI).sort());
    for (const [key, english] of Object.entries(en.RECEPTIONIST.UI)) {
      const arabic = ar.RECEPTIONIST.UI[key];
      expect(arabic, key).not.toMatch(/^ع-/);
      expect(arabic.match(/\{\{\w+\}\}|\{\d+\}/g) || [], key).toEqual(String(english).match(/\{\{\w+\}\}|\{\d+\}/g) || []);
    }
    expect(ar.PRIMENG.monthNames).toHaveLength(12);
    expect(ar.PRIMENG.dayNames).toHaveLength(7);
  });
});
