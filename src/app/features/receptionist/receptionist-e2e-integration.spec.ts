import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ClinicStateService } from '../../core/services/state/clinic-state.service';
import { Patient } from '../../core/models/patient.model';

describe('Receptionist E2E Integration (ClinicStateService)', () => {
  let clinicState: ClinicStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        ReactiveFormsModule
      ],
      providers: [ClinicStateService]
    });

    clinicState = TestBed.inject(ClinicStateService);
  });

  it('TC1: Should correctly calculate patientShare and insuranceShare for an Insurance patient booking an Assessment', fakeAsync(async () => {
    // 1. Setup an insurance patient
    const insurancePatient: Patient = {
      id: 'patient-tc1',
      nameEn: 'Insurance Jane',
      nameAr: 'جين',
      avatar: '',
      gender: 'Female',
      phone: '01000000000',
      paymentType: 'Insurance',
      lastVisit: new Date().toISOString(),
      documents: { medicalConsent: true, liabilityWaiver: true, idCard: true },
      insuranceDetails: {
        company: 'Bupa',
        status: 'Approved',
        copayPercentage: 20
      }
    };
    
    // Inject the patient into the state
    (clinicState as any).patientsSig.update((list: Patient[]) => [...list, insurancePatient]);

    try {
      // 2. Book an Assessment Session
      await clinicState.addSession({
        patientId: 'patient-tc1',
        doctorId: 'doc_1',
        roomId: 'room_1',
        scheduledAt: new Date().toISOString(),
        type: 'Assessment',
        assessmentPrice: 1000
      });
      
      tick();

      // 3. Assert calculation
      // Find the generated invoice for this patient and session
      const invoices = clinicState.invoices();
      const invoice = invoices.find(inv => inv.patientId === 'patient-tc1');
      
      expect(invoice).toBeDefined();
      if (invoice) {
        // 20% of 1000 = 200 patient share. 80% = 800 insurance share.
        expect(invoice.patientShare).toBe(200);
        expect(invoice.insuranceShare).toBe(800);
        expect(invoice.amount).toBe(1000); // Or totalAmount/subtotal depending on exact mapping in addSession
      }

    } catch (e) {
      expect(e).toBeUndefined();
    }
  }));

  it('TC2: Should create a Treatment Plan (Package mode), apply discount/partial payment, and calculate remainingDebt', fakeAsync(async () => {
    const patientId = 'patient-tc2';
    const packagePatient: Patient = {
      id: patientId,
      nameEn: 'Package John',
      nameAr: 'جون',
      avatar: '',
      gender: 'Male',
      phone: '01000000000',
      paymentType: 'Cash',
      lastVisit: new Date().toISOString(),
      documents: { medicalConsent: true, liabilityWaiver: true, idCard: true }
    };
    
    (clinicState as any).patientsSig.update((list: Patient[]) => [...list, packagePatient]);

    // 1. Create Treatment Plan
    await clinicState.createTreatmentPlan({
      patientId: patientId,
      doctorId: 'doc_1',
      roomId: 'room_1',
      dates: [new Date(), new Date()], // E.g., 2 sessions
      paymentMode: 'Package',
      packagePrice: 3000, 
      discount: 300, 
      payingNow: 1000
    });

    tick(); 

    // 2. Assert Initial Debt after payingNow
    // Net amount = 3000 - 300 = 2700. Paid 1000 upfront. Remaining debt = 1700.
    let patient = clinicState.patients().find(p => p.id === patientId);
    expect(patient?.financialPlan).toBeDefined();
    expect(patient?.financialPlan?.remainingDebt).toBe(1700);

    // 3. Collect further installment
    await clinicState.collectInstallment(patientId, 700, 'Cash');
      
    tick();

    patient = clinicState.patients().find(p => p.id === patientId);
    // 1700 - 700 = 1000 remaining debt
    expect(patient?.financialPlan?.remainingDebt).toBe(1000);
  }));

  it('TC3: Should block "Check-In" if a patient with remaining debt attempts to check in without paying an installment', fakeAsync(async () => {
    const patientId = 'patient-tc3';
    
    // 1. Setup patient with existing debt via financialPlan
    const debtorPatient: Patient = {
      id: patientId,
      nameEn: 'Debtor Dan',
      nameAr: 'دان',
      avatar: '',
      gender: 'Male',
      phone: '01000000000',
      paymentType: 'Cash',
      lastVisit: new Date().toISOString(),
      documents: { medicalConsent: true, liabilityWaiver: true, idCard: true },
      financialPlan: {
        paymentMode: 'Package',
        remainingDebt: 2000,
        netAmount: 5000,
        totalPaidSoFar: 3000
      }
    };
    
    (clinicState as any).patientsSig.update((list: Patient[]) => [...list, debtorPatient]);

    // 2. Create a session for this patient
    (clinicState as any).sessionsSig.update((list: any[]) => [
      ...list,
      { id: 'session-tc3', patientId: patientId, status: 'Scheduled', doctorId: 'doc_1', roomId: 'room_1' }
    ]);

    // 3. Attempt Check-In
    let errorCaught = false;
    try {
      await clinicState.checkInPatient('session-tc3');
      tick();
    } catch (error: any) {
      errorCaught = true;
      // Note: adjust the match string if the actual error message is different
      expect(error.message.toLowerCase()).toMatch(/debt|payment|installment|invoice|pending/);
    }

    expect(errorCaught).toBe(true);
    
    // Ensure the session status did not change to 'In Progress'
    const session = clinicState.sessions().find(s => s.id === 'session-tc3');
    expect(session?.status).toBe('Scheduled');
  }));
});
