import json
import os

en_path = r'd:\TPC\admin panel\physical-therapy-project-Admin-Panel\public\assets\i18n\en.json'
ar_path = r'd:\TPC\admin panel\physical-therapy-project-Admin-Panel\public\assets\i18n\ar.json'

new_keys_en = {
    "NOW": "Now",
    "AVAILABLE_SLOTS": "Available Slots",
    "COLLECT_PAYMENT": "Collect Payment",
    "AMOUNT_DUE": "Amount Due",
    "AMOUNT_COLLECTED": "Amount Collected",
    "PAYMENT_METHOD": "Payment Method",
    "CASH": "Cash",
    "CARD": "Card",
    "INSTAPAY": "InstaPay",
    "CANCEL": "Cancel",
    "PROCESS_PAYMENT": "Process Payment",
    "EGP": "EGP",
    "INSURANCE_PAYMENT": "Insurance",
    "ALL_DOCTORS": "All Doctors",
    "ALL_ROOMS": "All Rooms",
    "GENDER_MATCHING": "Gender matching enforced — male Senior covers male patients only.",
    "REQUIRES_REASSIGNMENT": "Requires Reassignment",
    "RESCHEDULE": "Reschedule",
    "REASSIGN": "Reassign",
    "CONFIRM_COVERAGE": "Confirm Coverage Plan",
    "DAY": "Day",
    "WEEK": "Week",
    "LOCKED": "Locked",
    "PROCESSING": "Processing..."
}

new_keys_ar = {
    "NOW": "الآن",
    "AVAILABLE_SLOTS": "المواعيد المتاحة",
    "COLLECT_PAYMENT": "تحصيل الدفع",
    "AMOUNT_DUE": "المبلغ المستحق",
    "AMOUNT_COLLECTED": "المبلغ المحصل",
    "PAYMENT_METHOD": "طريقة الدفع",
    "CASH": "نقدي",
    "CARD": "بطاقة",
    "INSTAPAY": "إنستاباي",
    "CANCEL": "إلغاء",
    "PROCESS_PAYMENT": "معالجة الدفع",
    "EGP": "جنيه",
    "INSURANCE_PAYMENT": "تأمين",
    "ALL_DOCTORS": "جميع الأطباء",
    "ALL_ROOMS": "جميع الغرف",
    "GENDER_MATCHING": "تم تفعيل مطابقة الجنس — يتولى كبير المعالجين الذكور المرضى الذكور فقط.",
    "REQUIRES_REASSIGNMENT": "يتطلب إعادة تعيين",
    "RESCHEDULE": "إعادة جدولة",
    "REASSIGN": "إعادة تعيين",
    "CONFIRM_COVERAGE": "تأكيد خطة التغطية",
    "DAY": "يوم",
    "WEEK": "أسبوع",
    "LOCKED": "مغلق",
    "PROCESSING": "جاري المعالجة..."
}

def update_file(filepath, new_keys):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    data['RECEPTIONIST'].update(new_keys)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

update_file(en_path, new_keys_en)
update_file(ar_path, new_keys_ar)
print("Translations updated successfully.")
