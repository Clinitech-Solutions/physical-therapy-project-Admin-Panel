import os
import json

data = {
  "COMMON": {
    "ENGLISH": "English",
    "ARABIC": "عربي",
    "TIME": "الوقت",
    "PATIENT": "المريض",
    "DOCTOR": "الطبيب",
    "ROOM": "الغرفة",
    "STATUS": "الحالة",
    "ACTION": "إجراء",
    "VIEW": "عرض",
    "START": "بدء",
    "COMPLETED": "مكتمل",
    "WAITING": "انتظار",
    "IN_PROGRESS": "قيد التقدم",
    "LOGOUT": "تسجيل الخروج"
  },
  "SIDEBAR": {
    "DASHBOARD": "لوحة التحكم",
    "PATIENTS": "المرضى",
    "BOOKINGS": "الحجوزات",
    "ASSESSMENTS": "التقييمات",
    "TODAYS_SCHEDULE": "جدول اليوم",
    "MY_PATIENTS": "مرضاي",
    "OVERVIEW": "نظرة عامة",
    "STAFF": "الموظفين",
    "REPORTS": "التقارير"
  },
  "RECEPTIONIST": {
    "DASHBOARD_TITLE": "لوحة تحكم موظف الاستقبال",
    "DASHBOARD_SUB": "نظرة عامة على نشاط العيادة اليوم",
    "TODAYS_SESSIONS": "جلسات اليوم",
    "COMPLETED_LC": "مكتملة",
    "PRESENT_DOCTORS": "الأطباء الحاضرين",
    "ABSENT_TODAY": "غائبين اليوم",
    "WALKINS": "زيارات بدون موعد",
    "HIGH": "مرتفع",
    "TRAFFIC": "ازدحام",
    "PENDING_PAYMENTS": "مدفوعات معلقة",
    "REQUIRES_ATTENTION": "تتطلب الانتباه",
    "TIMELINE_TITLE": "الجدول الزمني لجلسات اليوم",
    "ROOM_1": "غرفة 1",
    "ROOM_3": "غرفة 3"
  },
  "DOCTOR": {
    "DASHBOARD_TITLE": "جدول اليوم",
    "DASHBOARD_SUB": "جلساتك القادمة",
    "ROOM_1": "غرفة 1",
    "ROOM_3": "غرفة 3",
    "SESSION_4_10": "جلسة 4 من 10",
    "SESSION_8_12": "جلسة 8 من 12",
    "START_SESSION": "بدء الجلسة",
    "AVAILABLE_SLOT": "موعد متاح",
    "ASSESSMENT": "تقييم"
  },
  "SENIOR": {
    "DASHBOARD_TITLE": "لوحة تحكم كبير المعالجين",
    "DASHBOARD_SUB": "نظرة عامة على التقييمات وقسم العيادة",
    "TODAYS_TASKS": "مهام اليوم",
    "ASSESSMENTS_4": "تقييمات (4)",
    "REASSESSMENTS_2": "إعادة التقييم (2)",
    "LIVE_VIEW_CAPACITY": "عرض مباشر - طاقة الأطباء"
  },
  "CEO": {
    "DASHBOARD_TITLE": "نظرة عامة تنفيذية",
    "DASHBOARD_SUB": "مقاييس الأداء في الوقت الفعلي",
    "EXPORT_REPORT": "تصدير التقرير",
    "TODAYS_REVENUE": "إيرادات اليوم",
    "VS_YESTERDAY": "مقارنة بالأمس",
    "ACTIVE_PATIENTS": "المرضى النشطين",
    "NEW_TODAY": "جديد اليوم",
    "SESSIONS_TODAY": "جلسات اليوم",
    "ATTENDANCE": "حضور",
    "PENDING_PAYMENTS": "المدفوعات المعلقة",
    "INSURANCE_DELAYS": "تأخير التأمين",
    "REVENUE_TREND": "اتجاه الإيرادات (30 يوماً)",
    "RECENT_ACTIVITY": "النشاط الأخير",
    "BOOKED_SESSION": "حجزت جلسة",
    "MINS_AGO_2": "منذ دقيقتين",
    "COMPLETED_ASSESSMENT": "أكملت التقييم",
    "MINS_AGO_15": "منذ 15 دقيقة",
    "MARKED_ABSENT": "سُجل غائباً",
    "HOUR_AGO_1": "منذ ساعة"
  }
}

file_path = os.path.join(r"d:\TPC\admin panel\physical-therapy-project-Admin-Panel", r"public\assets\i18n\ar.json")

with open(file_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Created ar.json")
