// import { Patient } from '../models/patient.model';
// import { Session } from '../models/session.model';
// import { Room } from '../models/room.model';
// import { Invoice } from '../models/invoice.model';
// import { Doctor, DoctorSlot, DoctorAvailability } from '../models/doctor.model';
// import { WaitlistItem } from '../models/waitlist.model';

// // تواريخ ديناميكية لضمان عمل النظام بشكل واقعي دائماً
// const todayDate = new Date();
// const today = todayDate.toISOString().split('T')[0];

// const pastDateObj = new Date(todayDate);
// pastDateObj.setDate(pastDateObj.getDate() - 10);
// const pastDate = pastDateObj.toISOString().split('T')[0];

// export const mockPatients: Patient[] = [
//   // --- مرضى قدامى (لهم تاريخ تقييم سابق) ---
//   { 
//     id: '1', 
//     nameEn: 'Ahmed Fathy', 
//     nameAr: 'أحمد فتحي', 
//     avatar: 'AF', 
//     gender: 'Male', 
//     phone: '+201012345671', 
//     address: 'Maadi, Cairo',
//     occupation: 'Software Engineer',
//     paymentType: 'Cash', 
//     lastVisit: `${pastDate}T00:00:00Z`, 
//     documents: { medicalConsent: true, liabilityWaiver: true, idCard: true },
//     treatmentPlan: { 
//       totalSessions: 10, 
//       primaryDoctorId: 'doc_2',
//       financialPlan: { paymentMode: 'Package', totalAgreedAmount: 4000, totalPaidSoFar: 2000, remainingDebt: 2000 }
//     },
//     financialPlan: { paymentMode: 'Package', totalAgreedAmount: 4000, totalPaidSoFar: 2000, remainingDebt: 2000 }
//   },
//   { 
//     id: '2', 
//     nameEn: 'Mona Zaki', 
//     nameAr: 'منى زكي', 
//     avatar: 'MZ', 
//     gender: 'Female', 
//     phone: '+201112345672', 
//     address: 'Zayed City, Giza',
//     occupation: 'Marketing Director',
//     paymentType: 'Insurance', 
//     lastVisit: `${pastDate}T00:00:00Z`, 
//     documents: { medicalConsent: true, liabilityWaiver: true, idCard: true },
//     insuranceDetails: { company: 'Bupa', status: 'Approved', copayPercentage: 20, approvedSessions: 10, memberId: 'BUP-772910', employer: 'Vodafone Egypt' },
//     treatmentPlan: {
//       totalSessions: 10,
//       primaryDoctorId: 'doc_1',
//       financialPlan: { paymentMode: 'Upfront-Copay', totalAgreedAmount: 1000, totalPaidSoFar: 1000, remainingDebt: 0 }
//     },
//     financialPlan: { paymentMode: 'Upfront-Copay', totalAgreedAmount: 1000, totalPaidSoFar: 1000, remainingDebt: 0 }
//   },
//   { id: '3', nameEn: 'Omar Hassan', nameAr: 'عمر حسن', avatar: 'OH', gender: 'Male', phone: '+201212345673', address: 'Dokki, Giza', occupation: 'Accountant', paymentType: 'Online', lastVisit: `${pastDate}T00:00:00Z`, documents: { medicalConsent: true, liabilityWaiver: false, idCard: true } },
//   { id: '4', nameEn: 'Laila Tarek', nameAr: 'ليلى طارق', avatar: 'LT', gender: 'Female', phone: '+201222333444', address: 'Nasr City, Cairo', occupation: 'Architect', paymentType: 'Cash', lastVisit: `${pastDate}T00:00:00Z`, documents: { medicalConsent: true, liabilityWaiver: true, idCard: true } },

