import os
import json

base_dir = r"d:\TPC\admin panel\physical-therapy-project-Admin-Panel"

# 1. Update Translations JSON
en_path = os.path.join(base_dir, "public", "assets", "i18n", "en.json")
ar_path = os.path.join(base_dir, "public", "assets", "i18n", "ar.json")

with open(en_path, "r", encoding="utf-8") as f:
    en_data = json.load(f)

if "RECEPTIONIST" not in en_data:
    en_data["RECEPTIONIST"] = {}

en_updates = {
    "ROOMS_TITLE": "Rooms",
    "ROOMS_SUB": "Monitor and manage room assignments",
    "REASSIGN_DOCTOR": "Reassign Doctor",
    "CLEAR_ROOM": "Clear Room",
    "UNDER_MAINTENANCE": "Under maintenance",
    "READY_FOR_ASSIGNMENT": "Ready for assignment",
    "LOAD": "Load",
    "INSURANCE_TITLE": "Insurance",
    "INSURANCE_SUB": "Manage insurance patients and approvals",
    "COMPANY": "Company",
    "CO_PAY": "Co-pay %",
    "DOCUMENTS_PENDING": "Documents Pending",
    "SUBMITTED": "Submitted",
    "UNDER_REVIEW": "Under Review",
    "APPROVED": "Approved",
    "MANAGE": "Manage",
    "MANAGE_INSURANCE": "Manage Insurance",
    "CURRENT_STATUS": "Current Status",
    "UPLOAD_DOCS": "Upload Documents (ID, Card, Referral)",
    "DRAG_DROP": "Drag & Drop or Click to Upload",
    "INSURANCE_COMPANY": "Insurance Company",
    "PACKAGE": "Package",
    "SELECT_PACKAGE": "Select Package...",
    "GOLD_NETWORK": "Gold Network",
    "SILVER_NETWORK": "Silver Network",
    "RECORD_COPAY": "Record Co-pay %",
    "SAVE_COPAY": "Save Co-pay %",
    "SUBMIT_TO_INSURER": "Submit to Insurer",
    "BILLING_TITLE": "Billing",
    "BILLING_SUB": "Manage payments and invoicing",
    "CASH_PAYMENTS": "Pending Cash Payments",
    "ONLINE_PAYMENTS": "Online Payments",
    "INVOICE_ID": "Invoice ID",
    "TYPE": "Type",
    "DATE": "Date",
    "AMOUNT": "Amount",
    "COLLECT": "Collect",
    "PRINT": "Print",
    "WALKIN_TITLE": "Find Nearest Available Slot",
    "WALKIN_SUB": "Search for walk-in availability",
    "PREFERRED_TIME": "Preferred Time",
    "SEARCH": "Search",
    "GENDER": "Gender",
    "MALE": "Male",
    "FEMALE": "Female",
    "BOOKINGS_TITLE": "Bookings",
    "BOOKINGS_SUB": "Schedule assessments and therapy sessions",
    "BOOK_ASSESSMENT": "Book Assessment",
    "BOOK_SESSION": "Book Session",
    "PATIENTS_TITLE": "Patients",
    "PATIENTS_SUB": "Manage patient profiles and history",
    "ADD_PATIENT": "Add New Patient",
    "SEARCH_PLACEHOLDER": "Search by name or phone number...",
    "GENDER_TH": "Gender",
    "PHONE": "Phone",
    "PAYMENT_TYPE": "Payment Type",
    "LAST_VISIT": "Last Visit",
    "FULL_NAME_EN": "Full Name (English)",
    "FULL_NAME_AR": "Full Name (Arabic)",
    "DOB": "Date of Birth",
    "CREATE_PROFILE": "Create Profile"
}
en_data["RECEPTIONIST"].update(en_updates)

with open(en_path, "w", encoding="utf-8") as f:
    json.dump(en_data, f, indent=2, ensure_ascii=False)


with open(ar_path, "r", encoding="utf-8") as f:
    ar_data = json.load(f)

