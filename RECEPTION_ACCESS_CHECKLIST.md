# Reception workflow access audit — 2026-10-31

## Follow-up: live dashboard SQL failure, 13:21 Cairo

The restarted main API's `dashboard-stats` response confirms SQL error 207 for `CourseAgreementId`, `DeliveredAt` and `TreatmentPlanSessionId`, at `ReceptionistService.GetDashboardStatsAsync()` line 32. That query materializes Invoice entities, so EF selects the mapped finance fields. A fresh read-only audit of configured SQL Server `db56823.public.databaseasp.net` / `db56823` (identity `S13`) confirms those three invoice columns are absent. A `SELECT TOP (0)` probe reproduces the same error without reading patient/financial records. Latest applied migration remains `20261029124607_BookingWorkflow`; `20261030184822_CourseFinancialAgreements` is pending. Restarting loads code but does not apply schema changes. The finance migration must be applied through a separately authorized reviewed process before the matching finance code can run against this database. No migration or database writes were performed. Evidence: sibling `.tools/dashboard-target-audit.log`. Earlier SQLite/browser successes do not validate the unmigrated SQL Server schema.

Implementation is complete locally in this frontend and the sibling `Physical-Therapy-Center` backend. No migrations, shared database writes, push or deployment were performed. Both repositories were clean at the start; previous Booking finance, layout and working-hours work is preserved.

## Confirmed causes and corrections

1. `InsuranceCompaniesController` allowed only Admin/Owner at controller level. Reception insurer cards and registration/filter lookups therefore returned 403. Staff can now read insurers; only Ceo/Admin/Owner can add, edit or delete insurers. CEO management also matches its existing UI permission.
2. Dashboard/Schedule used the administrative `Users/GetAll` through `ClinicianService`. That endpoint correctly excludes Receptionist. The frontend now calls `GET /api/Receptionist/clinicians`. Users administration remains restricted.
3. Rooms (except availability) and insurance documents previously lacked authorization. Patients and clinical record controllers required authentication without restricting roles. These resources now reject anonymous requests and Patient/unrecognized roles. Reception can manage patient/room/document records and read clinical records; it cannot author assessments, plans or prescribed sessions. Existing appointment/payment workflow rules remain enforced in their services.
4. Load failures could be hidden by another error or presented alongside a successful-looking empty result. Dashboard/Schedule now label statistics, appointments, clinicians, rooms and patient lookup failures independently, with scoped retries. Patients exposes insurer and patient errors outside its dialogs. Booking separates directory/clinician/room failures and disables failed lookup selectors. Billing separates patient lookup failures from payments and suppresses empty-success text after failed loads. Profile keeps history/documents/download errors separate and only reports empty results after successful loads.
5. Profile documents previously fetched a global list and rejected every nonempty response because patient association/download handling was unverified. Reads now include `patientId`; Receptionist global enumeration without it returns 400. The frontend validates association, renders saved metadata and downloads through an authenticated API action. Raw storage paths are never used as browser links. Upload names are sanitized, storage names are generated, and file read/delete paths are confined to the document directory. Document writes remain reception operations; patient/anonymous access is denied.
6. Actual browser patient editing found an additional contract mismatch: the UI submits changed fields, while the backend required all identity fields and replaced omitted funding/insurance values. The update DTO/service now preserve omitted fields, including gender, birth date, funding, insurer and approval details; explicit nullable field clears are still supported. Actual patient deletion also exposed a failed hard-delete of the linked Identity user despite the application's patient soft-delete policy. Profile deletion now soft-deletes the patient while retaining its identity/history, including any staff account. Staff account deletion remains an administrative operation.

## JWT and role audit

The issuer emits `roles` as a JSON array. The existing JWT bearer configuration maps role claims to `ClaimTypes.Role`. The actual `Auth/Login` → `AuthService` → `JwtProvider` path was tested with Identity users holding **only Receptionist**, as well as Patient, Doctor and Ceo users. Role mapping already works; no claim bypass, role alias, Admin grant or authentication removal was needed. Seeded names are `Receptionist`, `Doctor`, `Senior`, `Ceo`, `Admin`, `Owner`, `Patient`. The frontend's legacy SuperAdmin handling was not changed.

