import { Patient } from '../models/patient.model';
import { Session } from '../models/session.model';
import { Room } from '../models/room.model';
import { Invoice } from '../models/invoice.model';
import { Doctor, DoctorSlot, DoctorAvailability } from '../models/doctor.model';
import { WaitlistItem } from '../models/waitlist.model';

// تواريخ ديناميكية لضمان عمل النظام بشكل واقعي دائماً
const todayDate = new Date();
const today = todayDate.toISOString().split('T')[0];

const pastDateObj = new Date(todayDate);
pastDateObj.setDate(pastDateObj.getDate() - 10);
const pastDate = pastDateObj.toISOString().split('T')[0];

export const mockPatients: Patient[] = [
  // --- مرضى قدامى (لهم تاريخ تقييم سابق) ---
  { id: '1', nameEn: 'Ahmed Fathy', nameAr: 'أحمد فتحي', avatar: 'AF', gender: 'Male', phone: '+201012345671', paymentType: 'Cash', lastVisit: `${pastDate}T00:00:00Z`, documents: { medicalConsent: true, liabilityWaiver: true, idCard: true } },
  { 
    id: '2', 
    nameEn: 'Mona Zaki', 
    nameAr: 'منى زكي', 
    avatar: 'MZ', 
    gender: 'Female', 
    phone: '+201112345672', 
    paymentType: 'Insurance', 
    lastVisit: `${pastDate}T00:00:00Z`, 
    documents: { medicalConsent: true, liabilityWaiver: true, idCard: true },
    insuranceDetails: { company: 'Bupa', status: 'Approved', copayPercentage: 20, approvedSessions: 10, memberId: 'BUP-772910' }
  },
  { id: '3', nameEn: 'Omar Hassan', nameAr: 'عمر حسن', avatar: 'OH', gender: 'Male', phone: '+201212345673', paymentType: 'Online', lastVisit: `${pastDate}T00:00:00Z`, documents: { medicalConsent: true, liabilityWaiver: false, idCard: true } },
  { id: '4', nameEn: 'Laila Tarek', nameAr: 'ليلى طارق', avatar: 'LT', gender: 'Female', phone: '+201222333444', paymentType: 'Cash', lastVisit: `${pastDate}T00:00:00Z`, documents: { medicalConsent: true, liabilityWaiver: true, idCard: true } },

  // --- مرضى جدد (أول زيارة لهم اليوم) ---
  { id: '5', nameEn: 'Youssef Ali', nameAr: 'يوسف علي', avatar: 'YA', gender: 'Male', phone: '+201112223345', paymentType: 'Cash', lastVisit: `${today}T00:00:00Z`, documents: { medicalConsent: false, liabilityWaiver: false, idCard: false } },
  { id: '6', nameEn: 'Sara Mahmoud', nameAr: 'سارة محمود', avatar: 'SM', gender: 'Female', phone: '+201011122236', paymentType: 'Online', lastVisit: `${today}T00:00:00Z`, documents: { medicalConsent: false, liabilityWaiver: true, idCard: false } },
  { 
    id: '7', 
    nameEn: 'Karim Nabil', 
    nameAr: 'كريم نبيل', 
    avatar: 'KN', 
    gender: 'Male', 
    phone: '+201200112233', 
    paymentType: 'Insurance', 
    lastVisit: `${today}T00:00:00Z`, 
    documents: { medicalConsent: true, liabilityWaiver: false, idCard: true },
    insuranceDetails: { company: 'AXA', status: 'Pending', memberId: 'AXA-88412' }
  }
];

export const mockDoctors: Doctor[] = [
  { id: 'doc_1', name: 'Dr. Sarah', gender: 'Female' },
  { id: 'doc_2', name: 'Dr. Omar', gender: 'Male' },
  { id: 'doc_3', name: 'Dr. Noha', gender: 'Female' },
  { id: 'doc_4', name: 'Dr. Adel', gender: 'Male' },
  { id: 'doc_5', name: 'Dr. Hassan', gender: 'Male' }
];

export const mockRooms: Room[] = [
  { id: 'room_1', displayName: 'Room 1', status: 'Occupied', doctorId: 'doc_2', currentLoad: 1, capacity: 1 },
  { id: 'room_2', displayName: 'Room 2', status: 'Occupied', doctorId: 'doc_1', currentLoad: 1, capacity: 1 },
  { id: 'room_3', displayName: 'Room 3', status: 'Available', doctorId: null, currentLoad: 0, capacity: 1 },
  { id: 'room_4', displayName: 'Room 4', status: 'Maintenance', doctorId: null, currentLoad: 0, capacity: 1 },
  { id: 'room_5', displayName: 'Room 5', status: 'Available', doctorId: null, currentLoad: 0, capacity: 1 },
];