//   // --- مرضى جدد (أول زيارة لهم اليوم) ---
//   { id: '5', nameEn: 'Youssef Ali', nameAr: 'يوسف علي', avatar: 'YA', gender: 'Male', phone: '+201112223345', address: 'New Cairo, Cairo', occupation: 'Civil Engineer', paymentType: 'Cash', lastVisit: `${today}T00:00:00Z`, documents: { medicalConsent: false, liabilityWaiver: false, idCard: false } },
//   { id: '6', nameEn: 'Sara Mahmoud', nameAr: 'سارة محمود', avatar: 'SM', gender: 'Female', phone: '+201011122236', address: 'Heliopolis, Cairo', occupation: 'Teacher', paymentType: 'Online', lastVisit: `${today}T00:00:00Z`, documents: { medicalConsent: false, liabilityWaiver: true, idCard: false } },
//   { 
//     id: '7', 
//     nameEn: 'Karim Nabil', 
//     nameAr: 'كريم نبيل', 
//     avatar: 'KN', 
//     gender: 'Male', 
//     phone: '+201200112233', 
//     address: 'Mohandessin, Giza',
//     occupation: 'Financial Analyst',
//     paymentType: 'Insurance', 
//     lastVisit: `${today}T00:00:00Z`, 
//     documents: { medicalConsent: true, liabilityWaiver: false, idCard: true },
//     insuranceDetails: { company: 'AXA', status: 'Pending', memberId: 'AXA-88412', employer: 'CIB Bank' }
//   }
// ];

// export const mockDoctors: Doctor[] = [
//   { id: 'doc_1', name: 'Dr. Sarah', gender: 'Female' },
//   { id: 'doc_2', name: 'Dr. Omar', gender: 'Male' },
//   { id: 'doc_3', name: 'Dr. Noha', gender: 'Female' },
//   { id: 'doc_4', name: 'Dr. Adel', gender: 'Male' },
//   { id: 'doc_5', name: 'Dr. Hassan', gender: 'Male' }
// ];

// export const mockRooms: Room[] = [
//   { id: 'room_1', displayName: 'Room 1', status: 'Occupied', doctorId: 'doc_2', currentLoad: 1, capacity: 1 },
//   { id: 'room_2', displayName: 'Room 2', status: 'Occupied', doctorId: 'doc_1', currentLoad: 1, capacity: 1 },
//   { id: 'room_3', displayName: 'Room 3', status: 'Available', doctorId: null, currentLoad: 0, capacity: 1 },
//   { id: 'room_4', displayName: 'Room 4', status: 'Maintenance', doctorId: null, currentLoad: 0, capacity: 1 },
//   { id: 'room_5', displayName: 'Room 5', status: 'Available', doctorId: null, currentLoad: 0, capacity: 1 },
// ];

// export const mockSessions: Session[] = [
//   // ==========================================
//   // 1. التاريخ القديم (Assessment History) - لا تظهر في جدول اليوم
//   // ==========================================
//   { id: 'hist_1', scheduledAt: `${pastDate}T10:00:00`, patientId: '1', doctorId: 'doc_4', roomId: 'room_1', status: 'Completed', type: 'Assessment', sessionNumber: 1, checkInTime: `${pastDate}T09:55:00Z`, checkOutTime: `${pastDate}T10:45:00Z` },
//   { id: 'hist_2', scheduledAt: `${pastDate}T11:00:00`, patientId: '2', doctorId: 'doc_3', roomId: 'room_2', status: 'Completed', type: 'Assessment' },
//   { id: 'hist_3', scheduledAt: `${pastDate}T12:00:00`, patientId: '3', doctorId: 'doc_5', roomId: 'room_3', status: 'Completed', type: 'Assessment' },
//   { id: 'hist_4', scheduledAt: `${pastDate}T13:00:00`, patientId: '4', doctorId: 'doc_1', roomId: 'room_5', status: 'Completed', type: 'Assessment' },

//   // ==========================================
//   // 2. جلسات اليوم (Today's Schedule)
//   // ==========================================

//   // جلسات جارية الآن (تطابق مع الغرف المشغولة 1 و 2)
//   { id: '1', scheduledAt: `${today}T09:00:00`, patientId: '1', doctorId: 'doc_2', roomId: 'room_1', status: 'In Progress', type: 'Session', sessionNumber: 3, checkInTime: `${today}T08:58:00Z` },
//   { id: '2', scheduledAt: `${today}T09:30:00`, patientId: '2', doctorId: 'doc_1', roomId: 'room_2', status: 'In Progress', type: 'Session', packageAlert: 'Session 1 of 5' },

