const fs = require('fs');
const path = require('path');

const mappings = [
  // CEO
  ["{{ langService.currentLang() === 'en' ? 'Executive Overview' : 'نظرة عامة تنفيذية' }}", "{{ 'CEO.DASHBOARD_TITLE' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Real-time performance metrics' : 'مقاييس الأداء في الوقت الفعلي' }}", "{{ 'CEO.DASHBOARD_SUB' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Export Report' : 'تصدير التقرير' }}", "{{ 'CEO.EXPORT_REPORT' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? \"Today's Revenue\" : 'إيرادات اليوم' }}", "{{ 'CEO.TODAYS_REVENUE' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'vs yesterday' : 'مقارنة بالأمس' }}", "{{ 'CEO.VS_YESTERDAY' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Active Patients' : 'المرضى النشطين' }}", "{{ 'CEO.ACTIVE_PATIENTS' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'new today' : 'جديد اليوم' }}", "{{ 'CEO.NEW_TODAY' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Sessions Today' : 'جلسات اليوم' }}", "{{ 'CEO.SESSIONS_TODAY' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'attendance' : 'حضور' }}", "{{ 'CEO.ATTENDANCE' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Pending Payments' : 'المدفوعات المعلقة' }}", "{{ 'CEO.PENDING_PAYMENTS' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Insurance delays' : 'تأخير التأمين' }}", "{{ 'CEO.INSURANCE_DELAYS' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Revenue Trend (30 Days)' : 'اتجاه الإيرادات (30 يوماً)' }}", "{{ 'CEO.REVENUE_TREND' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Recent Activity' : 'النشاط الأخير' }}", "{{ 'CEO.RECENT_ACTIVITY' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'booked a session' : 'حجزت جلسة' }}", "{{ 'CEO.BOOKED_SESSION' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? '2 mins ago' : 'منذ دقيقتين' }}", "{{ 'CEO.MINS_AGO_2' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'completed assessment' : 'أكملت التقييم' }}", "{{ 'CEO.COMPLETED_ASSESSMENT' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? '15 mins ago' : 'منذ 15 دقيقة' }}", "{{ 'CEO.MINS_AGO_15' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'marked absent' : 'سُجل غائباً' }}", "{{ 'CEO.MARKED_ABSENT' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? '1 hour ago' : 'منذ ساعة' }}", "{{ 'CEO.HOUR_AGO_1' | translate }}"],

  // Receptionist
  ["{{ langService.currentLang() === 'en' ? 'Receptionist Dashboard' : 'لوحة تحكم موظف الاستقبال' }}", "{{ 'RECEPTIONIST.DASHBOARD_TITLE' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? \"Overview of today's clinic activity\" : 'نظرة عامة على نشاط العيادة اليوم' }}", "{{ 'RECEPTIONIST.DASHBOARD_SUB' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? \"Today's Sessions\" : 'جلسات اليوم' }}", "{{ 'RECEPTIONIST.TODAYS_SESSIONS' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'completed' : 'مكتملة' }}", "{{ 'RECEPTIONIST.COMPLETED_LC' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Present Doctors' : 'الأطباء الحاضرين' }}", "{{ 'RECEPTIONIST.PRESENT_DOCTORS' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'absent today' : 'غائبين اليوم' }}", "{{ 'RECEPTIONIST.ABSENT_TODAY' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Walk-ins' : 'زيارات بدون موعد' }}", "{{ 'RECEPTIONIST.WALKINS' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'High' : 'مرتفع' }}", "{{ 'RECEPTIONIST.HIGH' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'traffic' : 'ازدحام' }}", "{{ 'RECEPTIONIST.TRAFFIC' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Pending Payments' : 'مدفوعات معلقة' }}", "{{ 'RECEPTIONIST.PENDING_PAYMENTS' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Requires attention' : 'تتطلب الانتباه' }}", "{{ 'RECEPTIONIST.REQUIRES_ATTENTION' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? \"Today's Sessions Timeline\" : 'الجدول الزمني لجلسات اليوم' }}", "{{ 'RECEPTIONIST.TIMELINE_TITLE' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Time' : 'الوقت' }}", "{{ 'COMMON.TIME' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Patient' : 'المريض' }}", "{{ 'COMMON.PATIENT' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Doctor' : 'الطبيب' }}", "{{ 'COMMON.DOCTOR' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Room' : 'الغرفة' }}", "{{ 'COMMON.ROOM' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Status' : 'الحالة' }}", "{{ 'COMMON.STATUS' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Action' : 'إجراء' }}", "{{ 'COMMON.ACTION' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Completed' : 'مكتمل' }}", "{{ 'COMMON.COMPLETED' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'View' : 'عرض' }}", "{{ 'COMMON.VIEW' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'In Progress' : 'قيد التقدم' }}", "{{ 'COMMON.IN_PROGRESS' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Waiting' : 'انتظار' }}", "{{ 'COMMON.WAITING' | translate }}"],

  // Doctor
  ["{{ langService.currentLang() === 'en' ? \"Today's Schedule\" : 'جدول اليوم' }}", "{{ 'DOCTOR.DASHBOARD_TITLE' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Your upcoming sessions' : 'جلساتك القادمة' }}", "{{ 'DOCTOR.DASHBOARD_SUB' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Room 1' : 'غرفة 1' }}", "{{ 'DOCTOR.ROOM_1' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Room 3' : 'غرفة 3' }}", "{{ 'DOCTOR.ROOM_3' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Session 4 of 10' : 'جلسة 4 من 10' }}", "{{ 'DOCTOR.SESSION_4_10' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Session 8 of 12' : 'جلسة 8 من 12' }}", "{{ 'DOCTOR.SESSION_8_12' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Start Session' : 'بدء الجلسة' }}", "{{ 'DOCTOR.START_SESSION' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Available Slot' : 'موعد متاح' }}", "{{ 'DOCTOR.AVAILABLE_SLOT' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Assessment' : 'تقييم' }}", "{{ 'DOCTOR.ASSESSMENT' | translate }}"],

  // Senior
  ["{{ langService.currentLang() === 'en' ? 'Senior Dashboard' : 'لوحة تحكم كبير المعالجين' }}", "{{ 'SENIOR.DASHBOARD_TITLE' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Overview of assessments and clinic floor' : 'نظرة عامة على التقييمات وقسم العيادة' }}", "{{ 'SENIOR.DASHBOARD_SUB' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? \"Today's Tasks\" : 'مهام اليوم' }}", "{{ 'SENIOR.TODAYS_TASKS' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Assessments (4)' : 'تقييمات (4)' }}", "{{ 'SENIOR.ASSESSMENTS_4' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Re-assessments (2)' : 'إعادة التقييم (2)' }}", "{{ 'SENIOR.REASSESSMENTS_2' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Start' : 'بدء' }}", "{{ 'COMMON.START' | translate }}"],
  ["{{ langService.currentLang() === 'en' ? 'Live View - Doctors Capacity' : 'عرض مباشر - طاقة الأطباء' }}", "{{ 'SENIOR.LIVE_VIEW_CAPACITY' | translate }}"]
];

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [find, replace] of mappings) {
    content = content.split(find).join(replace);
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

const files = [
  'src/app/features/ceo/dashboard/dashboard.html',
  'src/app/features/receptionist/dashboard/dashboard.html',
  'src/app/features/doctor/dashboard/dashboard.html',
  'src/app/features/senior/dashboard/dashboard.html'
];

for (const file of files) {
  const f = path.join(__dirname, file);
  if (fs.existsSync(f)) {
    replaceInFile(f);
  } else {
    console.log('Not found:', f);
  }
}