export const mockSessions: Session[] = [
  // ==========================================
  // 1. التاريخ القديم (Assessment History) - لا تظهر في جدول اليوم
  // ==========================================
  { id: 'hist_1', scheduledAt: `${pastDate}T10:00:00`, patientId: '1', doctorId: 'doc_4', roomId: 'room_1', status: 'Completed', type: 'Assessment' },
  { id: 'hist_2', scheduledAt: `${pastDate}T11:00:00`, patientId: '2', doctorId: 'doc_3', roomId: 'room_2', status: 'Completed', type: 'Assessment' },
  { id: 'hist_3', scheduledAt: `${pastDate}T12:00:00`, patientId: '3', doctorId: 'doc_5', roomId: 'room_3', status: 'Completed', type: 'Assessment' },
  { id: 'hist_4', scheduledAt: `${pastDate}T13:00:00`, patientId: '4', doctorId: 'doc_1', roomId: 'room_5', status: 'Completed', type: 'Assessment' },

  // ==========================================
  // 2. جلسات اليوم (Today's Schedule)
  // ==========================================

  // جلسات جارية الآن (تطابق مع الغرف المشغولة 1 و 2)
  { id: '1', scheduledAt: `${today}T09:00:00`, patientId: '1', doctorId: 'doc_2', roomId: 'room_1', status: 'In Progress', type: 'Session', packageAlert: 'Session 3 of 10' },
  { id: '2', scheduledAt: `${today}T09:30:00`, patientId: '2', doctorId: 'doc_1', roomId: 'room_2', status: 'In Progress', type: 'Session', packageAlert: 'Session 1 of 5' },

  // جلسات قادمة لمرضى قدامى (Sessions)
  { id: '3', scheduledAt: `${today}T11:00:00`, patientId: '3', doctorId: 'doc_4', roomId: 'room_3', status: 'Pending', type: 'Session' },
  { id: '4', scheduledAt: `${today}T12:00:00`, patientId: '4', doctorId: 'doc_3', roomId: 'room_5', status: 'Confirmed', type: 'Session' },

  // تقييمات قادمة لمرضى جدد (Assessments)
  { id: '5', scheduledAt: `${today}T13:30:00`, patientId: '5', doctorId: 'doc_5', roomId: 'room_3', status: 'Confirmed', type: 'Assessment' },
  { id: '6', scheduledAt: `${today}T14:00:00`, patientId: '6', doctorId: 'doc_1', roomId: 'room_5', status: 'Pending', type: 'Assessment' },

  // جلسة انتهت اليوم صباحاً
  { id: '7', scheduledAt: `${today}T08:00:00`, patientId: '1', doctorId: 'doc_2', roomId: 'room_3', status: 'Completed', type: 'Session' },
];

export const mockInvoices: Invoice[] = [
  { id: 'INV-1001', patientId: '1', amount: 350, currency: 'EGP', status: 'Paid', type: 'Session', createdAt: `${today}T00:00:00Z` },
  { id: 'INV-1002', patientId: '6', amount: 500, currency: 'EGP', status: 'Pending', type: 'Assessment', createdAt: `${today}T00:00:00Z` }
];

export const mockDoctorAvailability: DoctorAvailability[] = [
  // يعكس الحمل الحالي للأطباء بناءً على الجلسات الـ In Progress
  { doctorId: 'doc_2', currentLoad: 1, roomId: 'room_1' },
  { doctorId: 'doc_1', currentLoad: 1, roomId: 'room_2' },
  { doctorId: 'doc_3', currentLoad: 0, roomId: 'room_3' }, // متاح
  { doctorId: 'doc_4', currentLoad: 0, roomId: 'room_5' }, // متاح
  { doctorId: 'doc_5', currentLoad: 0, roomId: 'room_3' }  // متاح
];

// تم تفريغ قائمة الانتظار بناءً على قرارك بإلغائها من واجهة الاستقبال
export const mockWaitlist: WaitlistItem[] = [];
export const mockDoctorSlots: DoctorSlot[] = [];