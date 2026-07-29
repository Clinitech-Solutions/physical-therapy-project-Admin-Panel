import { Component, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: "app-receptionist-insurance",
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule],
  templateUrl: "./insurance.html"
})
export class InsuranceComponent {
  patients = signal([
    { id: '1', name: 'Ahmed Fathy', company: 'Bupa', status: 'Documents Pending', copay: null },
    { id: '2', name: 'Mona Zaki', company: 'AXA', status: 'Submitted', copay: null },
    { id: '3', name: 'Omar Hassan', company: 'MetLife', status: 'Under Review', copay: null },
    { id: '4', name: 'Laila Tarek', company: 'Bupa', status: 'Approved', copay: 20 },
  ]);

  showDrawer = signal(false);
  selectedPatient: any = null;

  copayInput = 0;
  insuranceCompany = '';
  package = '';
  activeDrawerTab = 'docs'; // 'docs' or 'copay'
  copayValue = 0;
  isProcessing = signal(false);

  openDrawer(patient: any) {
    this.selectedPatient = patient;
    this.copayInput = patient.copay || 0;
    this.insuranceCompany = patient.company;
    this.showDrawer.set(true);
  }

  closeDrawer() {
    this.showDrawer.set(false);
    this.selectedPatient = null;
  }

  submitToInsurer() {
    if (!this.selectedPatient) return;
    
    this.isProcessing.set(true);
    
    setTimeout(() => {
      this.patients.update(pts =>
        pts.map(p =>
          p.id === this.selectedPatient?.id
            ? { ...p, status: 'Submitted', pendingDocs: 0 }
            : p
        )
      );
      this.isProcessing.set(false);
      this.closeDrawer();
    }, 1000);
  }

  saveCopay() {
    if (this.selectedPatient) {
      const pid = this.selectedPatient.id;
      this.patients.update(p => p.map(x => {
        if (x.id === pid) {
          return { ...x, copay: this.copayInput, status: 'Approved' };
        }
        return x;
      }));
    }
    this.closeDrawer();
  }
}
