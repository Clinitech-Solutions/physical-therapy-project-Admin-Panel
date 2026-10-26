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
      await fill("userName", "  reception.test  ");
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
          request.request.url.endsWith("/Appointments/GetAll")
        ) {
          request.flush({
            items: [],
            pageNumber: 1,
            totalPages: 1,
            hasNextPage: false,
          });
        } else if (request.request.url.endsWith("/Users/GetAll"))
          request.flush({ value: [] });
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

    it("renders an explicit required Username and binds typing to the submitted draft", async () => {
      const input = field("userName");
      expect(input).toBeTruthy();
      expect(input.required).toBe(true);
      expect(input.minLength).toBe(3);
      expect(input.maxLength).toBe(50);
      expect(input.closest("label")?.textContent).toContain("Username");
      await fill("userName", "patient.explicit");
      const component = fixture.componentInstance;
      expect(
        component instanceof PatientsComponent
          ? component.newPatient.userName
          : component.quickPatient.userName,
      ).toBe("patient.explicit");
    });

    it.each(["", "ab", "x".repeat(51)])(
      "shows the exact username error on Save without HTTP for invalid value %j",
      async (username) => {
        await fillValid();
        await fill("userName", username);
        save().click();
        await fixture.whenStable();
        http.expectNone(`${base}/Patients/Add`);
        expect(feedback().textContent?.trim()).toBe(
          "Username must contain 3 to 50 characters.",
        );
        expect(field("userName").getAttribute("aria-invalid")).toBe("true");
        expect(document.activeElement).toBe(field("userName"));
        expect(save().disabled).toBe(false);
      },
    );

    it("lists all required-data errors in the footer instead of failing silently", async () => {
      save().click();
      await fixture.whenStable();
      const text = feedback().textContent!;
      expect(text).toContain("Username must contain 3 to 50 characters.");
      expect(text).toContain("Full name must contain 2 to 150 characters.");
      expect(text).toContain("Enter a phone number");
      expect(text).toContain("Enter a valid date of birth.");
      http.expectNone(`${base}/Patients/Add`);
    });

    it("submits the typed username and valid payload on Save, then uses the real returned ID", async () => {
      await fillValid();
      save().click();
      const request = http.expectOne(`${base}/Patients/Add`);
      expect(request.request.method).toBe("POST");
      expect(request.request.body).toMatchObject({
        userName: "reception.test",
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
        .expectOne((r) => r.url === `${base}/Patients/GetAll`)
        .flush({
          items: [saved],
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
        ar.RECEPTIONIST.UI.PATIENT_USERNAME_LENGTH,
      );
      expect(
        document.getElementById(
          field("userName").getAttribute("aria-describedby")!,
        )?.textContent,
      ).toContain(ar.RECEPTIONIST.UI.PATIENT_USERNAME_LENGTH);
      http.expectNone(`${base}/Patients/Add`);
    });
  },
);
