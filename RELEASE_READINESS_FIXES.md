# Release-readiness fixes: Receptionist, Senior Therapist and Doctor

Completed **2026-11-06, Africa/Cairo**. Implemented in order **F2 → F1 → F3 → F4**, with regression verification afterward. No push, deployment or CEO implementation. The original [audit](RELEASE_READINESS_AUDIT.md) is retained as historical evidence.

| Finding | Result | Implemented behavior and fresh evidence |
| --- | --- | --- |
| **F2 — clinical authorization and signed records** | **PASS** | Legacy assessment, plan and plan-session Add/Update/Delete now enforce the authenticated actor, assigned/owning Senior and existing Ceo/Admin/Owner permissions. Nine unassigned-Senior direct mutations return **403**. Invalid Doctor role, patient gender, locked account or missing Doctor are rejected. Signed or clinically/financially used records cannot be silently edited/deleted, including by their owner or a supervisor (**409**). Draft actions record actor identity. Actual assessment, reassessment and covered-treatment journeys still pass. |
| **F1 — registration without a username** | **PASS** | Backend generates `patient.` plus a GUID; Identity/database uniqueness remains authoritative. Bounded collision retries, a serializable clinic lock and a unique registration-operation key protect concurrent/replayed submissions. Changed intent under the same key returns **409**. Real email is saved; absent email stays null; existing accounts are preserved. Actual Add Patient and Booking Quick Registration forms each created exactly one patient without a username field or username payload. A double click produced one registration request. |
| **F3 — unsigned assessment after departure** | **PASS** | Reception records physical departure independently. An unsigned assessment remains in the assigned Senior's actionable queue beyond its clinic date, with its original date and a departed/unsigned badge. The supported completion action reopens authoritative saved context, including an existing draft. Departure creates no clinical signoff, eligible plan or invoice delivery. Authorized signoff reuses the draft, creates one plan and stamps delivery, preserving departure. Treatment checkout still requires clinical end. |
| **F4 — clinic calendar** | **PASS** | Appointment queries, Doctor schedules and optional Reception date queries use `ClinicCalendar` Cairo day boundaries. Query dates are clinic-local day labels (`YYYY-MM-DD`); boundaries become UTC for database comparisons. Senior unsigned tasks use Cairo due-day boundaries and keep overdue work. Frontend date queries and displayed times use Cairo rather than the device timezone. Authenticated tests agree at midnight, immediately outside each day, and on the **23-hour 2026-04-24** and **25-hour 2026-10-29** days. Stored UTC timestamps are unchanged. |

PASS refers to the identified modified source and verification environments below. It does not mean the existing elevated API process on port 7223 has loaded the changes.

## Source and environment identity

- Frontend: `Api_integrate`, base `0f91ea3b570968c40c1ba9d76b72a7871403df98`, plus this workspace's changes.
- Backend: `Abanoub3vv`, base `b04615f9118fca28ff220ed052bb2f172545d1f8`, plus this workspace's changes.
- Frontend initially had the untracked audit report; it was preserved. Backend was initially clean. Environment API configuration remains `https://localhost:7223/api`.
- Browser writes used the **actual Angular application on port 4200**, with CDP forwarding API transport to a freshly compiled `BookingTestHost` on `127.0.0.1:7290`. This runs actual ASP.NET controllers, Identity password login, services and EF persistence against a unique disposable SQLite database. Successful API responses were never substituted. One explicitly injected **pre-send 503** tested absence-save retention.
- Synthetic Receptionist, Doctor, other Doctor, assigned Senior, other Senior, female Senior and Patient roles used real password login. No signed test token replaced these fresh logins. Some older regression tests retain their existing signed-fixture-token setup.
- For the normal browser journey only, explicit disposable-fixture operations move its new assessment/treatment to the current Cairo day for Reception's Today controls, then age the departed unsigned assessment's planned date by three days. Actual arrival/departure timestamps and the system clock are preserved. Future API/coverage bookings exercise existing early-arrival behavior. No shared appointment was modified.
- Current-source **Kestrel** also ran on `https://localhost:7443` against the verified SQL Server. The actual Angular app passed authenticated Admin reads for Patients, Bookings, Schedule, Senior dashboard/tasks and Doctor dashboard. CDP changed only the destination port; these were direct Kestrel/SQL responses, with business writes blocked. This run used the real seeded SuperAdmin password endpoint and actual Admin membership.
- Current-source API DLL SHA256: `16A6AD81114CBBF9B1EC613AC97A46227F48FCCE244F0B359D4B0330320D4233`; Infrastructure DLL SHA256: `9F064CF5AEE475FF6FFBC09AD6789E3546E3AAA5C047BAE54D556BB0FD0C1B1B`. These are the `.tools/release-fixes-browser-build` binaries used for browser/API and current-source SQL reads.