//   // جلسات قادمة لمرضى قدامى (Sessions)
//   { id: '3', scheduledAt: `${today}T11:00:00`, patientId: '3', doctorId: 'doc_4', roomId: 'room_3', status: 'Pending', type: 'Session' },
//   { id: '4', scheduledAt: `${today}T12:00:00`, patientId: '4', doctorId: 'doc_3', roomId: 'room_5', status: 'Confirmed', type: 'Session' },

//   // تقييمات قادمة لمرضى جدد (Assessments)
//   { id: '5', scheduledAt: `${today}T13:30:00`, patientId: '5', doctorId: 'doc_5', roomId: 'room_3', status: 'Confirmed', type: 'Assessment' },
//   { id: '6', scheduledAt: `${today}T14:00:00`, patientId: '6', doctorId: 'doc_1', roomId: 'room_5', status: 'Pending', type: 'Assessment' },

//   // جلسة انتهت اليوم صباحاً
//   { id: '7', scheduledAt: `${today}T08:00:00`, patientId: '1', doctorId: 'doc_2', roomId: 'room_3', status: 'Completed', type: 'Session', sessionNumber: 2, checkInTime: `${today}T07:55:00Z`, checkOutTime: `${today}T08:50:00Z` },

//   // ==========================================
//   // 3. جلسات مستقبلية (Placeholder Sessions للمريض أحمد فتحي حتى الجلسة 10)
//   // ==========================================
//   { id: 'p1_s4', patientId: '1', doctorId: 'doc_2', status: 'Pending', type: 'Session', sessionNumber: 4 },
//   { id: 'p1_s5', patientId: '1', doctorId: 'doc_2', status: 'Pending', type: 'Session', sessionNumber: 5 },
//   { id: 'p1_s6', patientId: '1', doctorId: 'doc_2', status: 'Pending', type: 'Session', sessionNumber: 6 },
//   { id: 'p1_s7', patientId: '1', doctorId: 'doc_2', status: 'Pending', type: 'Session', sessionNumber: 7 },
//   { id: 'p1_s8', patientId: '1', doctorId: 'doc_2', status: 'Pending', type: 'Session', sessionNumber: 8 },
//   { id: 'p1_s9', patientId: '1', doctorId: 'doc_2', status: 'Pending', type: 'Session', sessionNumber: 9 },
//   { id: 'p1_s10', patientId: '1', doctorId: 'doc_2', status: 'Pending', type: 'Session', sessionNumber: 10 },
// ];

// export const mockInvoices: Invoice[] = [
//   // فواتير الجلسات التاريخية (Historical Sessions)
//   { id: 'INV-H01', sessionId: 'hist_1', patientId: '1', amount: 500, currency: 'EGP', status: 'Paid', type: 'Assessment', createdAt: `${pastDate}T10:00:00Z` },
//   { id: 'INV-H02', sessionId: 'hist_2', patientId: '2', amount: 20, currency: 'EGP', status: 'Pending', type: 'Assessment', createdAt: `${pastDate}T11:00:00Z` },
//   { id: 'INV-H03', sessionId: 'hist_3', patientId: '3', amount: 500, currency: 'EGP', status: 'Pending', type: 'Assessment', createdAt: `${pastDate}T12:00:00Z` },
//   { id: 'INV-H04', sessionId: 'hist_4', patientId: '4', amount: 500, currency: 'EGP', status: 'Pending', type: 'Assessment', createdAt: `${pastDate}T13:00:00Z` },

