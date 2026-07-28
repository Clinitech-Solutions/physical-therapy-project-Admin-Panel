import os
import re

files_to_process = [
    r'src\app\features\ceo\dashboard\dashboard.html',
    r'src\app\features\receptionist\dashboard\dashboard.html',
    r'src\app\features\doctor\dashboard\dashboard.html',
    r'src\app\features\senior\dashboard\dashboard.html',
    r'src\app\layout\sidebar\sidebar.html',
    r'src\app\layout\topbar\topbar.html',
    r'src\app\shared\components\language-selector\language-selector.ts'
]

# A dictionary to map the English string to its Translation Key
mapping = {
    'Executive Overview': "CEO.DASHBOARD_TITLE",
    'Real-time performance metrics': "CEO.DASHBOARD_SUB",
    'Export Report': "CEO.EXPORT_REPORT",
    "Today\\'s Revenue": "CEO.TODAYS_REVENUE",
    "Today's Revenue": "CEO.TODAYS_REVENUE",
    'vs yesterday': "CEO.VS_YESTERDAY",
    'Active Patients': "CEO.ACTIVE_PATIENTS",
    'new today': "CEO.NEW_TODAY",
    'Sessions Today': "CEO.SESSIONS_TODAY",
    'attendance': "CEO.ATTENDANCE",
    'Pending Payments': "CEO.PENDING_PAYMENTS",
    'Insurance delays': "CEO.INSURANCE_DELAYS",
    'Revenue Trend (30 Days)': "CEO.REVENUE_TREND",
    'Recent Activity': "CEO.RECENT_ACTIVITY",
    'booked a session': "CEO.BOOKED_SESSION",
    '2 mins ago': "CEO.MINS_AGO_2",
    'completed assessment': "CEO.COMPLETED_ASSESSMENT",
    '15 mins ago': "CEO.MINS_AGO_15",
    'marked absent': "CEO.MARKED_ABSENT",
    '1 hour ago': "CEO.HOUR_AGO_1",
    
    'Receptionist Dashboard': "RECEPTIONIST.DASHBOARD_TITLE",
    "Overview of today\\'s clinic activity": "RECEPTIONIST.DASHBOARD_SUB",
    "Overview of today's clinic activity": "RECEPTIONIST.DASHBOARD_SUB",
    "Today\\'s Sessions": "RECEPTIONIST.TODAYS_SESSIONS",
    "Today's Sessions": "RECEPTIONIST.TODAYS_SESSIONS",
    'completed': "RECEPTIONIST.COMPLETED_LC",
    'Present Doctors': "RECEPTIONIST.PRESENT_DOCTORS",
    'absent today': "RECEPTIONIST.ABSENT_TODAY",
    'Walk-ins': "RECEPTIONIST.WALKINS",
    'High': "RECEPTIONIST.HIGH",
    'traffic': "RECEPTIONIST.TRAFFIC",
    'Requires attention': "RECEPTIONIST.REQUIRES_ATTENTION",
    "Today\\'s Sessions Timeline": "RECEPTIONIST.TIMELINE_TITLE",
    "Today's Sessions Timeline": "RECEPTIONIST.TIMELINE_TITLE",
    
    'Time': "COMMON.TIME",
    'Patient': "COMMON.PATIENT",
    'Doctor': "COMMON.DOCTOR",
    'Room': "COMMON.ROOM",
    'Status': "COMMON.STATUS",
    'Action': "COMMON.ACTION",
    'Completed': "COMMON.COMPLETED",
    'View': "COMMON.VIEW",
    'In Progress': "COMMON.IN_PROGRESS",
    'Waiting': "COMMON.WAITING",
    'Start': "COMMON.START",
    
    "Today\\'s Schedule": "DOCTOR.DASHBOARD_TITLE",
    "Today's Schedule": "DOCTOR.DASHBOARD_TITLE",
    'Your upcoming sessions': "DOCTOR.DASHBOARD_SUB",
    'Room 1': "DOCTOR.ROOM_1",
    'Room 3': "DOCTOR.ROOM_3",
    'Session 4 of 10': "DOCTOR.SESSION_4_10",
    'Session 8 of 12': "DOCTOR.SESSION_8_12",
    'Start Session': "DOCTOR.START_SESSION",
    'Available Slot': "DOCTOR.AVAILABLE_SLOT",
    'Assessment': "DOCTOR.ASSESSMENT",
    
    'Senior Dashboard': "SENIOR.DASHBOARD_TITLE",
    'Overview of assessments and clinic floor': "SENIOR.DASHBOARD_SUB",
    "Today\\'s Tasks": "SENIOR.TODAYS_TASKS",
    "Today's Tasks": "SENIOR.TODAYS_TASKS",
    'Assessments (4)': "SENIOR.ASSESSMENTS_4",
    'Re-assessments (2)': "SENIOR.REASSESSMENTS_2",
    'Live View - Doctors Capacity': "SENIOR.LIVE_VIEW_CAPACITY",
    
    'English': "COMMON.ENGLISH"
}

pattern = re.compile(r'\{\{\s*langService\.currentLang\(\)\s*===\s*\'en\'\s*\?\s*([\'"])(.*?)\1\s*:\s*([\'"])(.*?)\3\s*\}\}')

def replacer(match):
    english_text = match.group(2)
    key = mapping.get(english_text)
    if not key:
        print(f"Warning: No mapping found for '{english_text}'")
        return match.group(0)
    return f"{{{{ '{key}' | translate }}}}"

for file_path in files_to_process:
    full_path = os.path.join(r"d:\TPC\admin panel\physical-therapy-project-Admin-Panel", file_path)
    if os.path.exists(full_path):
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = pattern.sub(replacer, content)
        
        if content != new_content:
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated {file_path}")
    else:
        print(f"File not found: {full_path}")