if "RECEPTIONIST" not in ar_data:
    ar_data["RECEPTIONIST"] = {}

ar_updates = {
    "ROOMS_TITLE": "الغرف",
    "ROOMS_SUB": "مراقبة وإدارة تعيينات الغرف",
    "REASSIGN_DOCTOR": "إعادة تعيين طبيب",
    "CLEAR_ROOM": "إخلاء الغرفة",
    "UNDER_MAINTENANCE": "تحت الصيانة",
    "READY_FOR_ASSIGNMENT": "جاهز للتعيين",
    "LOAD": "الحمل",
    "INSURANCE_TITLE": "التأمين",
    "INSURANCE_SUB": "إدارة مرضى التأمين والموافقات",
    "COMPANY": "الشركة",
    "CO_PAY": "نسبة التحمل %",
    "DOCUMENTS_PENDING": "في انتظار المستندات",
    "SUBMITTED": "تم التقديم",
    "UNDER_REVIEW": "قيد المراجعة",
    "APPROVED": "موافق عليه",
    "MANAGE": "إدارة",
    "MANAGE_INSURANCE": "إدارة التأمين",
    "CURRENT_STATUS": "الحالة الحالية",
    "UPLOAD_DOCS": "رفع المستندات (الهوية، البطاقة، التحويل)",
    "DRAG_DROP": "اسحب وأفلت أو انقر للرفع",
    "INSURANCE_COMPANY": "شركة التأمين",
    "PACKAGE": "الباقة",
    "SELECT_PACKAGE": "اختر الباقة...",
    "GOLD_NETWORK": "الشبكة الذهبية",
    "SILVER_NETWORK": "الشبكة الفضية",
    "RECORD_COPAY": "تسجيل نسبة التحمل %",
    "SAVE_COPAY": "حفظ نسبة التحمل %",
    "SUBMIT_TO_INSURER": "إرسال لشركة التأمين",
    "BILLING_TITLE": "الحسابات",
    "BILLING_SUB": "إدارة المدفوعات والفواتير",
    "CASH_PAYMENTS": "مدفوعات نقدية معلقة",
    "ONLINE_PAYMENTS": "مدفوعات إلكترونية",
    "INVOICE_ID": "رقم الفاتورة",
    "TYPE": "النوع",
    "DATE": "التاريخ",
    "AMOUNT": "المبلغ",
    "COLLECT": "تحصيل",
    "PRINT": "طباعة",
    "WALKIN_TITLE": "أقرب وقت متاح الآن",
    "WALKIN_SUB": "البحث عن أوقات متاحة للحضور المباشر",
    "PREFERRED_TIME": "الوقت المفضل",
    "SEARCH": "بحث",
    "GENDER": "النوع",
    "MALE": "ذكر",
    "FEMALE": "أنثى",
    "BOOKINGS_TITLE": "الحجوزات",
    "BOOKINGS_SUB": "جدولة التقييمات والجلسات العلاجية",
    "BOOK_ASSESSMENT": "حجز تقييم",
    "BOOK_SESSION": "حجز جلسة",
    "PATIENTS_TITLE": "المرضى",
    "PATIENTS_SUB": "إدارة ملفات المرضى وتاريخهم",
    "ADD_PATIENT": "إضافة مريض جديد",
    "SEARCH_PLACEHOLDER": "البحث بالاسم أو رقم الهاتف...",
    "GENDER_TH": "النوع",
    "PHONE": "رقم الهاتف",
    "PAYMENT_TYPE": "طريقة الدفع",
    "LAST_VISIT": "آخر زيارة",
    "FULL_NAME_EN": "الاسم الكامل (إنجليزي)",
    "FULL_NAME_AR": "الاسم الكامل (عربي)",
    "DOB": "تاريخ الميلاد",
    "CREATE_PROFILE": "إنشاء الملف"
}
ar_data["RECEPTIONIST"].update(ar_updates)

with open(ar_path, "w", encoding="utf-8") as f:
    json.dump(ar_data, f, indent=2, ensure_ascii=False)

print("Translations updated successfully.")