//   // فواتير جلسات اليوم (Today's Scheduled Sessions)
//   { id: 'INV-1001', sessionId: '1', patientId: '1', amount: 500, currency: 'EGP', status: 'Pending', type: 'Session', createdAt: `${today}T09:00:00Z` },
//   { id: 'INV-1002', sessionId: '2', patientId: '2', amount: 20, currency: 'EGP', status: 'Pending', type: 'Session', createdAt: `${today}T09:30:00Z` },
//   { id: 'INV-1003', sessionId: '3', patientId: '3', amount: 500, currency: 'EGP', status: 'Pending', type: 'Session', createdAt: `${today}T11:00:00Z` },
//   { id: 'INV-1004', sessionId: '4', patientId: '4', amount: 500, currency: 'EGP', status: 'Pending', type: 'Session', createdAt: `${today}T12:00:00Z` },
//   { id: 'INV-1005', sessionId: '5', patientId: '5', amount: 500, currency: 'EGP', status: 'Pending', type: 'Assessment', createdAt: `${today}T13:30:00Z` },
//   { id: 'INV-1006', sessionId: '6', patientId: '6', amount: 500, currency: 'EGP', status: 'Pending', type: 'Assessment', createdAt: `${today}T14:00:00Z` },
//   { id: 'INV-1007', sessionId: '7', patientId: '1', amount: 500, currency: 'EGP', status: 'Pending', type: 'Session', createdAt: `${today}T08:00:00Z` }
// ];

// export const mockDoctorAvailability: DoctorAvailability[] = [
//   // يعكس الحمل الحالي للأطباء بناءً على الجلسات الـ In Progress
//   { doctorId: 'doc_2', currentLoad: 1, roomId: 'room_1' },
//   { doctorId: 'doc_1', currentLoad: 1, roomId: 'room_2' },
//   { doctorId: 'doc_3', currentLoad: 0, roomId: 'room_3' }, // متاح
//   { doctorId: 'doc_4', currentLoad: 0, roomId: 'room_5' }, // متاح
//   { doctorId: 'doc_5', currentLoad: 0, roomId: 'room_3' }  // متاح
// ];

// // تم تفريغ قائمة الانتظار بناءً على قرارك بإلغائها من واجهة الاستقبال
// export const mockWaitlist: WaitlistItem[] = [];
// export const mockDoctorSlots: DoctorSlot[] = [];

import { Patient } from '../models/patient.model';
import { Session } from '../models/session.model';
import { Room } from '../models/room.model';
import { Invoice } from '../models/invoice.model';
import { Doctor, DoctorSlot, DoctorAvailability } from '../models/doctor.model';
import { WaitlistItem } from '../models/waitlist.model';

// --- التواريخ الديناميكية لضمان التسلسل المنطقي ---
const todayObj = new Date();
const today = todayObj.toISOString().split('T')[0];

const getPastDate = (daysAgo: number) => {
  const d = new Date(todayObj);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
};

const getFutureDate = (daysAhead: number) => {
  const d = new Date(todayObj);
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
};

