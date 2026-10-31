# Shared Patient Profile and single-session rescheduling

Implemented on 2026-10-31 in the shared `PatientProfileComponent` and sibling backend. The approved image is a visual reference; all displayed people, courses, sessions, payments and slots come from backend records. No shared-database test writes, migrations, push or deployment were performed for this task.

## Presentation and records

- The modal follows the reference's patient header, four summary cards, tab bar, session table and expandable inline editor. The application header/sidebar are unchanged. Styling uses existing theme variables and is scoped to `.patient-profile-modal`; portal-specific styles are imported globally because PrimeNG appends the dialog to the document body. Existing build budgets are unchanged.
- The modal stays within the viewport and scrolls internally. Desktop keeps the summary/tab area above the scrolling body; mobile lets the header scroll away so the editor remains usable. Native details, buttons, inputs and radios support keyboard operation; the modal traps focus, tabs support arrow/Home/End navigation, and editing restores focus to its trigger after save/cancel.
- The header shows name, patient number, phone, gender, funding and primary clinician. Secondary demographics use Patient details. Technical account IDs and generated placeholder emails are omitted from the primary view. Real non-placeholder email remains available in details.
- A treatment-course selector explicitly scopes prescribed/completed counts, patient receipts, patient balances, sessions, payments and recorded schedule changes. All saved courses, including inactive history, remain selectable. Unbooked saved sessions are labeled Not scheduled rather than inventing appointments. Prescribed counts remain read-only; unsaved course/session rows are never manufactured.
- Patient payment coverage is separate from full invoice settlement and insurer receivables. Patient paid totals use actual paid receipt records, not a paid-status flag. Package coverage is evaluated against consumed liabilities plus the selected session as the next start; check-in remains authoritative. Insurer money and remaining insurer balance are displayed separately. Assessment receipts remain available separately from course balances in Payments.
- Sessions shows session number, Cairo-local weekday/date, scheduled interval, clinician/room, actual attendance, patient coverage, status and eligible Edit action. Payments shows actual receipts. Activity Log shows recorded actor/time/before/after/room/reason, plus a clinical assessment disclosure without duplicating session rows. Documents retains verified patient-filtered downloads/uploads and loads on demand.
- English/Arabic, RTL, both themes and responsive layouts are supported. A profile/slot/document failure has its own message/retry; failed reads do not become successful empty results.

## Inline editor and persistence

Only upcoming Pending appointments with no actual attendance and an unstarted linked session can be edited. Completed, in-progress, cancelled, no-show and past appointments cannot be reopened. One editor is shown immediately below its row. The assigned clinician is fixed; the user can change time on the same day or choose another day, paired with a server-returned room. Planned duration stays 60 minutes.

Slot discovery runs when the row opens/date changes. It uses saved schedules and absences, clinician eligibility/gender, patient conflicts, active rooms, room capacity and all other reservations/actual occupancy. It excludes the edited appointment. An empty saved schedule produces no availability. No clinician working-hours policy or booking horizon is invented. Suggestions use 30-minute start increments within saved hours and also include a non-grid original start where valid. Cairo DST gaps/ambiguous instants are not silently assigned an offset.

The existing exclusive room/clinician reservation policy is preserved: even a room with physical capacity greater than one is not offered during another reservation or ongoing occupancy. Capacity is shown only for otherwise eligible free rooms. The policy previously confirmed by the user—hide occupied/booked rooms until checkout—is not relaxed by this editor.

Abandoned slot requests are cancelled; selections are cleared on date changes/retries. Loading, errors, retry and no-slots states are distinct. Before/After and an optional reason are visible. Switching rows/courses/pages or closing with a dirty draft requires explicit keep/discard. Cancel does not call a mutation endpoint. A lost save result can be closed safely while retaining the pending operation.

The new save updates the same appointment and linked treatment-plan-session date inside a Serializable transaction. It preserves patient, course, clinician, identities, status, session count, recurrence, prices, discounts, invoices, receipts, approval usage and allocations. It reuses the existing Booking availability validation. `UpdatedAt` is an optimistic concurrency token in addition to the submitted schedule version and serializable checks.

A stable operation key and request fingerprint protect retries; the committed receipt/audit is stored in the same transaction. An identical retry returns its original receipt; changed intent using the same key is rejected. Another client's changed schedule returns 409; a newly occupied slot also returns 409. The draft date/reason stay available while slots/current data refresh. A save times out after 30 seconds (reads after 20 seconds); the timed-out operation is retained for reconciliation. Unknown outcomes retain the original request in user/patient-scoped session storage. The UI first reconciles the original key; an explicit retry after not-found uses the same payload/key, never a replacement booking. Confirmed saves update the row, reload only the profile's course data, and notify the existing reception refresh service.

## API contracts

All paths below start with `/api/Bookings` and require authentication.

