import { ComponentFixture, TestBed } from "@angular/core/testing";

import { ReAssessmentForm } from "./re-assessment-form";

describe("ReAssessmentForm", () => {
  let component: ReAssessmentForm;
  let fixture: ComponentFixture<ReAssessmentForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReAssessmentForm],
    }).compileComponents();

    fixture = TestBed.createComponent(ReAssessmentForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