// ==========================================
// 1. المرضى (Patients) - تغطية كل الحالات
// ==========================================
export const mockPatients: Patient[] = [
  // 1. مريض في منتصف الباقة (Session 5 of 10) - عليه مديونية
  {
    id: 'p1', nameEn: 'Ahmed Fathy', nameAr: 'أحمد فتحي', avatar: 'AF', gender: 'Male',
    phone: '+201012345671', address: 'Maadi', occupation: 'Engineer', paymentType: 'Cash',
    lastVisit: getPastDate(5) + 'T10:00:00.000Z',
    documents: { medicalConsent: true, liabilityWaiver: true, idCard: true },
    treatmentPlan: { totalSessions: 10, primaryDoctorId: 'doc_2', financialPlan: { paymentMode: 'Package', totalAgreedAmount: 5000, totalPaidSoFar: 2500, remainingDebt: 2500 } },
    financialPlan: { paymentMode: 'Package', totalAgreedAmount: 5000, totalPaidSoFar: 2500, remainingDebt: 2500 }
  },

  // 2. مريض في آخر جلسة (Session 10 of 10) - تأمين ودافع كل اللي عليه
  {
    id: 'p2', nameEn: 'Mona Zaki', nameAr: 'منى زكي', avatar: 'MZ', gender: 'Female',
    phone: '+201112345672', address: 'Zayed', occupation: 'Director', paymentType: 'Insurance',
    lastVisit: getPastDate(2) + 'T11:00:00.000Z',
    documents: { medicalConsent: true, liabilityWaiver: true, idCard: true },
    insuranceDetails: { company: 'Bupa', status: 'Approved', copayPercentage: 20, approvedSessions: 10, memberId: 'BUP-772910' },
    treatmentPlan: { totalSessions: 10, primaryDoctorId: 'doc_1', financialPlan: { paymentMode: 'Upfront-Copay', totalAgreedAmount: 1000, totalPaidSoFar: 1000, remainingDebt: 0 } },
    financialPlan: { paymentMode: 'Upfront-Copay', totalAgreedAmount: 1000, totalPaidSoFar: 1000, remainingDebt: 0 }
  },

  // 3. مريض في أول جلسة علاج (Session 1 of 6) - نظام الحساب بالجلسة
  {
    id: 'p3', nameEn: 'Omar Hassan', nameAr: 'عمر حسن', avatar: 'OH', gender: 'Male',
    phone: '+201212345673', address: 'Dokki', occupation: 'Accountant', paymentType: 'Cash',
    lastVisit: getPastDate(1) + 'T12:00:00.000Z',
    documents: { medicalConsent: true, liabilityWaiver: false, idCard: true },
    treatmentPlan: { totalSessions: 6, primaryDoctorId: 'doc_4', financialPlan: { paymentMode: 'Per-Session', totalAgreedAmount: 3000, totalPaidSoFar: 0, remainingDebt: 0 } },
    financialPlan: { paymentMode: 'Per-Session', totalAgreedAmount: 3000, totalPaidSoFar: 0, remainingDebt: 0 }
  },

  // 4. مريض جديد تماماً (Assessment Only اليوم)
  {
    id: 'p4', nameEn: 'Sara Mahmoud', nameAr: 'سارة محمود', avatar: 'SM', gender: 'Female',
    phone: '+201011122236', address: 'Heliopolis', occupation: 'Teacher', paymentType: 'Online',
    lastVisit: today + 'T09:00:00.000Z',
    documents: { medicalConsent: false, liabilityWaiver: false, idCard: false }
  }
];

