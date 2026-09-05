import { Patient } from '../models/patient.model';
import { Session } from '../models/session.model';
import { Room } from '../models/room.model';
import { InsuranceClaim } from '../models/insurance.model';
import { Invoice } from '../models/invoice.model';
import { Doctor, DoctorSlot, DoctorAvailability } from '../models/doctor.model';
import { WaitlistItem } from '../models/waitlist.model';

export const mockPatients: Patient[] = [
  { id: '1', nameEn: 'Ahmed Fathy', nameAr: 'أحمد فتحي', avatar: 'AF', gender: 'Male', phone: '+201012345678', paymentType: 'Cash', lastVisit: '2026-05-12T00:00:00Z', documents: { medicalConsent: true, liabilityWaiver: true, idCard: true } },
  { id: '2', nameEn: 'Mona Zaki', nameAr: 'منى زكي', avatar: 'MZ', gender: 'Female', phone: '+201112345678', paymentType: 'Insurance', lastVisit: '2026-05-10T00:00:00Z', documents: { medicalConsent: false, liabilityWaiver: true, idCard: false } },
  { id: '3', nameEn: 'Omar Hassan', nameAr: 'عمر حسن', avatar: 'OH', gender: 'Male', phone: '+201212345678', paymentType: 'Online', lastVisit: '2026-05-01T00:00:00Z', documents: { medicalConsent: true, liabilityWaiver: false, idCard: true } },
  { id: '4', nameEn: 'Ali Hassan', nameAr: 'علي حسن', avatar: 'AH', gender: 'Male', phone: '+201000111222', paymentType: 'Cash', lastVisit: '2026-04-15T00:00:00Z', documents: { medicalConsent: true, liabilityWaiver: true, idCard: true } },
  { id: '5', nameEn: 'Nour El Din', nameAr: 'نور الدين', avatar: 'NE', gender: 'Male', phone: '+201099887766', paymentType: 'Insurance', lastVisit: '2026-05-05T00:00:00Z', documents: { medicalConsent: true, liabilityWaiver: true, idCard: false } },
  { id: '6', nameEn: 'Laila Tarek', nameAr: 'ليلى طارق', avatar: 'LT', gender: 'Female', phone: '+201222333444', paymentType: 'Cash', lastVisit: '2026-05-11T00:00:00Z', documents: { medicalConsent: true, liabilityWaiver: true, idCard: true } },
  { id: '7', nameEn: 'Youssef Ali', nameAr: 'يوسف علي', avatar: 'YA', gender: 'Male', phone: '+201112223344', paymentType: 'Cash', lastVisit: '2026-03-10T00:00:00Z', documents: { medicalConsent: false, liabilityWaiver: false, idCard: false } },
  { id: '8', nameEn: 'Sara Mahmoud', nameAr: 'سارة محمود', avatar: 'SM', gender: 'Female', phone: '+201011122233', paymentType: 'Online', lastVisit: '2026-04-20T00:00:00Z', documents: { medicalConsent: true, liabilityWaiver: true, idCard: true } }
];

export const mockDoctors: Doctor[] = [
  { id: 'doc_1', name: 'Dr. Sarah', gender: 'Female' },
  { id: 'doc_2', name: 'Dr. Omar', gender: 'Male' },
  { id: 'doc_3', name: 'Dr. Youssef', gender: 'Male' },
  { id: 'doc_4', name: 'Dr. Adel', gender: 'Male' },
  { id: 'doc_5', name: 'Dr. Hassan', gender: 'Male' }
];

export const mockRooms: Room[] = [
  { id: 'room_1', displayName: 'Room 1', status: 'Occupied', doctorId: 'doc_1', currentLoad: 1, capacity: 2 },
  { id: 'room_2', displayName: 'Room 2', status: 'Available', doctorId: null, currentLoad: 0, capacity: 2 },
  { id: 'room_3', displayName: 'Room 3', status: 'Occupied', doctorId: 'doc_2', currentLoad: 2, capacity: 2 },
  { id: 'room_4', displayName: 'Room 4', status: 'Maintenance', doctorId: null, currentLoad: 0, capacity: 1 },
  { id: 'room_5', displayName: 'Room 5', status: 'Available', doctorId: null, currentLoad: 0, capacity: 2 },
];

export const mockSessions: Session[] = [
  { id: '1', scheduledAt: '2026-05-12T09:00:00Z', patientId: '1', doctorId: 'doc_1', roomId: 'room_1', status: 'Confirmed', type: 'Session', packageAlert: 'Session 12 of 12' },
  { id: '2', scheduledAt: '2026-05-12T09:00:00Z', patientId: '2', doctorId: 'doc_2', roomId: 'room_2', status: 'In Progress', type: 'Session' },
  { id: '3', scheduledAt: '2026-05-12T10:00:00Z', patientId: '4', doctorId: 'doc_1', roomId: 'room_1', status: 'Pending', type: 'Session' },
  { id: '4', scheduledAt: '2026-05-12T10:30:00Z', patientId: '5', doctorId: 'doc_2', roomId: 'room_2', status: 'Cancelled', type: 'Session' },
  { id: '5', scheduledAt: '2026-05-12T11:00:00Z', patientId: '6', doctorId: 'doc_3', roomId: 'room_3', status: 'Completed', type: 'Session' },
];

export const mockInsuranceClaims: InsuranceClaim[] = [
  { id: '1', patientId: '1', company: 'Bupa', status: 'Documents Pending', copay: null, missingDocs: ['Medical Consent', 'ID Card'] },
  { id: '2', patientId: '2', company: 'AXA', status: 'Submitted', copay: null, missingDocs: [] },
  { id: '3', patientId: '3', company: 'MetLife', status: 'Under Review', copay: null, missingDocs: [] },
  { id: '4', patientId: '6', company: 'Bupa', status: 'Approved', copay: 20, missingDocs: [] },
];

export const mockInvoices: Invoice[] = [
  { id: 'INV-1001', patientId: '1', amount: 500, currency: 'EGP', status: 'Pending', type: 'Session', createdAt: '2026-05-12T00:00:00Z' },
  { id: 'INV-1002', patientId: '2', amount: 300, currency: 'EGP', status: 'Paid', type: 'Assessment', createdAt: '2026-05-11T00:00:00Z' },
  { id: 'INV-1003', patientId: '3', amount: 5000, currency: 'EGP', status: 'Partial', type: 'Package (10 Sessions)', createdAt: '2026-05-12T00:00:00Z' },
];

export const mockDoctorSlots: DoctorSlot[] = [
  { doctorId: 'doc_1', scheduledAt: '2026-05-12T10:30:00Z', roomId: 'room_1', currentLoad: 1 },
  { doctorId: 'doc_2', scheduledAt: '2026-05-12T11:00:00Z', roomId: 'room_2', currentLoad: 0 },
  { doctorId: 'doc_3', scheduledAt: '2026-05-12T12:00:00Z', roomId: 'room_3', currentLoad: 1 },
];

export const mockDoctorAvailability: DoctorAvailability[] = [
  { doctorId: 'doc_1', currentLoad: 1, roomId: 'room_1' },
  { doctorId: 'doc_2', currentLoad: 2, roomId: 'room_2' },
  { doctorId: 'doc_3', currentLoad: 0, roomId: 'room_3' }
];

export const mockWaitlist: WaitlistItem[] = [
  { patientId: '7', request: 'Any time today', contact: '+201112223344' },
  { patientId: '8', request: 'Morning (09:00 - 12:00)', contact: '+201011122233' }
];
