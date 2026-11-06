import '../../../../testing/browser-media';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  let component: ThemeToggle;
  let fixture: ComponentFixture<ThemeToggle>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), ThemeToggle],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ThemeToggle);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
