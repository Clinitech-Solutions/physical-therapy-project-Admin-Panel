import os

# Directories to process
dirs = [
    r"d:\TPC\admin panel\physical-therapy-project-Admin-Panel\src\app\features\receptionist\dashboard",
    r"d:\TPC\admin panel\physical-therapy-project-Admin-Panel\src\app\features\receptionist\patients",
    r"d:\TPC\admin panel\physical-therapy-project-Admin-Panel\src\app\features\receptionist\bookings",
    r"d:\TPC\admin panel\physical-therapy-project-Admin-Panel\src\app\features\receptionist\walk-in",
    r"d:\TPC\admin panel\physical-therapy-project-Admin-Panel\src\app\features\receptionist\rooms",
    r"d:\TPC\admin panel\physical-therapy-project-Admin-Panel\src\app\features\receptionist\insurance",
    r"d:\TPC\admin panel\physical-therapy-project-Admin-Panel\src\app\features\receptionist\billing"
]

for d in dirs:
    for filename in os.listdir(d):
        if filename.endswith(".html"):
            path = os.path.join(d, filename)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Decrease padding inside cards
            content = content.replace('p-4', 'p-3')
            # Reduce mb-4 to mb-3 for forms and standard spacing
            content = content.replace('mb-4', 'mb-3')
            content = content.replace('mb-5', 'mb-4')
            
            # Add table-sm to make tables more compact
            if '<table class="table align-middle">' in content:
                content = content.replace('<table class="table align-middle">', '<table class="table table-sm table-hover align-middle">')
            elif '<table class="table' in content and 'table-sm' not in content:
                content = content.replace('<table class="table', '<table class="table table-sm table-hover')
                
            # Drawer width
            content = content.replace('width: 480px;', 'width: 400px;')

            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
print("done")
