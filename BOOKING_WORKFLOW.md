# Patient-first booking integration

**Visual update, 2026-10-31:** The Booking content is now a single page matching the supplied reference: three numbered sections, aligned equal-height controls, segmented single/bulk and pricing modes, weekday pills, generated appointment rows and a sticky financial summary. This supersedes the earlier wizard presentation while retaining the financial/API rules below. The sidebar/header and backend are unchanged. **93 frontend regression tests pass**, production build is warning-free, and desktop/mobile/Arabic browser checks against the matching local test backend pass. See [BOOKING_FINANCE.md](BOOKING_FINANCE.md) for screenshots and validation details.

## Current finance status — 2026-10-31

The course-finance implementation supersedes the original batch-pricing policy and insurer-UI limitations recorded below. Packages cover the prescribed/approved course and are reused across batches. Check-in uses actual patient receipts and cumulative consumed-session coverage. The Booking wizard and separate insurer claim/settlement ledger are implemented. See [BOOKING_FINANCE.md](BOOKING_FINANCE.md) for current behavior, **87 focused frontend / 52 backend passing checks**, browser evidence and remaining SQL Server prerequisites.

The financial migration `20261030184822_CourseFinancialAgreements` is the sole pending migration on the read-only confirmed SQL Server target. It has not been applied. The matching current backend was exercised only with isolated SQLite through local ASP.NET TestServer; the user's running API on 7223 was not restarted. Working-hours policy is unchanged. No push/deployment was performed.

The following sections retain earlier implementation history and earlier verification counts; their financial policy and pending-UI statements are historical, not the current completion report.

## Room availability and checkout

After patient selection, Booking checks `POST /api/Rooms/availability` with all selected `startsAt` values. Only active rooms free for every selected 60-minute interval appear in the dropdown. Pending overlapping reservations and ongoing room occupancy exclude a room; changing dates, time, or bulk recurrence reloads availability. Stale reads are cancelled, removed room selections are cleared, and availability failures remain visible with retry.

Successful appointment changes refresh the room list and the Booking availability query. Checkout makes the room available immediately unless another reservation conflicts or the room is inactive/under maintenance. Ongoing occupancy persists past the planned end time until explicit checkout. Room cards display the backend's Available/Occupied/Maintenance status. No schema migration is required. Verification: 33 backend and 58 focused frontend tests pass.

## Staff working-hours setup

CEO Staff Management Add User and Edit User include a **Working days and hours (Cairo time)** editor with seven weekday checkboxes and one shared Start Time / End Time pair. All selected days share the same range; changing either time updates every selected day. At least one day and a valid range are required for staff accounts. The editor uses the existing theme tokens, responsive weekday grid and side-by-side time controls, with English/Arabic inline validation.

The existing Users Add/Update contract is unchanged: the frontend sends one entry per selected day, each with identical start/end times. Existing uniform schedules load into the weekly selector. Older schedules with differing daily ranges require explicitly choosing one shared range before saving; they are not silently merged or changed on load. Patient-only accounts have no staff-hours editor and can still save without a staff schedule.

Booking contains no working-hours editor or setup/read/save requests. Missing clinician hours direct staff to CEO Staff Management. Booking continues to validate the full appointment against the saved schedule. The backend saves user, roles and hours in one transaction using the existing DoctorSchedules table. The weekly-selector refactor does not change the API or database schema. Browser checks use synthetic data with intercepted API requests; no live staff accounts are created or changed.

Backend implementation and migration details are in the sibling `Physical-Therapy-Center/BOOKING_WORKFLOW.md`.

## Implemented frontend behavior

- Initially fetch only the minimal booking patient directory. Fetch clinical completion, treatment plans and insurance information after selection; fetch eligible clinicians and room candidates then. Quick registration loads insurance companies only when Insurance is selected.
- Before completed assessment: Assessment only, matching Seniors, explicit Free/Paid choice for self-paying patients, required Paid price, and the temporary free/waived insurance assessment policy.
- After completed assessment: select a saved plan for either a single session or bulk booking. Prefer its assigned Doctor and show gender-matching eligible alternatives. Show planned/booked/completed counts and remaining insurance approval capacity.
- Automatically display the 60-minute planned end. Both booking and schedule-edit screens remove manual end-time inputs. Actual attendance timestamps are displayed separately and changed through explicit backend actions.
- Bulk scheduling accepts count, first date, weekdays and start time, then previews generated appointments and conflicts. Prices, discounts, actual deposits, payment methods and installment arrangements are sent to the backend for validation. A changed form invalidates the preview.
- Booking confirmation sends one transactional request rather than separately creating appointments, invoices and payments. The summary distinguishes agreed charges, patient/insurer liabilities, actual receipts and remaining patient balance.
- Billing's installment tab reads saved agreements and real balances and collects against their existing invoices. Payment methods are explicit. Unknown booking and collection outcomes retain their retry identity and expose reconciliation; a retry never silently obtains a fresh identity.
- The Senior dashboard reads persisted appointments and actual clinician workload. Starting an assessment records explicit check-in; the clinical form persists its completed assessment and plan before displaying success. Saving the clinical record does not fabricate an actual checkout.
- English/Arabic labels, existing UI cards and controls, authentication guards and interceptors are preserved. Backend enum definitions are now read from sibling source rather than guessed. Unidentified legacy numeric values stay unidentified.

Your local API configuration `https://localhost:7223/api` was preserved. Runtime compatibility requires the matching backend and its migration; no production endpoint was used to create test data.

## Checks

- 143 focused frontend tests pass across booking, rendered UI, billing, registration, profile, refresh, locale and Senior workflows. All HTTP is intercepted locally.
- Application and spec TypeScript checks pass.
- Production Angular build passes; existing CEO template and Schedule/Bookings CSS budget warnings remain.
- Backend: 25 local relational/JWT HTTP/migration tests pass; see the sibling report for details.

Logs from local frontend verification are under ignored `tmp/`. Backend verification outputs are under ignored `.tools/`. The unrelated full frontend suite and interactive browser walkthrough have not been used as evidence for these focused test results.

## Remaining verification and data prerequisites

Apply the migration only to an approved test SQL Server database, then perform a browser walkthrough of cash Free/Paid assessment, pre-approval insurance assessment, Senior completion, single/bulk treatment, conflicts, partial collection and rescheduling in both languages. SQL Server execution and provider-specific concurrent-load behavior are not established by SQLite tests.

Working hours, active rooms, known patient funding and saved insurance approval/copay/session limits are required data. The application does not replace missing data with default prices or availability. Legacy assessments without completion metadata need explicit clinical sign-off. No refund or cancellation-fee policy has been invented; cancellation does not erase a financial obligation.

No push, deployment or production-data modification was performed.

## Runtime follow-up (2026-10-29)

Angular is running on localhost:4200 and still targets https://localhost:7223/api. The backend's repository and built file configuration select a remote SQL Server database whose isolation has not been confirmed; running-process overrides cannot be inspected with the available Windows access. No authenticated runtime workflow was exercised, backend restarted, or SQL Server migration applied. The sibling report records the exact guarded migration command and the target/restart prerequisites. Successful Release build and SQL script generation do not establish SQL Server runtime verification.

Policy clarification: packages cover only their selected batch; cancellation retains the full saved financial obligation without an automatic credit/refund. Backend insurer receipts are separately recorded through Billing payments and settle invoice/session status only together with sufficient patient receipts. Current Angular Billing controls collect patient funds only and do not yet expose insurer receipt entry or a separate insurer balance summary. This remains an end-to-end financial UI limitation.
