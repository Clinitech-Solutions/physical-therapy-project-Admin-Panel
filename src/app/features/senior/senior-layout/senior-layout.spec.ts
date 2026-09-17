import { ComponentFixture, TestBed } from "@angular/core/testing";

import { SeniorLayout } from "./senior-layout";

describe("SeniorLayout", () => {
  let component: SeniorLayout;
  let fixture: ComponentFixture<SeniorLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeniorLayout],
    }).compileComponents();

    fixture = TestBed.createComponent(SeniorLayout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
