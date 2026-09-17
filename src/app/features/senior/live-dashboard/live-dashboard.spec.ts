import { ComponentFixture, TestBed } from "@angular/core/testing";

import { LiveDashboard } from "./live-dashboard";

describe("LiveDashboard", () => {
  let component: LiveDashboard;
  let fixture: ComponentFixture<LiveDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LiveDashboard],
    }).compileComponents();

    fixture = TestBed.createComponent(LiveDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