The safe clinician directory returns only ID, name, gender, Doctor/Senior roles, current checked-in load, saved working hours and absence dates. It excludes currently locked accounts, preserves dual clinical roles, and exposes no emails, usernames, birth dates, passwords, account controls or absence reasons. Booking continues to use the patient/plan-specific clinician endpoint for authoritative gender, role and availability validation. No working-hours policy changed.

## Endpoint-to-permission checklist

All paths below are prefixed with `/api`. Pagination and optional filters remain unchanged. **Staff** = Receptionist, Senior, Doctor, Ceo, Admin, Owner. **Reception operations** = Receptionist, Ceo, Admin, Owner. **Administration** = Ceo, Admin, Owner. **Clinical authors** = Senior, Doctor, Ceo, Admin, Owner. A policy on an action is combined with its controller policy. Anonymous requests to protected resources return 401; authenticated Patient/unrecognized roles return 403.

| Screen/service | HTTP endpoint | Backend permission / result |
| --- | --- | --- |
| Login | POST `Auth/Login` | Public credential validation; JWT required on subsequent requests |
| Dashboard, Schedule, refresh service | GET `Receptionist/dashboard-stats` | Staff; Receptionist verified 200 |
| Dashboard, Schedule, refresh service | GET `Receptionist/today-sessions` | Staff; Receptionist verified 200 |
| Dashboard, Schedule, shared clinician lookup | GET `Receptionist/clinicians` | Staff; new safe directory, verified 200 |
| Dashboard, Schedule, shared attendance action | PUT `Receptionist/appointments/{id}/status` | Staff; explicit check-in/out and patient coverage rules preserved |
| Dashboard, Schedule, shared absence/cancel action | PUT `Receptionist/appointments/{id}/cancel` | Staff; existing cancellation and charge rules preserved |
| Patients, Schedule, Dashboard, Billing, refresh service | GET `Patients/GetAll` | Staff; verified 200 |
| Patients edit/Profile, registration reconciliation | GET `Patients/GetById/{id}` | Staff; verified 200 |
| Patients and Booking quick registration | POST `Patients/Add` | Reception operations; permitted CRUD tested |
| Patients edit | PUT `Patients/Update/{id}` | Reception operations; real partial update tested |
| Patients | DELETE `Patients/Delete/{id}` | Reception operations; soft deletion tested; Identity principal retained |
| Booking patient selector | GET `Bookings/patients` | Staff; lightweight paged options, verified 200 |
| Booking selected clinical/financial context | GET `Bookings/patients/{id}` | Staff; verified 200 |
| Booking patient/plan clinician selector | GET `Bookings/patients/{id}/clinicians` | Staff; existing authoritative patient-specific rules, verified 200 |
| Shared booking workload service | GET `Bookings/clinicians/workload` | Staff; verified 200 |
| Booking preview | POST `Bookings/preview` | Staff; real server quote/availability tested |
| Booking confirmation | POST `Bookings` | Staff; real course booking, rounding, allocation and retry rules tested |
| Booking unknown-outcome reconciliation | GET `Bookings/operations/{key}` | Staff; committed result lookup; existing HTTP regression tested |
| Billing package/installment accounts | GET `Bookings/accounts` | Staff; verified 200 |
| Billing package collection | POST `Bookings/accounts/{key}/payments` | Staff; existing collection/idempotency rules retained |
| Billing package collection reconciliation | GET `Bookings/accounts/{key}/payments/{operationKey}` | Staff; original-key reconciliation retained |
| Schedule / shared booking reschedule API | PUT `Bookings/appointments/{id}/schedule` | Staff; same saved charges and planned 60 minutes retained |
| Shared booking status API | PUT `Bookings/appointments/{id}/status` | Staff; existing payment/attendance gates retained |
| Schedule, Profile, refresh service | GET `Appointments/GetAll` | Staff; verified 200 |
| Schedule details/shared appointment service | GET `Appointments/{id}` | Staff; existing read policy retained |
| Shared appointment service (legacy API) | POST `Appointments` | Staff; delegates to Booking rules |
| Schedule editing | PUT `Appointments/{id}` | Staff; delegates reschedule and rejects combined status changes |
| Shared appointment service (legacy API) | PATCH `Appointments/{id}/status` | Staff; delegates explicit workflow transition |
| Shared appointment service (legacy API) | DELETE `Appointments/{id}` | Staff; cancellation through workflow, no charge deletion |
| Rooms, Dashboard, Schedule, refresh service | GET `Rooms` | Staff; now protected, verified 200 |
| Rooms edit | GET `Rooms/{id}` | Staff; verified 200 |
| Booking room selector | POST `Rooms/availability` | Staff; occupied/reserved/maintenance filtering retained |
| Rooms | POST `Rooms`; PUT `Rooms/{id}` | Reception operations; create/edit tested; Doctor writes denied |
| Rooms maintenance | PATCH `Rooms/{id}/maintenance` | Reception operations; tested |
| Rooms | DELETE `Rooms/{id}` | Reception operations; tested with isolated records |
| Insurance cards, patient company filters and registration | GET `InsuranceCompanies/GetAll` | Staff; fixed reported 403, verified 200 |
| Shared insurer service | GET `InsuranceCompanies/GetById/{id}` | Staff; verified 200 |
| Billing, Profile, reception refresh | GET `Billing/invoices` | Staff; verified 200 |
| Billing invoice detail | GET `Billing/invoices/{id}` | Staff; existing HTTP regression tested |
| Billing payment history | GET `Billing/invoices/{invoiceId}/payments` | Staff; existing HTTP regression tested |
| Billing saved-invoice collection | POST `Billing/payments` | Staff; payer, balance and retry checks retained |
| Shared billing service (not exposed by current reception template) | POST `Billing/invoices`; PATCH `Billing/invoices/{id}/status`; DELETE `Billing/invoices/{id}` | Existing Staff policy retained; cannot erase saved course liabilities or payment audit records through these actions |
| Shared check-in payment dialog | GET `Finance/appointments/{id}/payment-gate` | Staff; exact shortfall verified |
| Shared check-in collection action | POST `Finance/appointments/{id}/payments` | Staff; actual patient collection and separate explicit Start tested |
| Billing insurer receivables | GET `Finance/insurance/accounts` | Staff; verified 200 |
| Billing claim submission | POST `Finance/insurance/claims` | Staff; real claim tested |
| Billing actual insurer collection | POST `Finance/insurance/claims/{id}/settlements` | Staff; real settlement tested, separate patient/insurer balances |
| Patient Profile history | GET `Assessments/GetAll?patientId={id}`; GET `Assessments/GetById/{id}` | Staff; verified 200 |
| Patient Profile history | GET `TreatmentPlans/GetAll?patientId={id}`; GET `TreatmentPlans/GetById/{id}` | Staff; verified 200 |
| Patient Profile saved sessions | GET `TreatmentPlanSessions/GetAll?treatmentPlanId={id}`; GET `TreatmentPlanSessions/GetById/{id}` | Staff; saved-record read only for Receptionist |
| Insurance patient registration/Profile | POST `InsuranceDocuments/Add` | Reception operations; multipart upload tested |
| Insurance Patient Profile | GET `InsuranceDocuments?patientId={id}` | Staff; Receptionist requires a selected patient; association/filter tested |
| Insurance Patient Profile download | GET `InsuranceDocuments/{id}/file` | Staff; authenticated file download tested in HTTP and browser |
| Shared document service | PUT `InsuranceDocuments/{id}`; DELETE `InsuranceDocuments/{id}` | Reception operations; tested |
| Staff management (never a reception lookup) | GET `Users/GetAll`, `Users/GetProfile`; POST `Users/Add`, `Users/Update`; DELETE `Users/Delete`; PUT `Users/ChangePassword` | Administration; Receptionist 403 preserved, including direct browser probes |
| Insurer master data administration | POST `InsuranceCompanies/Add`; PUT `InsuranceCompanies/Update/{id}`; DELETE `InsuranceCompanies/Delete/{id}` | Administration; Receptionist 403, CEO success tested |
| Clinical authorship | POST/PUT/DELETE `Assessments/Add`, `Update/{id}`, `Delete/{id}`; equivalent `TreatmentPlans` and `TreatmentPlanSessions` actions | Clinical authors; Receptionist 403 for all 9 actions |
| Assessment completion/prescription | POST `Bookings/assessments/complete`; POST `Bookings/assessments/{id}/complete` | Senior, Ceo, Admin, Owner; Receptionist 403 preserved |

