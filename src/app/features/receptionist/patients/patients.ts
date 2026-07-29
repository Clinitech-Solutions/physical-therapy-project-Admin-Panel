import { Component, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';

interface Patient {
  id: string;
  nameEn: string;
  nameAr: string;
  avatar: string;
  gender: 'Male' | 'Female';
  phone: string;
  paymentType: 'Cash' | 'Online' | 'Insurance';
  lastVisit: string;
  documents: {
    medicalConsent: boolean;
    liabilityWaiver: boolean;
    idCard: boolean;
  };
}

@Component({
  selector: "app-receptionist-patients",
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule],
  templateUrl: "./patients.html",
})
export class PatientsComponent {
  searchQuery = signal('');
  
  patients = signal<Patient[]>([
    { id: '1', nameEn: 'Ahmed Fathy', nameAr: 'أحمد فتحي', avatar: 'AF', gender: 'Male', phone: '+201012345678', paymentType: 'Cash', lastVisit: '12 May 2026', documents: { medicalConsent: true, liabilityWaiver: true, idCard: true } },
    { id: '2', nameEn: 'Mona Zaki', nameAr: 'منى زكي', avatar: 'MZ', gender: 'Female', phone: '+201112345678', paymentType: 'Insurance', lastVisit: '10 May 2026', documents: { medicalConsent: false, liabilityWaiver: true, idCard: false } },
    { id: '3', nameEn: 'Omar Hassan', nameAr: 'عمر حسن', avatar: 'OH', gender: 'Male', phone: '+201212345678', paymentType: 'Online', lastVisit: '01 May 2026', documents: { medicalConsent: true, liabilityWaiver: false, idCard: true } },
  ]);

  // Drawer state
  showDrawer = signal(false);
  
  // New Patient Form
  newPatient = {
    nameEn: '',
    nameAr: '',
    phone: '',
    gender: 'Male',
    dob: '',
    paymentType: 'Cash',
    insuranceCompany: '',
    docs: {
      medicalConsent: false,
      liabilityWaiver: false,
      idCard: false
    }
  };

  openDrawer() {
    this.showDrawer.set(true);
  }

  closeDrawer() {
    this.showDrawer.set(false);
  }

  createProfile() {
    const avatarStr = this.newPatient.nameEn.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
    this.patients.update(p => [{
      id: Date.now().toString(),
      nameEn: this.newPatient.nameEn || 'New Patient',
      nameAr: this.newPatient.nameAr || 'مريض جديد',
      avatar: avatarStr || 'NP',
      gender: this.newPatient.gender as 'Male' | 'Female',
      phone: this.newPatient.phone,
      paymentType: this.newPatient.paymentType as 'Cash' | 'Online' | 'Insurance',
      lastVisit: 'Today',
      documents: { ...this.newPatient.docs }
    }, ...p]);
    this.closeDrawer();
  }
}
