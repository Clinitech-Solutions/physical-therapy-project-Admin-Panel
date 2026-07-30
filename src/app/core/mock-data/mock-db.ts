import { Patient } from '../models/patient.model';
import { Session } from '../models/session.model';
import { Room } from '../models/room.model';
import { InsuranceClaim } from '../models/insurance.model';
import { Invoice } from '../models/invoice.model';
import { DoctorSlot, DoctorAvailability } from '../models/doctor.model';
import { WaitlistItem } from '../models/waitlist.model';

export const mockPatients: Patient[] = [
  { id: '1', nameEn: 'Ahmed Fathy', nameAr: 'أحمد فتحي', avatar: 'AF', gender: 'Male', phone: '+201012345678', paymentType: 'Cash', lastVisit: '12 May 2026', documents: { medicalConsent: true, liabilityWaiver: true, idCard: true } },
  { id: '2', nameEn: 'Mona Zaki', nameAr: 'منى زكي', avatar: 'MZ', gender: 'Female', phone: '+201112345678', paymentType: 'Insurance', lastVisit: '10 May 2026', documents: { medicalConsent: false, liabilityWaiver: true, idCard: false } },
  { id: '3', nameEn: 'Omar Hassan', nameAr: 'عمر حسن', avatar: 'OH', gender: 'Male', phone: '+201212345678', paymentType: 'Online', lastVisit: '01 May 2026', documents: { medicalConsent: true, liabilityWaiver: false, idCard: true } },
];

export const mockSessions: Session[] = [
  { id: '1', time: '09:00 AM', patientName: 'Ahmed Fathy', patientAvatar: 'AF', doctorName: 'Dr. Sarah', room: 'Room 1', status: 'Confirmed', packageAlert: 'Session 12 of 12' },
  { id: '2', time: '09:00 AM', patientName: 'Mona Zaki', patientAvatar: 'MZ', doctorName: 'Dr. Omar', room: 'Room 2', status: 'In Progress' },
  { id: '3', time: '10:00 AM', patientName: 'Ali Hassan', patientAvatar: 'AH', doctorName: 'Dr. Sarah', room: 'Room 1', status: 'Pending' },
  { id: '4', time: '10:30 AM', patientName: 'Nour El Din', patientAvatar: 'NE', doctorName: 'Dr. Omar', room: 'Room 2', status: 'Cancelled' },
  { id: '5', time: '11:00 AM', patientName: 'Laila Tarek', patientAvatar: 'LT', doctorName: 'Dr. Youssef', room: 'Room 3', status: 'Completed' },
];

export const mockRooms: Room[] = [
  { name: 'Room 1', status: 'Occupied', doctor: 'Dr. Sarah', load: '1/2' },
  { name: 'Room 2', status: 'Available', doctor: null, load: null },
  { name: 'Room 3', status: 'Occupied', doctor: 'Dr. Omar', load: '2/2' },
  { name: 'Room 4', status: 'Maintenance', doctor: null, load: null },
  { name: 'Room 5', status: 'Available', doctor: null, load: null },
];

export const mockInsuranceClaims: InsuranceClaim[] = [
  { id: '1', name: 'Ahmed Fathy', company: 'Bupa', status: 'Documents Pending', copay: null, pendingDocs: 2 },
  { id: '2', name: 'Mona Zaki', company: 'AXA', status: 'Submitted', copay: null, pendingDocs: 0 },
  { id: '3', name: 'Omar Hassan', company: 'MetLife', status: 'Under Review', copay: null, pendingDocs: 0 },
  { id: '4', name: 'Laila Tarek', company: 'Bupa', status: 'Approved', copay: 20, pendingDocs: 0 },
];

export const mockInvoices: Invoice[] = [
  { id: 'INV-1001', patient: 'Ahmed Fathy', amount: 500, status: 'Pending', type: 'Session', date: 'Today' },
  { id: 'INV-1002', patient: 'Mona Zaki', amount: 300, status: 'Paid', type: 'Assessment', date: 'Yesterday' },
  { id: 'INV-1003', patient: 'Omar Hassan', amount: 5000, status: 'Partial', type: 'Package (10 Sessions)', date: '12 May 2026' },
];

export const mockDoctorSlots: DoctorSlot[] = [
  { doctor: 'Dr. Sarah', doctorGender: 'Female', time: '10:30 AM', room: 'Room 1', load: 1 },
  { doctor: 'Dr. Omar', doctorGender: 'Male', time: '11:00 AM', room: 'Room 2', load: 0 },
  { doctor: 'Dr. Youssef', doctorGender: 'Male', time: '12:00 PM', room: 'Room 3', load: 1 },
];

export const mockDoctorAvailability: DoctorAvailability[] = [
  { name: 'Dr. Sarah', load: 1, room: 'Room 1' },
  { name: 'Dr. Omar', load: 2, room: 'Room 2' },
  { name: 'Dr. Youssef', load: 0, room: 'Room 3' }
];

export const mockWaitlist: WaitlistItem[] = [
  { patient: 'Youssef Ali', request: 'Any time today', contact: '+201112223344' },
  { patient: 'Sara Mahmoud', request: 'Morning (09:00 - 12:00)', contact: '+201011122233' }
];