**Local activation limit:** Windows denied access to stop the pre-existing elevated `PTCenter.Api` process **24644** on port **7223**. It remains running its earlier binary. Restart it from its owning elevated terminal using the updated backend before using the normal 4200 → 7223 configuration for acceptance. Verification on 7290 and 7443 does not certify the old 7223 binary. This task did not change the configured frontend URL or deploy an API.

The temporary verification servers on 7290 and 7443 were stopped after evidence capture. The Angular development server remains on 4200, and the original API remains on 7223.

## Changes and reproduced failures

The regression tests were run against the defective implementations before their fixes: legacy clinical tests failed on allowed mutation/invalid assignment; registration failed without the old required username; unsigned checkout incorrectly set delivery; all three calendar cases selected the wrong IDs. Local before-fix logs are retained below.

The shared [legacy clinical guard](../Physical-Therapy-Center/PTCenter.Infrastructure/Services/LegacyClinicalRules.cs) is used by assessment, treatment-plan and related session mutation services under the existing serializable mutation lock. Existing supervisory roles may manage eligible drafts, but do not bypass signed-history protection. Related session mutations cannot invent payment, attendance or finalized-note changes. Existing assignment-scoped Doctor workspace and reasoned reassessment state transitions remain in place.

[Patient registration](../Physical-Therapy-Center/PTCenter.Infrastructure/Services/PatientService.cs) no longer takes a username from Reception. The shared frontend registration payload supplies a stable operation key and optional real email for both entry points. Patient/Identity/role and operation identity commit atomically. A forced generated-name collision is retried without changing the existing account. Concurrent same-operation registrations return the same patient; incompatible retries fail without a second patient. Existing account-edit behavior remains available.

The new [assessment queue/workspace](../Physical-Therapy-Center/PTCenter.Infrastructure/Services/BookingService.Assessment.cs) exposes authorized due unsigned work and saved form context. The Senior dashboard no longer filters away departed or past unsigned assessments. Signoff, rather than Reception departure, stamps assessment delivery; unsigned assessments are excluded from clinical completed counts. The actual form preserves saved draft context, and already-signed context is read-only. The departed/unsigned notice and action have English and Arabic text. Task rows wrap so the longer status and completion button stay inside their card.

The browser journey additionally reproduced a pre-existing contract mismatch: the frontend required the plan's weekly frequency, while the booking context omitted it. The backend context now includes the saved `FrequencyPerWeek` and existing booked start times. The regression asserts this response; normal browser treatment preview and booking now succeed without inventing a frequency.

## Fresh verification

