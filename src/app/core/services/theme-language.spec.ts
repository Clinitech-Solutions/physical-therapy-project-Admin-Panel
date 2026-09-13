import { TestBed } from '@angular/core/testing';

import { ThemeLanguageService } from './theme-language';
import { TranslateModule } from '@ngx-translate/core';

describe('ThemeLanguageService', () => {
  let service: ThemeLanguageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()]
    });
    service = TestBed.inject(ThemeLanguageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