The reception pages no longer depend on `UserService`. Administrative Users calls in CEO staff management remain intact. Unsupported legacy absence/nearest-slot UI actions do not make hidden working-hours writes. The current Booking sidebar/header/layout and financial rules are unchanged. Redundant eager invoice reads on Dashboard/Schedule and an unused appointment read on Billing were removed; Profile still loads its required history on demand.

## Verification and limits

| Check | Result / boundary |
| --- | --- |
| Backend suite | **126 passed**, including **74 new access cases**. ASP.NET TestServer uses unique temporary relational SQLite databases. Actual Identity login/JwtProvider tokens cover Receptionist, Patient, Doctor and Ceo. Anonymous/Patient mutation and unrecognized-role probes also use synthetic signed test tokens where noted in test code. Existing finance, retry, reschedule, room and offline SQL Server model checks remain green. |
| Focused Angular suite | **98 passed across 12 files**. Mocked HTTP/component tests cover lookups, patient/document association, per-section failures/retries, Booking, Billing, Schedule, Dashboard, authentication and guards. This is not a full unrelated-suite claim. |
| Production Angular build | Passed with **no warnings** and unchanged budgets. |
| Real Angular/Chrome workflow | All eight requested views exercised: Dashboard, Patients, Booking, Schedule, Rooms, Insurance, Billing and Patient Profile. Requests relay to the matching rebuilt local ASP.NET test host on 7288, backed by isolated SQLite. Browser logs in through the real Login form with a Receptionist-only Identity account. **92 healthy read requests returned 200**, including saved document metadata/download; no administrative Users lookup was made by the reception UI. Registration/edit, room create/edit/maintenance, course booking, payment shortfall collection, explicit attendance, insurer claim/settlement all passed. |
| Negative browser probes | Receptionist Users/GetAll, Users/Add, InsuranceCompanies/Add and TreatmentPlans/Update returned **403**; anonymous Rooms returned **401**; staff-management route remained blocked. These are real backend responses. |
| Scoped failure browser check | A separate **mocked clinician-read 403** left real dashboard statistics/appointments/rooms working and displayed a clinician-specific message; successful real retry cleared it. This fault injection is distinct from healthy business integration checks. |
| Booking preservation | Browser confirmed self-pay 1,350 total / 400 collected / 50 shortfall before Start; insurer course 300 = patient 60 + insurer 240, delivered insurer receivable 80 and actual settlement 80. Exactly two bookings committed. Light/dark, Arabic/RTL, mobile layout, 44px controls and sticky desktop summary passed with no runtime exceptions. |
| SQL Server/main API | No SQL Server writes, migrations or current-production-account tests. The user's API on 7223 was not stopped/restarted. It must load the rebuilt code before these authorization changes appear there. Prior documented finance migration prerequisites remain separate; this access change introduces **no migration** and does not authorize applying pending finance migrations. |

Source regression: sibling backend `PTCenter.Tests/ReceptionAccessTests.cs`. Local evidence (ignored): `tmp/reception-final-tests.log`, `tmp/reception-build.log`, `tmp/reception-browser.log`, `tmp/reception-access-preview/result.json` and screenshots; sibling `.tools/reception-all-tests.log` and `.tools/reception-preview.log`. Browser helper/test data are synthetic; credentials/tokens are not included in this report or request evidence. The isolated preview API is stopped after verification.