| Check | Result and concrete evidence |
| --- | --- |
| Full backend suite | **207 passed, 0 failed, 0 skipped**. Includes all 197 prior tests and 10 new cases for F1–F4. Latest run includes the booking-context contract correction. |
| Full Angular suite | **375 passed in 52 files, 0 failed, 0 skipped**. All 25 failures from the audit were addressed; no tests were disabled and no assertions were removed to obtain a pass. |
| Production build | **PASS**, final build includes localized notices and task-row wrapping; no Angular warnings. |
| Application/spec TypeScript checks | Both `tsc --noEmit` checks **PASS**. |
| Add Patient browser | Normal DOM input and Save, no payload repair. Synthetic patient **3**, real email retained, generated internal username, one request/one patient despite double click. |
| Booking Quick Registration browser | Normal shared form and Save. Synthetic patient **4**, unique generated username and real email; newly created patient selected in Booking. No username payload. |
| Departure before signoff | Browser assessment **1**: actual Reception check-in, authenticated Senior draft, Reception Check-Out before signoff; departure saved, assessment unsigned, no plan and no delivered invoice. After fixture aging, Senior dashboard still exposed the task and reopened its saved diagnosis. UI completion created one plan/delivery and preserved the original departure timestamp. Other Senior context/signoff denials pass the HTTP regression. |
| Existing normal treatment journey | Browser treatment **2**: EGP **20** booking deposit, visible **80** shortfall; collecting it did not record arrival. A separate check-in allowed assigned Doctor start, draft notes, clinical end and Reception departure. Reload showed one completed session and saved notes. |
| Reassessment | Actual Doctor request, Senior claim/completion/History and Doctor saved written outcome after reload. Appointments, plans, invoices, payments and claim count identical across the Continue review; expected clinical outcome records added. |
| Absence coverage | Actual partial/full absence forms, affected queue, eligible Senior treatment cover, failed-save retention/retry, Senior-only assessment options, declined/unreachable outcomes, unchecked explicit phone consent and recorded consent audit. Assigned Senior performed Start/notes/End in the real clinical workspace; Reception arrival/departure used authenticated API. Financial and plan snapshots were identical across reassignment, and appointment/session links were retained. Final browser coverage appointments **7/8** in this fixture lifetime. |
| Package API journey | Three prescribed sessions, 10% package discount: **EGP 270** total. Actual EGP **100** upfront, EGP **80** second-session shortfall, EGP **180** actual receipts and **90** remaining after two deliveries. Fixed EGP 30 discount case also passed. |
| Insurance API journey | Prescription **10**, approved **6**, saved **20%** copay. Pending approval blocks treatment; seven bookings rejected and six saved. EGP **600** liability split **120 patient / 480 insurer**, actual patient receipt **20**, patient remaining **100**. Insurer debt did not become patient cash or block a covered patient share. |
| Direct clinical API boundaries | Unassigned legacy assessment/plan writes **403**, wrong-role writes denied, owner/supervisor signed overwrites **409**, non-Doctor/wrong-gender/locked Doctor rejected. Legitimate owner/supervisor draft behavior remains covered. |
| Cairo calendar | Three authenticated relational HTTP cases compare Reception/generic appointment, Senior generic and assigned Doctor queries using identical IDs at exact boundaries. Source UTC timestamps checked unchanged. Browser emulating **America/Los_Angeles** rendered the Cairo 00:30 appointment time and 00:00 bucket correctly; past unsigned work remained visible. |
| Responsive/runtime | Three-role 390px Arabic/dark smoke, plus departed unsigned task and form in actual Arabic/dark at 390px. Final task-row checks at **1440/820/390/360px** verify both badge and button inside the card, no horizontal page overflow and zero runtime exceptions. Screenshots inspected. Physical-device keyboard and production load are not certified. |

The 25 earlier frontend failures comprised **17 legacy ClinicState fixture assumptions** and **8 component/browser-environment setup failures**. The legacy algorithm suite now owns explicit isolated numeric patient/session/room/payment fixtures instead of depending on changed demonstration data; its behavioral assertions remain. Component tests now supply the actual HTTP testing, router and translation providers they need. A test-only `matchMedia` adapter supplies the jsdom browser API. No production mock data or clinical rules were changed to satisfy those tests.

Backend verification command:

```powershell
dotnet test PTCenter.Tests/PTCenter.Tests.csproj --artifacts-path .tools/release-fixes-build --logger "trx;LogFileName=release-fixes.trx" --results-directory .tools/release-fixes-results
```

Frontend verification: `npx ng test --watch=false`, `npx ng build`, `npx tsc --noEmit -p tsconfig.app.json`, and `npx tsc --noEmit -p tsconfig.spec.json`.

## Database migration and preservation

