import { Component, signal, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DialogModule } from 'primeng/dialog';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';

export interface InsuranceProvider {
  id: string;
  name: string;
  brandName: string;
  code: string;
  logoIcon: string;
  themeColor: string;
  portalUrl: string;
  taglineKey: string;
  hotline: string;
  networkTypeKey: string;
  featuresKeys: string[];
}

@Component({
  selector: "app-receptionist-insurance",
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule, DialogModule, CardModule, ButtonModule],
  templateUrl: "./insurance.html"
})
export class InsuranceComponent {
  private sanitizer = inject(DomSanitizer);
  messageService = inject(MessageService);

  providers: InsuranceProvider[] = [
    {
      id: 'bupa',
      name: 'Bupa',
      brandName: 'Bupa Egypt Insurance',
      code: 'BUPA-EG',
      logoIcon: 'bi-shield-shaded',
      themeColor: '#0079C8',
      portalUrl: 'https://www.axaglobalhealthcare.com/en/',
      taglineKey: 'RECEPTIONIST.PORTAL_BUPA_DESC',
      hotline: '16111',
      networkTypeKey: 'RECEPTIONIST.NETWORK_GOLD_CLASSIC',
      featuresKeys: ['RECEPTIONIST.FEATURE_PREAUTH', 'RECEPTIONIST.FEATURE_COPAY_CHECK', 'RECEPTIONIST.FEATURE_CLAIMS']
    },
    {
      id: 'axa',
      name: 'AXA',
      brandName: 'AXA Healthcare OneHealth',
      code: 'AXA-EGY',
      logoIcon: 'bi-heart-pulse-fill',
      themeColor: '#00008F',
      portalUrl: 'https://example.com/axa-portal',
      taglineKey: 'RECEPTIONIST.PORTAL_AXA_DESC',
      hotline: '16363',
      networkTypeKey: 'RECEPTIONIST.NETWORK_SMART_CARE',
      featuresKeys: ['RECEPTIONIST.FEATURE_PT_COVERAGE', 'RECEPTIONIST.FEATURE_ELECTRONIC_VOUCHERS', 'RECEPTIONIST.FEATURE_APPROVAL_TRACKER']
    },
    {
      id: 'metlife',
      name: 'MetLife',
      brandName: 'MetLife Alico',
      code: 'METLIFE-MEA',
      logoIcon: 'bi-hospital-fill',
      themeColor: '#0090DA',
      portalUrl: 'https://example.com/metlife-portal',
      taglineKey: 'RECEPTIONIST.PORTAL_METLIFE_DESC',
      hotline: '19798',
      networkTypeKey: 'RECEPTIONIST.NETWORK_EXECUTIVE',
      featuresKeys: ['RECEPTIONIST.FEATURE_CORP_ELIGIBILITY', 'RECEPTIONIST.FEATURE_DIRECT_SETTLEMENT', 'RECEPTIONIST.FEATURE_RAPID_AUTH']
    },
    {
      id: 'allianz',
      name: 'Allianz',
      brandName: 'Allianz Care Egypt',
      code: 'ALLIANZ-EG',
      logoIcon: 'bi-award-fill',
      themeColor: '#003781',
      portalUrl: 'https://example.com/allianz-portal',
      taglineKey: 'RECEPTIONIST.PORTAL_ALLIANZ_DESC',
      hotline: '19909',
      networkTypeKey: 'RECEPTIONIST.NETWORK_COMPREHENSIVE',
      featuresKeys: ['RECEPTIONIST.FEATURE_GLOBAL_CARD', 'RECEPTIONIST.FEATURE_BALANCE_CHECK', 'RECEPTIONIST.FEATURE_PAPERLESS']
    }
  ];

  isPortalModalOpen = signal(false);
  activeProvider = signal<InsuranceProvider | null>(null);
  activeSanitizedUrl = signal<SafeResourceUrl | null>(null);

  openPortal(provider: InsuranceProvider) {
    this.activeProvider.set(provider);
    this.activeSanitizedUrl.set(
      this.sanitizer.bypassSecurityTrustResourceUrl(provider.portalUrl)
    );
    this.isPortalModalOpen.set(true);
  }

  closePortal() {
    this.isPortalModalOpen.set(false);
    this.activeProvider.set(null);
    this.activeSanitizedUrl.set(null);
  }
}