| Endpoint | Contract and permission |
| --- | --- |
| GET `patients/{id}/profile` | Patient-scoped courses, sessions, real financial/receipt data, assessments and recorded schedule changes. Existing staff read roles: Receptionist, Senior, Doctor, Ceo, Admin, Owner. Replaces Profile's eager global appointment/invoice reads and per-plan session requests. |
| GET `appointments/{id}/reschedule-slots?date=yyyy-MM-dd` | Availability, current appointment version/schedule, assigned clinician and real eligible 60-minute room/time pairs. Staff read roles; no mutation/reservation. |
| PUT `appointments/{id}/reschedule` | `{ operationKey, expectedVersion, startTime, roomId, reason? }`. Receptionist/Ceo/Admin/Owner only. Clinician, patient, financial fields and status cannot be submitted or replaced through this DTO. Returns the original appointment's committed receipt. |
| GET `appointments/{id}/reschedules/{key}` | Reconciles an operation recorded by the same authenticated actor; Receptionist/Ceo/Admin/Owner only. Returns 404 if no matching committed change is confirmed. |

Existing appointment/Booking reschedule endpoints remain compatible and now reject cancelled/no-show/started/past records rather than silently resetting them to Pending. Historical schedule changes were not fabricated or backfilled. Durable actor/before/after entries described here are created by the new audited profile-save endpoint.

## Required migration — prepared, NOT applied

`20261031122754_AppointmentScheduleAudit` adds only `AppointmentScheduleChanges`, its indexes (including unique operation key), and restrictive appointment/patient foreign keys. It stores immutable operation receipts and activity. `UpdatedAt` concurrency uses an existing appointment column; it adds no rowversion column. The forward SQL has no table/column drops, existing-data updates/deletes, truncation or financial backfill. Down drops audit history and is not a history-preserving rollback.

Reviewed forward SQL: sibling backend [20261031122754_AppointmentScheduleAudit.sql](../Physical-Therapy-Center/Database/ReviewedMigrations/20261031122754_AppointmentScheduleAudit.sql). SHA256: `D4EFC568F1FCA88BB32C2CF5CC1E038FDF5C1D0C80E10361A1E2AB2FC1D72769`.

**Shared activation is blocked until this new migration is explicitly authorized/applied to a rechecked target and the matching API build is loaded.** The previous finance-migration authorization does not cover it. No shared database or main API process was changed here. When the audit table is missing, the new profile API reports an administrative-setup response rather than reporting an empty profile. Other application screens and the already-applied finance migration are preserved.

## Verification

| Check | Evidence and limits |
| --- | --- |
| Backend regression | **145 passed** using isolated relational SQLite/TestServer and an offline SQL Server model/snapshot/SQL check. Covers same/different-day changes, self-exclusion, clinician/patient/room conflict, maintenance/zero capacity, absent/missing hours, Cairo DST, stale/concurrent requests, idempotency, no reopening and unchanged financial/session identities. Authentication uses actual Identity login/JwtProvider for Receptionist/Patient/Doctor in the HTTP scenario. |
| Final HTTP check | The authenticated Profile/reschedule HTTP scenario was rebuilt/rerun after the missing-schema response handler; passed. |
| Focused frontend regression | **87 passed across nine files**, using mocked HTTP/component interactions. Includes shared profile, Booking, Billing, registration, Dashboard, Schedule and access controls. Covers cancelled stale reads, inline expansion, no nested dialog, course scoping, errors vs empty, dirty-draft confirmation, double submission, 409 recovery, unknown outcomes/exact-key reconciliation, close/reload recovery, read-only completed rows, localization and document boundaries. |
| Angular production build | Passes without warnings under unchanged budgets; initial bundle approximately **1.46 MB**. |
| Real Chrome integration | Actual Angular rendering with requests relayed to a rebuilt ASP.NET test host backed exclusively by temporary SQLite. Real Receptionist-only login; no mock slot availability. Same-day/room change, different-day exception, a second-client stale rejection, cancel/keep/discard, persisted audit/financial invariants and reload persistence exercised. Light/dark desktop, Arabic/English, RTL/mobile and focus containment checked. A lost HTTP response was deliberately injected **after** an actual server commit to verify reconciliation; it was not mocked persistence. |
| SQL Server/shared environment | Migration SQL/model checked offline only. New audit migration execution, populated SQL Server reschedule writes/concurrency and shared browser activation remain unverified and were deliberately not attempted. No test financial records were created in a shared database. |

Synthetic browser example: prescribed 10, completed 1, course total 4,500, actual patient receipts 900 and patient balance 3,600. These amounts/counts remained unchanged after three successful schedule changes (including a second-client change). Exactly three corresponding audit entries persisted; no replacement appointment/charge/payment was created and unrelated sessions stayed unchanged. An injected lost response reconciled to its real committed operation.

Local evidence (ignored): `tmp/profile-regression-tests.log`, `tmp/profile-build.log`, `tmp/profile-browser.log`, `tmp/patient-profile-preview/result.json` and screenshots. Sibling backend: `.tools/profile-tests.log`, `.tools/profile-http-final.log`, `.tools/profile-migration-script.log`, `.tools/profile-preview.log`. Test credentials/tokens and real patient response bodies are not included in the report. The isolated test backend is stopped after verification. No push or deployment.
