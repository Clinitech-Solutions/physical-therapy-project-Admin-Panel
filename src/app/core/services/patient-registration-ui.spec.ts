/// <reference types="node" />
import { readFileSync } from "node:fs";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import {
  provideHttpClientTesting,
  HttpTestingController,
} from "@angular/common/http/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { MessageService } from "primeng/api";
import { PatientsComponent } from "../../features/receptionist/patients/patients";
import { BookingsComponent } from "../../features/receptionist/bookings/bookings";
import { environment } from "../../../environments/environment";
import { PatientService } from "./patient.service";
import { PatientResponse } from "../models/patient-api.model";

const en = JSON.parse(readFileSync("public/assets/i18n/en.json", "utf8"));
const ar = JSON.parse(readFileSync("public/assets/i18n/ar.json", "utf8"));
const base = environment.apiUrl;

describe.each(["patients", "bookings"] as const)(
  "%s Add Patient form",
  (entry) => {
    let fixture: ComponentFixture<PatientsComponent | BookingsComponent>;
    let http: HttpTestingController;
    const field = (name: string) =>
      document.querySelector<HTMLInputElement>(
        `.p-dialog input[name="${name}"]`,
      )!;
    const feedback = () =>
      document.querySelector<HTMLElement>(
        ".p-dialog-footer [data-registration-feedback]",
      )!;
    const save = () =>
      [
        ...document.querySelectorAll<HTMLButtonElement>(
          ".p-dialog-footer button",
        ),
      ].find((button) => button.textContent?.trim() === "Save")!;
    const fill = async (name: string, value: string) => {
      field(name).value = value;
      field(name).dispatchEvent(new Event("input", { bubbles: true }));
      await fixture.whenStable();
    };
    const fillValid = async () => {
      await fill("nameEn", "Test Patient");
      await fill("phone", "01012345678");
      await fill("dob", "2001-12-08");
    };

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [
          PatientsComponent,
          BookingsComponent,
          TranslateModule.forRoot(),
        ],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideNoopAnimations(),
          provideRouter([]),
          MessageService,
        ],
      }).compileComponents();
      const translate = TestBed.inject(TranslateService);
      translate.setTranslation("en", en);
      translate.setTranslation("ar", ar);
      translate.use("en");
      http = TestBed.inject(HttpTestingController);
      fixture =
        entry === "patients"
          ? TestBed.createComponent(PatientsComponent)
          : TestBed.createComponent(BookingsComponent);
      fixture.detectChanges();
      // Supply the unrelated initial directory reads without any real network access.
      for (const request of http.match((request) => request.method === "GET")) {
        if (
          request.request.url.endsWith("/Patients/GetAll") ||
          request.request.url.endsWith("/Appointments/GetAll") || request.request.url.endsWith('/Bookings/patients')
        ) {
          request.flush({
            items: [],
            pageNumber: 1,
            totalPages: 1,
            hasNextPage: false,
          });
        } else if (request.request.url.endsWith("/Receptionist/clinicians"))
          request.flush([]);
        else request.flush([]);
      }
      if (fixture.componentInstance instanceof PatientsComponent)
        fixture.componentInstance.openDrawer();
      else fixture.componentInstance.openQuickAddModal();
      fixture.detectChanges();
      await fixture.whenStable();
    });
    afterEach(() => {
      try {
        fixture?.destroy();
        http?.verify();
      } finally {
        TestBed.resetTestingModule();
      }
    });

    it("removes Username while preserving required clinical identity fields", async () => {
      expect(field("userName")).toBeNull();
      expect(field("nameEn").required).toBe(true);
      await fillValid();
      expect(field("nameEn").value).toBe("Test Patient");
    });

    it.each(["", "a", "x".repeat(151)])(
      "shows the exact fullName error on Save without HTTP for invalid value %j",
      async (fullName) => {
        await fillValid();
        await fill("nameEn", fullName);
        save().click();
        await fixture.whenStable();
        http.expectNone(`${base}/Patients/Add`);
        expect(feedback().textContent?.trim()).toBe(
          "Full name must contain 2 to 150 characters.",
        );
        expect(field("nameEn").getAttribute("aria-invalid")).toBe("true");
        expect(document.activeElement).toBe(field("nameEn"));
        expect(save().disabled).toBe(false);
      },
    );

    it("lists all required-data errors in the footer instead of failing silently", async () => {
      save().click();
      await fixture.whenStable();
      const text = feedback().textContent!;
      expect(text).toContain("Full name must contain 2 to 150 characters.");
      expect(text).toContain("Enter a phone number");
      expect(text).toContain("Enter a valid date of birth.");
      http.expectNone(`${base}/Patients/Add`);
    });

    it("submits valid identity data without a username on Save, then uses the real returned ID", async () => {
      await fillValid();
      save().click();
      const request = http.expectOne(`${base}/Patients/Add`);
      expect(request.request.method).toBe("POST");expect(request.request.body).not.toHaveProperty("userName");
      expect(request.request.body).toMatchObject({
        fullName: "Test Patient",
        phoneNumber: "01012345678",
        birthDate: "2001-12-08T00:00:00.000Z",
      });
      const saved = {
        id: 42,
        applicationUserId: "test-user",
        fullName: "Test Patient",
        phoneNumber: "01012345678",
        birthDate: "2001-12-08T00:00:00.000Z",
        gender: 0,
        paymentType: "Cash",
        insuranceCompanyId: null,
        insuranceDetails: null,
      };
      request.flush(saved);
      await Promise.resolve();
      http
        .expectOne((r) => r.url === `${base}/${entry === 'bookings' ? 'Bookings/patients' : 'Patients/GetAll'}`)
        .flush({
          items: entry === 'bookings' ? [{ id: saved.id, fullName: saved.fullName, phoneNumber: saved.phoneNumber, gender: 'Male' }] : [saved],
          pageNumber: 1,
          totalPages: 1,
          hasNextPage: false,
        });
      for (const request of http.match((request) =>
        /\/(Assessments|TreatmentPlans|TreatmentPlanSessions)\/GetAll(?:\?|$)/.test(
          request.url,
        ),
      )) {
        request.flush([]);
      }
      if (entry === 'bookings') http.expectOne(`${base}/Bookings/patients/42`).flush({ title: 'Eligibility unavailable' }, { status: 503, statusText: 'Unavailable' });
      await fixture.whenStable();
      const component = fixture.componentInstance;
      if (component instanceof PatientsComponent) {
        expect(component.showDrawer()).toBe(false);
        expect(component.patients()[0].id).toBe("42");
      } else {
        expect(component.isQuickAddModalOpen).toBe(false);
        expect(component.selectedPatientId).toBe("42");
      }
    });

    it("shows every server validation message verbatim beside Save", async () => {
      await fillValid();
      save().click();
      http
        .expectOne(`${base}/Patients/Add`)
        .flush(
          {
            errors: {
              UserName: ["Username already exists."],
              PhoneNumber: ["Invalid phone."],
            },
          },
          { status: 400, statusText: "Bad Request" },
        );
      await fixture.whenStable();
      expect(feedback().textContent?.trim()).toBe(
        "UserName: Username already exists.\nPhoneNumber: Invalid phone.",
      );
      expect(save().disabled).toBe(false);
    });

    it("shows translated field errors when the form is Arabic", async () => {
      TestBed.inject(TranslateService).use("ar");
      await fixture.whenStable();
      const button = [
        ...document.querySelectorAll<HTMLButtonElement>(
          ".p-dialog-footer button",
        ),
      ].find((button) => button.textContent?.trim() === ar.COMMON.SAVE)!;
      button.click();
      await fixture.whenStable();
      expect(feedback().textContent).toContain(
        ar.RECEPTIONIST.UI.PATIENT_NAME_LENGTH,
      );
      expect(
        document.getElementById(
          field("nameEn").getAttribute("aria-describedby")!,
        )?.textContent,
      ).toContain(ar.RECEPTIONIST.UI.PATIENT_NAME_LENGTH);
      http.expectNone(`${base}/Patients/Add`);
    });
  },
);

