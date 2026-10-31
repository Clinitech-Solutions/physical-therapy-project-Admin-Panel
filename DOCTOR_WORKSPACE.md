# Doctor workspace - 2026-10-31

## Delivered behavior

The Doctor dashboard now reads the authenticated clinician's real schedule. It defaults to the Cairo clinic date, supports date navigation/search/status filters, shows every appointment, and keeps overdue active treatments visible. Start/Continue/Open Patient lead directly to the saved appointment workspace. There are no sample patients, fixed Doctor IDs, invented notes, or performance scores.

The clinical workspace separates prescribed, booked and clinically completed counts and uses the saved session identity. It displays the Senior assessment, diagnosis, saved instructions, existing documents and previous notes without granting prescription or financial editing. Missing precautions, authors and historical treatment timestamps remain explicitly unknown.

Reception arrival, Doctor treatment start, Doctor treatment end and Reception departure are separate persisted events. Planned appointments remain 60 minutes. Treatment end atomically finalizes notes and increments progress once; departure releases the room without completing treatment again. Reception checkout controls explain/disable departure until ordinary treatment has ended. Initial assessment behavior is retained.

Four clinical note fields have debounced server autosave, visible save/failure states, reload recovery, retained retry payloads, version-conflict review, and an explicit atomic End action. Switching patients cannot accept a late autosave for the previous patient. Final notes are read-only; no correction workflow is introduced. Unsaved navigation/unload is guarded. Clinical drafts are not stored in browser storage.

The server shares one whole-interval capacity rule across booking preview/confirmation, bulk booking, rescheduling and treatment start: at most two Doctor treatments in distinct rooms, exclusive patient/room reservations, unchanged Senior assessment restrictions, and unchanged working-hours/absence/gender rules. Actual running treatments count even after planned end. Mutation transactions serialize scheduling changes. Patient coverage is rechecked at treatment start; exact shortfalls direct collection to Reception. Insurer receivables alone do not block covered patient liability. Existing Reception arrival payment gates remain enabled.

## Confirmed reassessment policy

The user's latest policy supersedes the original attachment's proposed scheduled reassessment flow. Reassessment is an internal clinical review for both self-pay and insured patients:

- Doctor submits a reason, clinical notes and Continue/Pause recommendation. Recommendations do not create automatic holds.
- Requested -> In Review -> Completed; cancellation records a reason. One active request per plan and idempotent retries prevent duplicates.
- Reception and eligible Seniors see pending requests. A Senior opens and claims a request directly during the visit. No separate appointment, price, approval, fee, invoice, payment or claim is required. Unavailable Seniors leave requests pending.
- Completion preserves the original assessment/plan/session history. Revising creates a linked new assessment and plan; original/revised plans carry a staff-review warning where needed. Existing bookings, course agreements, balances and approvals are not rewritten. Discharge remains a review recommendation rather than automatic cancellation.

The dashboard/header/sidebar design system remains in use. English/Arabic, RTL, responsive layouts, light/dark themes, labelled controls and loading/error/retry states are implemented. A failed queue load remains unavailable rather than becoming zero.

## Verification and evidence

| Check | Result and boundary |
| --- | --- |
| .NET suite | 177 passed, zero failed. SQLite relational/real-JWT HTTP tests plus offline SQL Server model/migration checks. Includes payment gates, wrong-role/other-Doctor denial, two/third overlaps, interval sweep, bulk/reschedule, overdue occupancy, concurrent booking/start/reschedule/review claims, draft/final retries, exactly-once progress and financially independent review. |
| Focused Angular regression | 62 passed across 10 files. HTTP is intercepted by Angular's test controller; these are not live SQL Server tests. Includes Doctor drafts/patient-switch races, Senior review, Reception attendance, booking/payment gates and translation parity. |
| App/spec TypeScript | Both passed. |
| Production build | Passed without warnings; existing budgets unchanged. |
| Full Angular suite | 302 passed, 25 failed across 9 legacy test files. Remaining failures concern ClinicState sample-data expectations and generated theme/layout/sidebar/CEO/Senior/language tests lacking providers or matchMedia. These are not presented as a passing full suite. |
| Real browser workflow | Real Angular on 4300, real Identity logins for Doctor/Senior/Reception, matching ASP.NET TestServer and a fresh temporary SQLite database. Chrome API interception forwards requests to the real isolated backend; it does not fabricate successful business responses. No shared SQL Server mutations. |
| Browser assertions | Draft survives reload; two treatments run concurrently; unpaid insurer share does not block; patient shortfall is exactly EGP 100; request visible to Senior/Reception; direct same-visit revised-plan completion adds no appointment/financial records; Doctor end and Reception departure remain distinct; progress/final notes count once. Zero browser runtime errors. |
| Visual inspection | Rendered screenshots at 1366x768 English/light and Arabic/light, 1920x1080 English/dark, and 390x844 Arabic/dark and English/dark. Checked mobile overflow, 42px buttons, note focus and reachable End controls. Screenshot inspection corrected stray separators and a stale development-server overlay before final evidence. |

Ignored local evidence: `tmp/doctor-final-front-tests.log`, `tmp/doctor-final-full-front-tests.log`, `tmp/doctor-final-tsc.log`, `tmp/doctor-final-spec-tsc.log`, `tmp/doctor-final-build.log`, `tmp/doctor-final-browser.log`, and `tmp/doctor-workspace-preview/` screenshots/result JSON. Backend logs are under the sibling repository's ignored `.tools/` directory. These artifacts use synthetic data and contain no shared credentials.

## Activation boundary and remaining blockers

The complete additive migration **20261031164400_DoctorClinicalWorkspace is NOT APPLIED**. Read-only inspection confirmed `db56823.public.databaseasp.net / db56823` (server identity S13), latest history `20261031122754_AppointmentScheduleAudit`, exactly this one pending migration, matching model/snapshot, and none of the four new treatment columns present. Review and SQL hash are documented in the sibling backend's `Database/ReviewedMigrations/20261031164400_DoctorClinicalWorkspace.REVIEW.md`.

Explicit authorization for this new migration is required before shared activation. Do not restart the shared API onto the new schema-dependent build until that migration is approved/applied. The user-owned API/Angular processes were preserved; no shared financial test records, push or deployment occurred. The user's concurrent environment.ts localhost change was preserved.

No SQL Server instance was available for isolated migration execution or provider-specific concurrency testing. SQLite uses EnsureCreated, not SQL Server migration execution. SQL Server app-lock behavior is reviewed/generated but remains a runtime verification requirement on an authorized isolated SQL Server target. Earlier migration approvals do not authorize this migration. The unrelated 25 frontend failures remain documented above.

See the sibling backend's `DOCTOR_WORKSPACE.md` for endpoint permissions, transactions, migration review and test commands.
