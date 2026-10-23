import { ReceptionistLocale } from '../../../shared/receptionist-locale';
import { Component, inject, OnInit, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { InsuranceService } from "../../../core/services/insurance.service";

export interface InsuranceProvider {
  id: string | number;
  name: string;
  brandName?: string;
  code: string;
  logoIcon: string;
  themeColor: string;
  portalUrl: string | null;
  taglineKey?: string;
  hotline: string;
  networkTypeKey?: string;
  featuresKeys?: string[];
  isActive?: boolean;
}

@Component({
  selector: "app-receptionist-insurance",
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule, CardModule, ButtonModule],
  templateUrl: "./insurance.html"
})
export class InsuranceComponent implements OnInit {
  readonly locale = new ReceptionistLocale();
  messageService = inject(MessageService);
  private insuranceService = inject(InsuranceService);

  ngOnInit() {
    this.insuranceService.getCompanies();
  }

  providers = computed(() => {
    return this.insuranceService.companies().map((c, index) => ({
      ...c,
      id: c.id ?? index,
      code: `INS-${(c.id || index).toString().padStart(3, '0')}`,
      hotline: c.hotline || this.locale.text('NOT_PROVIDED', 'Not provided'),
      themeColor: index % 2 === 0 ? 'var(--bs-info-bg-subtle)' : 'var(--bs-primary-bg-subtle)',
      logoIcon: 'bi-shield-check text-primary'
    }));
  });

  openPortal(url: string | null) {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }
}