// ==========================================
// 2. الجلسات (Sessions) - تسلسل زمني منطقي
// ==========================================
export const mockSessions: Session[] = [
  // --- المريض 1 (أحمد): خلص 4 جلسات، الـ 5 النهاردة، وباقي 5 مستقبلية ---
  { id: 'p1_s0', patientId: 'p1', doctorId: 'doc_2', type: 'Assessment', status: 'Completed', scheduledAt: `${getPastDate(15)}T10:00:00`, roomId: 'room_1' },
  { id: 'p1_s1', patientId: 'p1', doctorId: 'doc_2', type: 'Session', sessionNumber: 1, status: 'Completed', scheduledAt: `${getPastDate(12)}T10:00:00`, roomId: 'room_1' },
  { id: 'p1_s2', patientId: 'p1', doctorId: 'doc_2', type: 'Session', sessionNumber: 2, status: 'Completed', scheduledAt: `${getPastDate(9)}T10:00:00`, roomId: 'room_1' },
  { id: 'p1_s3', patientId: 'p1', doctorId: 'doc_2', type: 'Session', sessionNumber: 3, status: 'Completed', scheduledAt: `${getPastDate(6)}T10:00:00`, roomId: 'room_1' },
  { id: 'p1_s4', patientId: 'p1', doctorId: 'doc_2', type: 'Session', sessionNumber: 4, status: 'Completed', scheduledAt: `${getPastDate(3)}T10:00:00`, roomId: 'room_1' },
  { id: 'p1_s5', patientId: 'p1', doctorId: 'doc_2', type: 'Session', sessionNumber: 5, status: 'In Progress', scheduledAt: `${today}T10:00:00`, roomId: 'room_1', checkInTime: `${today}T09:55:00Z` }, // شغال دلوقتي
  { id: 'p1_s6', patientId: 'p1', doctorId: 'doc_2', type: 'Session', sessionNumber: 6, status: 'Pending', scheduledAt: `${getFutureDate(3)}T10:00:00` }, // المستقبل بدون غرف
  { id: 'p1_s7', patientId: 'p1', doctorId: 'doc_2', type: 'Session', sessionNumber: 7, status: 'Pending', scheduledAt: `${getFutureDate(6)}T10:00:00` },
  { id: 'p1_s8', patientId: 'p1', doctorId: 'doc_2', type: 'Session', sessionNumber: 8, status: 'Pending', scheduledAt: `${getFutureDate(9)}T10:00:00` },
  { id: 'p1_s9', patientId: 'p1', doctorId: 'doc_2', type: 'Session', sessionNumber: 9, status: 'Pending', scheduledAt: `${getFutureDate(12)}T10:00:00` },
  { id: 'p1_s10', patientId: 'p1', doctorId: 'doc_2', type: 'Session', sessionNumber: 10, status: 'Pending', scheduledAt: `${getFutureDate(15)}T10:00:00` },

  // --- المريض 2 (منى): خلصت 9 جلسات، والـ 10 النهاردة ---
  { id: 'p2_s0', patientId: 'p2', doctorId: 'doc_1', type: 'Assessment', status: 'Completed', scheduledAt: `${getPastDate(30)}T11:00:00`, roomId: 'room_2' },
  { id: 'p2_s1', patientId: 'p2', doctorId: 'doc_1', type: 'Session', sessionNumber: 1, status: 'Completed', scheduledAt: `${getPastDate(27)}T11:00:00`, roomId: 'room_2' },
  // ... (تجاوزت كتابة 8 جلسات ماضية للاختصار، بنعتبرهم خلصوا)
  { id: 'p2_s9', patientId: 'p2', doctorId: 'doc_1', type: 'Session', sessionNumber: 9, status: 'Completed', scheduledAt: `${getPastDate(3)}T11:00:00`, roomId: 'room_2' },
  { id: 'p2_s10', patientId: 'p2', doctorId: 'doc_1', type: 'Session', sessionNumber: 10, status: 'In Progress', scheduledAt: `${today}T11:00:00`, roomId: 'room_2', checkInTime: `${today}T10:50:00Z` }, // شغالة دلوقتي

  // --- المريض 3 (عمر): عمل التقييم زمان، والنهاردة أول جلسة ---
  { id: 'p3_s0', patientId: 'p3', doctorId: 'doc_4', type: 'Assessment', status: 'Completed', scheduledAt: `${getPastDate(5)}T12:00:00`, roomId: 'room_3' },
  { id: 'p3_s1', patientId: 'p3', doctorId: 'doc_4', type: 'Session', sessionNumber: 1, status: 'Confirmed', scheduledAt: `${today}T12:00:00` }, // جاية كمان شوية
  { id: 'p3_s2', patientId: 'p3', doctorId: 'doc_4', type: 'Session', sessionNumber: 2, status: 'Pending', scheduledAt: `${getFutureDate(2)}T12:00:00` },
  { id: 'p3_s3', patientId: 'p3', doctorId: 'doc_4', type: 'Session', sessionNumber: 3, status: 'Pending', scheduledAt: `${getFutureDate(4)}T12:00:00` },

  // --- المريض 4 (سارة): تقييم النهاردة ---
  { id: 'p4_s0', patientId: 'p4', doctorId: 'doc_3', type: 'Assessment', status: 'Pending', scheduledAt: `${today}T14:00:00` }
];

