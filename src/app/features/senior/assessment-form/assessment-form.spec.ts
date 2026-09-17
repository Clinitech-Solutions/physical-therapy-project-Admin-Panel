import { ComponentFixture, TestBed } from "@angular/core/testing";

import { AssessmentForm } from "./assessment-form";

describe("AssessmentForm", () => {
  let component: AssessmentForm;
  let fixture: ComponentFixture<AssessmentForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssessmentForm],
    }).compileComponents();

    fixture = TestBed.createComponent(AssessmentForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
