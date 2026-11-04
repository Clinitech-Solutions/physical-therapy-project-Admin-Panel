import { ComponentFixture, TestBed } from "@angular/core/testing";

import { AbsenceCoverage } from "./absence-coverage";
import { TranslateModule } from "@ngx-translate/core";
import { provideRouter } from "@angular/router";
import { of } from "rxjs";
import { DoctorWorkspaceService } from "../../../core/services/doctor-workspace.service";

describe("AbsenceCoverage", () => {
  let component: AbsenceCoverage;
  let fixture: ComponentFixture<AbsenceCoverage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AbsenceCoverage, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        {
          provide: DoctorWorkspaceService,
          useValue: {
            schedule: () =>
              of({
                date: "2026-11-04",
                appointments: [],
                activeTreatments: [],
              }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AbsenceCoverage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
