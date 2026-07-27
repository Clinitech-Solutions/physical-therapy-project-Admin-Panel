import { TestBed } from '@angular/core/testing';

import { ThemeLanguage } from './theme-language';

describe('ThemeLanguage', () => {
  let service: ThemeLanguage;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeLanguage);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