describe('Patient edit form', () => {
  let fixture: ComponentFixture<PatientsComponent>;
  let http: HttpTestingController;
  const saved: PatientResponse = {
    id: 42, applicationUserId: 'account-42', fullName: 'Current Patient', email: 'current@example.com',
    phoneNumber: '01012345678', birthDate: '1988-03-14T12:30:00Z', gender: 1,
    paymentType: 'Insurance', emergencyContact: '01123456789', insuranceCompanyId: 7,
    insuranceCompanyName: 'Current insurer', createdAt: '2026-10-29T11:00:00Z',
    insuranceDetails: { status: 1, copayPercentage: 0, approvedSessions: 12, memberId: 'member-42', employer: 'Employer' }
  };
  const input = (name: string) => document.querySelector<HTMLInputElement>(`.p-dialog input[name="${name}"]`)!;
  const fill = async (name: string, value: string) => {
    input(name).value = value;
    input(name).dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
  };
  const save = () => [...document.querySelectorAll<HTMLButtonElement>('.p-dialog-footer button')]
    .find(button => button.textContent?.trim() === en.RECEPTIONIST.SAVE_CHANGES)!;
  const loadDetails = async () => {
    http.expectOne(`${base}/Patients/GetById/42`).flush(saved);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientsComponent, TranslateModule.forRoot()],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(), provideRouter([]), MessageService]
    }).compileComponents();
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', en); translate.setTranslation('ar', ar); translate.use('en');
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PatientsComponent);
    fixture.detectChanges();
    for (const request of http.match(request => request.method === 'GET')) {
      if (request.request.url.endsWith('/Patients/GetAll')) request.flush({ items: [saved], pageNumber: 1, totalPages: 1, hasNextPage: false });
      else if (request.request.url.endsWith('/InsuranceCompanies/GetAll')) request.flush([
        { id: 7, name: 'Current insurer', isActive: true, portalUrl: null },
        { id: 8, name: 'New insurer', isActive: true, portalUrl: null }
      ]);
      else request.flush([]);
    }
    void fixture.componentInstance.editPatient(TestBed.inject(PatientService).mapToFrontendPatient({ ...saved, fullName: 'Stale list name' }));
    fixture.detectChanges();
    await fixture.whenStable();
  });
  afterEach(() => {
    try { fixture?.destroy(); http?.verify(); }
    finally { TestBed.resetTestingModule(); }
  });

  it('disables saving until GetById returns and prefills every editable value', async () => {
    expect(save().disabled).toBe(true);
    expect(input('nameEn')).toBeNull();
    await loadDetails();
    expect(save().disabled).toBe(false);
    expect(input('nameEn').value).toBe(saved.fullName);
    expect(input('email').value).toBe(saved.email);
    expect(input('dob').value).toBe('1988-03-14');
    expect(input('emergencyContact').value).toBe(saved.emergencyContact);
    expect(input('apiStatus').value).toBe('1');
    expect(input('copayPercentage').value).toBe('0');
    expect(input('approvedSessions').value).toBe('12');
    expect(input('memberId').value).toBe('member-42');
    expect(input('employer').value).toBe('Employer');
    expect(input('userName').value).toBe('');
    expect(input('userName').required).toBe(false);
    expect(document.querySelector('.p-dialog')?.textContent).toContain('account-42');
  });

  it('submits changes from all editable fields and uses the returned patient values', async () => {
    await loadDetails();
    for (const [name, value] of Object.entries({ userName: 'changed.user', nameEn: 'Changed Patient', email: 'changed@example.com',
      phone: '01234567890', dob: '1990-01-20', emergencyContact: '', apiStatus: '73', copayPercentage: '25.5',
      approvedSessions: '20', memberId: 'new-member', employer: 'New employer' })) await fill(name, value);
    const gender = document.querySelector<HTMLSelectElement>('.p-dialog select[name="gender"]')!;
    gender.value = 'Male'; gender.dispatchEvent(new Event('change', { bubbles: true }));
    const company = document.querySelector<HTMLSelectElement>('.p-dialog select[name="insuranceCompanyId"]')!;
    company.selectedIndex = 2; company.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();
    save().click();
    const request = http.expectOne(`${base}/Patients/Update/42`);
    expect(request.request.body).toEqual({ userName: 'changed.user', fullName: 'Changed Patient', email: 'changed@example.com',
      phoneNumber: '01234567890', birthDate: '1990-01-20T00:00:00.000Z', gender: 0, emergencyContact: null,
      insuranceCompanyId: 8, insuranceDetails: { status: 73, copayPercentage: 25.5, approvedSessions: 20, memberId: 'new-member', employer: 'New employer' } });
    request.flush({ ...saved, fullName: 'Changed Patient', email: 'changed@example.com' });
    await Promise.resolve();
    http.expectOne(r => r.url.endsWith('/Patients/GetAll')).flush({ items: [{ ...saved, fullName: 'Changed Patient' }], pageNumber: 1, totalPages: 1, hasNextPage: false });
    await fixture.whenStable();
    expect(fixture.componentInstance.showEditDrawer()).toBe(false);
    expect(fixture.componentInstance.patients()[0].nameEn).toBe('Changed Patient');
  });

  it('shows email validation next to the field and keeps the draft without sending an update', async () => {
    await loadDetails();
    await fill('email', 'invalid-email');
    save().click();
    await fixture.whenStable();
    http.expectNone(`${base}/Patients/Update/42`);
    expect(document.querySelector('[data-edit-feedback]')?.textContent).toBe('Enter a valid email address.');
    expect(input('email').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(input('email'));
    expect(input('email').value).toBe('invalid-email');
    expect(save().disabled).toBe(false);
  });
});