// ==========================================
// 3. الفواتير (Invoices) - تعكس الموقف المالي بدقة
// ==========================================
export const mockInvoices: Invoice[] = [
  // فواتير المريض 1 (باقة: دفع قسط 2500 من أصل 5000)
  { id: 'INV-P1-ASSESS', sessionId: 'p1_s0', patientId: 'p1', amount: 500, currency: 'EGP', status: 'Paid', type: 'Assessment', createdAt: `${getPastDate(15)}T10:00:00Z` },
  { id: 'INV-P1-INST1', patientId: 'p1', amount: 2500, currency: 'EGP', status: 'Paid', type: 'Installment', isInstallment: true, createdAt: `${getPastDate(12)}T10:00:00Z` }, // القسط الأول الدفوع

  // فواتير المريض 2 (تأمين باقة: دفعت الـ 1000 نسبة التحمل مقدم)
  { id: 'INV-P2-ASSESS', sessionId: 'p2_s0', patientId: 'p2', amount: 0, currency: 'EGP', status: 'Waived', type: 'Assessment', createdAt: `${getPastDate(30)}T11:00:00Z` },
  { id: 'INV-P2-INST1', patientId: 'p2', amount: 1000, currency: 'EGP', status: 'Paid', type: 'Installment', isInstallment: true, createdAt: `${getPastDate(27)}T11:00:00Z`, patientShare: 1000, insuranceShare: 4000 },

  // فواتير المريض 3 (بالجلسة: دفع التقييم، وفاتورة جلسة النهاردة معلقة)
  { id: 'INV-P3-ASSESS', sessionId: 'p3_s0', patientId: 'p3', amount: 500, currency: 'EGP', status: 'Paid', type: 'Assessment', createdAt: `${getPastDate(5)}T12:00:00Z` },
  { id: 'INV-P3-S1', sessionId: 'p3_s1', patientId: 'p3', amount: 500, currency: 'EGP', status: 'Pending', type: 'Session', createdAt: `${today}T12:00:00Z` }, // مستني الدفع قبل الـ Checkout

  // فواتير المريض 4 (تقييم معلق)
  { id: 'INV-P4-ASSESS', sessionId: 'p4_s0', patientId: 'p4', amount: 500, currency: 'EGP', status: 'Pending', type: 'Assessment', createdAt: `${today}T14:00:00Z` }
];

// ==========================================
// 4. الدكاترة والغرف (Doctors & Rooms)
// ==========================================
export const mockDoctors: Doctor[] = [
  { id: 'doc_1', name: 'Dr. Sarah (Female)', gender: 'Female' },
  { id: 'doc_2', name: 'Dr. Omar (Male)', gender: 'Male' },
  { id: 'doc_3', name: 'Dr. Noha (Female)', gender: 'Female' },
  { id: 'doc_4', name: 'Dr. Adel (Male)', gender: 'Male' },
  { id: 'doc_5', name: 'Dr. Hassan (Male)', gender: 'Male' }
];

export const mockRooms: Room[] = [
  { id: 'room_1', displayName: 'Room 1', status: 'Occupied', doctorId: 'doc_2', currentLoad: 1, capacity: 1 }, // المريض الأول جوه
  { id: 'room_2', displayName: 'Room 2', status: 'Occupied', doctorId: 'doc_1', currentLoad: 1, capacity: 1 }, // المريض التاني جوه
  { id: 'room_3', displayName: 'Room 3', status: 'Available', doctorId: null, currentLoad: 0, capacity: 1 },
  { id: 'room_4', displayName: 'Room 4', status: 'Maintenance', doctorId: null, currentLoad: 0, capacity: 1 },
  { id: 'room_5', displayName: 'Room 5', status: 'Available', doctorId: null, currentLoad: 0, capacity: 1 },
];

export const mockDoctorAvailability: DoctorAvailability[] = [
  { doctorId: 'doc_2', currentLoad: 1, roomId: 'room_1' }, // شغال مع مريض 1
  { doctorId: 'doc_1', currentLoad: 1, roomId: 'room_2' }, // شغال مع مريض 2
  { doctorId: 'doc_3', currentLoad: 0, roomId: null as any }, // فاضي
  { doctorId: 'doc_4', currentLoad: 0, roomId: null as any }, // فاضي
  { doctorId: 'doc_5', currentLoad: 0, roomId: null as any }  // فاضي
];

export const mockWaitlist: WaitlistItem[] = [];
export const mockDoctorSlots: DoctorSlot[] = [];