# Booking finance UI

## Approved finance migration applied - 2026-10-31, 13:29 Cairo

Only `20261030184822_CourseFinancialAgreements` was applied to the explicitly authorized `db56823.public.databaseasp.net` / `db56823` target after fresh target/history/SQL review. Its history entry, missing invoice columns and zero pending migrations are verified. Local dashboard and billing invoice GETs return HTTP 200 against SQL Server. Existing row counts and invoice/payment totals are unchanged; no test financial records, push or deployment. These SQL Server read checks are separate from earlier isolated SQLite/browser tests. See the sibling backend's [application report](../Physical-Therapy-Center/Database/ReviewedMigrations/20261030184822_CourseFinancialAgreements.APPLIED.md). This update supersedes earlier pending-migration/activation-blocker statements below, which describe the prior stage.

## Single-page visual redesign — 2026-10-31

Booking content now follows the supplied visual reference: three numbered cards (Patient & treatment plan, Appointment details, Pricing & payment) alongside a sticky financial summary. This replaces the earlier five-step presentation. The application sidebar, topbar, routes and backend financial rules are unchanged by this visual update.

Controls share a 44px outer height, three-column desktop alignment and responsive mobile stacking. Single/bulk booking and pricing use segmented buttons; bulk weekdays use accessible checkbox pills. A compact appointment table shows draft rows as awaiting preview and marks availability only from a current successful server response. On mobile, the table scrolls horizontally rather than splitting names/dates into narrow columns. Currency fields have aligned EGP/% addons, and the sticky summary contains the single confirmation action.

Patient/plan selection loads eligible clinicians and available rooms directly on the same page, with stale requests cancelled. Separate date/time controls preserve the existing combined appointment payload and fixed 60-minute duration. Amounts, approval limits, copay and saved agreements retain their existing source and validation. The summary distinguishes insurance-covered course counts from prescribed counts and keeps free assessments free. Cancelling clears draft payment fields; any edit invalidates the previous quote and disables confirmation until re-previewed.

Verification for the redesign: **93 frontend regression tests across 15 files pass**, including **38 focused Booking/payment checks**. Production build passes without warnings under unchanged budgets. Chrome against the matching isolated SQLite-backed ASP.NET test host verified bulk and insurance booking, payment shortfall collection, explicit attendance, claims and settlements, all measured controls at 44px outer height, sticky desktop summary, light/dark themes and Arabic/RTL mobile without panel overflow or runtime exceptions. No shared/remote database, backend source or schema changes were made for the visual redesign.

Current visual evidence: `tmp/booking-redesign-preview/review-desktop-light.png`, `review-desktop-dark.png`, `review-mobile-arabic.png` and `result.json`. Logs: `tmp/booking-redesign-regression.log`, `tmp/booking-redesign-tests.log`, `tmp/booking-redesign-build.log`, `tmp/booking-redesign-browser.log`. The earlier financial migration prerequisite remains unchanged.

Final verification resumed on 2026-10-31. Implementation is complete locally; the shared SQL Server financial migration remains unapplied. The configured SQL Server target and live migration history were rechecked read-only. See the validation table below and the sibling backend's `COURSE_FINANCE.md` for the precise boundary.

Booking groups patient/plan, appointment and pricing/payment controls on one page beside the financial summary. It loads clinical context after patient selection, then eligible clinicians and room availability when a plan is ready. A financial/server availability quote is requested by Preview appointments. Valid context/clinician lookups are cached briefly; abandoned requests are cancelled and confirmed mutations invalidate context. Price edits invalidate the quote fingerprint without reloading unrelated screens. Existing unknown-outcome booking reconciliation is preserved.

Funding is read from the patient and displayed as Self-pay or Insurance. Collection methods are Cash, Visa and Online. Saved course terms are read-only. Insurance always uses Package with separate prescribed count, approved limit, remaining approvals and saved copay. Discounts offer None, Percent or Fixed for self-pay only. The server computes the course allocations, shares and balances; confirmation requires a current successful quote.

The shared check-in dialog opens for both existing Result-style and ProblemDetails-style payment rejections. It displays the server's exact shortfall, records patient money, and requires a separate explicit Start action. Retry keys survive uncertain outcomes and reloads. Insurer claims and actual receipts have separate controls in Billing; historical patient/insurer receipt details remain visible with external references.

Per Session collection is capped at that session's remaining patient liability. Historical package collection reuses the saved batch's account allocator, including a shortfall spanning more than one invoice. A course cannot be adopted if consumed historical sessions have no reconcilable invoice. Saved course terms and installment arrangements are reused; later booking batches cannot enter replacement arrangements. An old/incomplete financial preview cannot enable confirmation.

The backend requires migration `20261030184822_CourseFinancialAgreements` before the main API can serve this flow. That migration is prepared and reviewed in the sibling backend repository and **has not been applied to the remote database**. See its `COURSE_FINANCE.md` for the forward SQL, historical compatibility rules and authorization boundary.

Verification uses frontend HTTP/component tests plus a real Chrome run against a local API test host backed exclusively by temporary SQLite and synthetic data. The browser checked booking, exact shortfall collection and successful check-in, dark/light desktop, and Arabic/RTL mobile without overflow or runtime errors. Local screenshots and result JSON are under ignored `tmp/finance-preview/`.

| Check on 2026-10-31 | Evidence and limits |
| --- | --- |
| Focused Angular tests | **87 passed across 15 files**. HTTP/component tests use intercepted requests; this is not a claim that the unrelated full-suite baseline is clean. Includes Booking, Billing, shared collection, schedule, Senior dashboard, login/authentication and guards. |
| Backend tests | **52 passed**, using isolated relational SQLite, authenticated ASP.NET TestServer HTTP, retry/concurrency checks, plus an offline SQL Server model/snapshot/script check. |
| Production build | Passed without warnings; initial bundle **1.45 MB**, within the unchanged budget. Login and the collection dialog load lazily. |
| Actual Angular browser flow | Real Angular UI with requests relayed to the matching rebuilt ASP.NET test host on local port 7288; business responses come from the backend, not canned HTTP fixtures. Synthetic self-pay and insurance bookings, check-in/out, claim and settlement succeeded. No browser runtime errors or mobile panel overflow. |
| SQL Server read-only audit | `db56823.public.databaseasp.net / db56823`, server identity `S13`. Latest applied: `20261029124607_BookingWorkflow`. Sole pending: `20261030184822_CourseFinancialAgreements`. No remote data or schema writes. |
| SQL Server runtime | New migration execution, populated SQL Server finance flow and provider-specific concurrent locking remain unverified. Explicit authorization is required before applying this new migration to the confirmed target. The user's API on port 7223 was not stopped or restarted. |

Browser financial evidence: self-pay gross 1,500 less 150 discount = 1,350; 400 actually collected; 50 exact shortfall collected before an explicit successful start. Insurance course 300 = 60 patient + 240 insurer; patient receipt 20; one delivered session earned 80 for the insurer; a submitted claim and actual Online settlement recorded 80 collected, with zero earned outstanding. Patient receipts remained separate. Exactly two bookings committed, one per patient flow.

Logs: `tmp/finance-final-tests.log`, `tmp/finance-final-build.log`, `tmp/finance-browser-resumed.log`; backend `.tools/finance-tests.log`, `.tools/finance-target-audit.json`, `.tools/finance-preview-final.log`. No push or deployment was performed.