Applied **`20261106140342_ReleaseReadinessPatientRegistration`** through the reviewed, pinned SQL process to **`db56823.public.databaseasp.net / db56823`**, after verifying connected server identity **`S13`**. It adds two nullable patient operation/hash fields and a filtered unique operation-key index. No existing-row backfill or financial mutation is required.

SQL SHA256: **`1A2B292323FCECCE7C58A07148148671BE34151A9B9F8EA5D884D450672B2537`**. Model/snapshot and migration chain match; **zero pending migrations**. All 19 checked business/Identity table counts, invoice liability totals and payment totals were identical before/after. Existing totals remain EGP **15600 invoice total / 7600 patient / 8000 insurer / 4600 paid**, with EGP **4600 payments**.

See [applied migration and preservation record](../Physical-Therapy-Center/Database/ReviewedMigrations/20261106140342_ReleaseReadinessPatientRegistration.APPLIED.md). Shared SQL Server business workflows were read-only; all synthetic workflow writes used disposable SQLite. Provider-specific SQL Server financial/concurrency mutation acceptance remains separate from this verification.

## Evidence and remaining decisions

Fresh local artifacts:

- [Browser registrations, departed unsigned handoff and clinical/reassessment journey](tmp/release-fixes-browser/results.json).
- [Absence coverage, consent, retained failure and financial snapshots](tmp/release-fixes-browser/coverage-results.json).
- [Authenticated API A–E journeys and direct-write denials](tmp/release-fixes/api-results.json).
- [Current-source Kestrel/SQL read smoke](tmp/release-fixes-browser/current-source-sql-read.json), [Arabic unsigned task/form](tmp/release-fixes-browser/unsigned-ar-mobile.json), [final responsive task checks](tmp/release-fixes-browser/unsigned-final-layout.json).
- [Departed unsigned Senior task](tmp/release-fixes-browser/senior-past-departed-unsigned-task.png), [saved draft reopened](tmp/release-fixes-browser/senior-reopened-saved-unsigned-context.png), [Arabic mobile task](tmp/release-fixes-browser/unsigned-task-390-ar-dark.png), [Arabic mobile form](tmp/release-fixes-browser/unsigned-form-mobile-ar-dark.png).
- Frontend logs: `tmp/release-fixes-angular-full.log`, `release-fixes-build.log`, `release-fixes-app-types.log`, `release-fixes-spec-types.log`.
- Backend logs/TRX: `.tools/release-fixes-backend-full.log`, `.tools/release-fixes-results/release-fixes.trx`; before-fix logs `.tools/release-fixes-f2-before.log`, `release-fixes-f2-f1-baseline.log`, `release-fixes-f3-before.log`, `release-fixes-f4-before.log`.

Drivers, browser profiles, fixture databases and generated evidence remain ignored local artifacts. Earlier browser-driver attempts corrected a 204 fixture response expectation, waiting for the asynchronously refreshed absence queue, and fixture interval input; they are not counted as product failures. The missing booking-frequency response was a product contract defect and was fixed. No credentials or tokens are included in this report or result artifacts.

**Remaining test failures: none.** Existing restore warnings **NU1902/NU1903** for `System.Security.Cryptography.Pkcs 9.0.4` remain; exploitability/dependency upgrades are outside F1–F4 and still require production triage. Some pre-existing assessment labels remain placeholders, as identified in the original audit.

**Unresolved business decision:** no approved auditable amendment workflow for already-signed assessments, prescriptions or final clinical notes exists. Silent overwrites are now blocked. The existing reassessment workflow records a new clinical decision while preserving the original; it is not an amendment to signed history. The clinic must define amendment authority, reason/history requirements and the handling of any affected bookings/agreements before a signed-correction feature is added. No policy was invented here.

The audit's cancellation/refund, insurer-assessment waiver, Senior review-time/capacity, revised-plan follow-up, receipt issuance and early-arrival policies also remain unchanged. F1–F4 are fixed and pass in the verified build pair; these decisions, dependency triage and the explicitly blocked local 7223 restart remain separate release/operational work.
