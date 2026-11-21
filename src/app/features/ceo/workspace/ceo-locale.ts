import { ReceptionistLocale } from "../../../shared/receptionist-locale";
const ar: Record<string, string> = {
  "Enter a valid birth date that is not in the future.": "أدخل تاريخ ميلاد صالحاً لا يقع في المستقبل.",
  "Show password": "إظهار كلمة المرور",
  "Hide password": "إخفاء كلمة المرور",
  "Workload is grouped by recorded treating clinician. Unstarted or unknown work is shown separately.":
    "يجمع عبء العمل حسب المعالج المسجل فعلياً، وتظهر الأعمال غير المبدوءة أو مجهولة المعالج بشكل منفصل.",
  true: "نشط",
  false: "غير نشط",
  new: "جديد",
  "Company settings changed. Reload before saving.":
    "تغيرت إعدادات الشركة. أعد التحميل قبل الحفظ.",
  "Name, username and role are required.":
    "الاسم واسم المستخدم والدور مطلوبة.",
  Overview: "نظرة عامة",
  Reports: "التقارير",
  Settings: "الإعدادات",
  Staff: "الموظفون",
  "Insurance companies": "شركات التأمين",
  "Insurance finance": "مالية التأمين",
  From: "من",
  To: "إلى",
  Apply: "تطبيق",
  Clear: "مسح",
  Filters: "الفلاتر",
  Search: "بحث",
  All: "الكل",
  Active: "نشط",
  Inactive: "غير نشط",
  Status: "الحالة",
  Role: "الدور",
  Loading: "جار التحميل",
  Retry: "إعادة المحاولة",
  "No matching records": "لا توجد نتائج مطابقة",
  Previous: "السابق",
  Next: "التالي",
  Page: "صفحة",
  of: "من",
  Save: "حفظ",
  Saving: "جار الحفظ",
  Saved: "تم الحفظ",
  Cancel: "إلغاء",
  Close: "إغلاق",
  Edit: "تعديل",
  "Add staff": "إضافة موظف",
  "Add company": "إضافة شركة",
  Deactivate: "إيقاف",
  Activate: "تفعيل",
  Confirm: "تأكيد",
  "Patient collections": "تحصيلات المرضى",
  "Insurer collections": "تحصيلات التأمين",
  "Patient outstanding": "أرصدة المرضى المستحقة",
  "Earned insurer receivables": "مستحقات التأمين المكتسبة",
  "Monthly insurer statements": "كشوف التأمين الشهرية",
  "Appointment activity": "نشاط المواعيد",
  "Clinician workload": "عبء العمل السريري",
  "Collection period · Africa/Cairo": "فترة التحصيل · توقيت القاهرة",
  "Current balances": "الأرصدة الحالية",
  Generated: "وقت الإنشاء",
  "Planned insurer liability": "التزامات التأمين المخططة",
  "Scheduled visits": "المواعيد المجدولة",
  "Clinically completed": "مكتمل سريرياً",
  Cancelled: "ملغي",
  NoShow: "لم يحضر",
  "Clinical occupancy": "الإشغال السريري",
  "Active room capacity": "سعة الغرف النشطة",
  "Available room slots": "السعة المتبقية بالغرف",
  "Unsubmitted services": "خدمات لم تقدم مطالباتها",
  "Outstanding claims": "مطالبات غير مسددة",
  "Absence recovery": "تغطية الغياب",
  "Actual collections by Cairo day": "التحصيلات الفعلية حسب يوم القاهرة",
  Patients: "المرضى",
  Insurers: "شركات التأمين",
  "View report": "عرض التقرير",
  Report: "التقرير",
  "Export all matching CSV": "تصدير كل النتائج CSV",
  "Date basis": "أساس التاريخ",
  Collection: "التحصيل",
  "Current balance": "الرصيد الحالي",
  "Scheduled service start": "بداية الموعد المجدول",
  Patient: "المريض",
  Company: "الشركة",
  Clinician: "المعالج",
  Funding: "التمويل",
  Method: "طريقة الدفع",
  SelfPay: "دفع ذاتي",
  Insurance: "تأمين",
  Cash: "نقداً",
  Visa: "بطاقة",
  EWallet: "محفظة إلكترونية",
  BankTransfer: "تحويل بنكي",
  Online: "إلكتروني",
  Cheque: "شيك",
  Pending: "مجدول",
  InProgress: "جار التنفيذ",
  Completed: "مكتمل",
  Paid: "مدفوع",
  Outstanding: "مستحق",
  Reference: "المرجع",
  Date: "التاريخ",
  Amount: "القيمة",
  Collected: "المحصل",
  Remaining: "المتبقي",
  "Recorded clinical duration": "المدة السريرية المسجلة",
  "Missing clinical timestamps": "توقيتات سريرية مفقودة",
  Details: "التفاصيل",
  "Scheduled end": "نهاية الموعد المجدول",
  Arrival: "الوصول",
  Departure: "المغادرة",
  "Clinical start": "بداية العلاج",
  "Clinical end": "نهاية العلاج",
  Unavailable: "غير متاح",
  seconds: "ثانية",
  Name: "الاسم",
  Username: "اسم المستخدم",
  Gender: "النوع",
  Male: "ذكر",
  Female: "أنثى",
  "Birth date": "تاريخ الميلاد",
  "Future appointments": "مواعيد قادمة",
  "Working hours": "ساعات العمل",
  "Manage absence coverage": "إدارة تغطية الغياب",
  "Review staff status": "مراجعة حالة الموظف",
  "Resolve future work before deactivation. History is retained.":
    "يجب معالجة المواعيد القادمة قبل الإيقاف. يحتفظ النظام بالسجل.",
  "Company name": "اسم الشركة",
  "Portal URL": "رابط البوابة",
  Hotline: "الخط الساخن",
  "Deactivation prevents new selection. Saved agreements, claims and receipts stay unchanged.":
    "الإيقاف يمنع الاختيار الجديد مع الحفاظ على الاتفاقيات والمطالبات والإيصالات المحفوظة.",
  "Clinic name": "اسم المركز",
  Phone: "الهاتف",
  Address: "العنوان",
  Email: "البريد الإلكتروني",
  "Clinic identity": "بيانات المركز",
  "Used in the application header and CEO report exports.":
    "تظهر في عنوان التطبيق وتصدير تقارير الإدارة.",
  Timezone: "المنطقة الزمنية",
  Currency: "العملة",
  Reload: "إعادة تحميل",
  "Enter the required fields.": "أدخل الحقول المطلوبة.",
  "Could not save. Review the details and retry.":
    "تعذر الحفظ. راجع البيانات وأعد المحاولة.",
  "Could not load data. Retry.": "تعذر تحميل البيانات. أعد المحاولة.",
  "Settings changed. Reload before saving.":
    "تغيرت الإعدادات. أعد التحميل قبل الحفظ.",
  "Staff details changed. Reload before saving.":
    "تغيرت بيانات الموظف. أعد التحميل قبل الحفظ.",
  "You cannot deactivate your own account.": "لا يمكنك إيقاف حسابك الحالي.",
  "Resolve affected appointments through absence coverage or rescheduling before changing staff availability.":
    "عالج المواعيد المتأثرة من خلال تغطية الغياب أو إعادة الجدولة قبل تغيير توفر الموظف.",
  "Balances are current at generation time.":
    "الأرصدة الحالية محسوبة وقت إنشاء التقرير.",
  "Collection rows are payment allocations. A cheque is counted through its allocations only.":
    "صفوف التحصيل توزيعات الدفع. يحتسب الشيك من توزيعاته فقط.",
  "Service counts use scheduled starts; clinical completion uses recorded end timestamps.":
    "تعتمد أعداد الزيارات على البداية المجدولة والإكمال السريري على توقيت النهاية المسجل.",
  "Room slots exclude inactive rooms; clinician eligibility is checked when booking or starting treatment.":
    "تستبعد السعة الغرف غير النشطة؛ يتم التحقق من أهلية المعالج عند الحجز أو بدء العلاج.",
  "No correction or refund workflow is available. Posted history is protected.":
    "لا يتوفر مسار تصحيح أو استرداد مالي. السجل المالي المرحّل محمي.",
  "Open insurer statements": "فتح كشوف التأمين",
  "Patient ID": "رقم المريض",
  "Company ID": "رقم الشركة",
  "Clinician ID": "معرف المعالج",
  "Recorded sessions": "الجلسات المسجلة",
  "Matching rows": "النتائج المطابقة",
  Doctor: "طبيب",
  Senior: "أخصائي أول",
  Receptionist: "استقبال",
  Ceo: "مدير تنفيذي",
  Admin: "مسؤول",
  Owner: "مالك",
  "No period filter applies to current balances.":
    "لا يطبق فلتر الفترة على الأرصدة الحالية.",
};
export class CeoLocale extends ReceptionistLocale {
  t(value: string) {
    return this.language === "ar-EG" ? (ar[value] ?? this.label(value)) : value;
  }
  today() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Cairo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }
  failure(
    error: unknown,
    fallback = "Could not save. Review the details and retry.",
  ) {
    const e = error as {
      error?: {
        detail?: string;
        description?: string;
        errors?: Record<string, string[]>;
      };
    };
    const message = e.error?.detail ?? e.error?.description;
    if (message && (this.language === "en-US" || ar[message]))
      return this.t(message);
    return this.t(fallback);
  }
}
