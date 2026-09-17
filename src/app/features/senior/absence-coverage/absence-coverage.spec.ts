import { ComponentFixture, TestBed } from "@angular/core/testing";

import { AbsenceCoverage } from "./absence-coverage";

describe("AbsenceCoverage", () => {
  let component: AbsenceCoverage;
  let fixture: ComponentFixture<AbsenceCoverage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AbsenceCoverage],
    }).compileComponents();

    fixture = TestBed.createComponent(AbsenceCoverage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
