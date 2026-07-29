import os
import json

files = {
    'en': r"d:\TPC\admin panel\physical-therapy-project-Admin-Panel\public\assets\i18n\en.json",
    'ar': r"d:\TPC\admin panel\physical-therapy-project-Admin-Panel\public\assets\i18n\ar.json"
}

keys = {
    'SIDEBAR': {
        'WALK_IN': ('Walk-In', 'حضور مباشر'),
        'ROOMS': ('Rooms', 'الغرف'),
        'INSURANCE': ('Insurance', 'التأمين'),
        'BILLING': ('Billing', 'الحسابات'),
        'REASSESSMENTS': ('Re-Assessments', 'إعادة التقييم'),
        'LIVE_VIEW': ('Live View', 'المتابعة المباشرة'),
        'MY_SCHEDULE': ('My Schedule', 'جدولي'),
        'SESSION_NOTES': ('Session Notes', 'ملاحظات الجلسة'),
        'SYSTEM_SETTINGS': ('System Settings', 'إعدادات النظام')
    }
}

for lang, path in files.items():
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    for section, subkeys in keys.items():
        if section not in data:
            data[section] = {}
        for key, (en_val, ar_val) in subkeys.items():
            if key not in data[section]:
                data[section][key] = en_val if lang == 'en' else ar_val

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

print("Updated translation files.")
