# Reception and payment audit — 2026-10-31

## Current status

The reception finance fixes are implemented and the user-restarted API on local port 7223 exposes the updated reporting contract. The Arabic Billing payment input fix is implemented and verified against that API through a fresh Angular server on port 4300. The existing Angular process on **4200 still serves the earlier input implementation**: a fresh browser reproduced the cleared amount there after selecting Cash. Restart that Angular process to activate the fix; the backend does not require another restart for this frontend change.

No migration, shared financial write, push or deployment was performed during this audit/resume. Both repositories were clean at the start of this resume; earlier backend and reception fixes were already committed in the workspace and were preserved.

## Confirmed problems and corrections

| Problem | Corrected behavior |
| --- | --- |
| Arabic currency input could not parse its own formatted amount on blur. `25.50` could also be parsed as `2550`. | The collection input uses Latin numeric digits with the current language's locale and the unambiguous `EGP` code. Arabic labels and RTL remain. Selecting a method preserves the amount, and decimal edits remain exact. The label now targets the amount input. |
| Daily reporting used server-local dates and invoice totals as a proxy for receipts. | Cairo UTC day boundaries, including 23/25-hour DST days; actual Paid receipts filtered by payment date, split into patient and insurer collections. Charges are shown separately. |
| An insurer receipt using a normal collection method could be classified as a patient payment. | Shared payer classification recognizes explicit Insurer/Insurance payer types and legacy Insurance methods consistently across balances, gates, profile and reporting. |
| Billing errors flattened missing records and retry conflicts into misleading statuses. | Missing invoices return 404; known database concurrency conflicts return a recoverable 409. Existing authentication and backend roles remain enforced. |
| Lost responses/reloads could discard the original payment details or confuse a committed claim with a new insurer settlement. | Retain the operation kind, exact amount/method/reference and retry identity. Recover the original receipt/claim explicitly; changed details cannot silently reuse an uncertain operation. |
| A payment gate already satisfied after a lost response could skip reconciliation. | Recover the original receipt before a separate explicit Start. Recording payment does not itself check in the patient. |
| Online was offered but rejected for account collection. | The account form accepts the same verified patient payment methods it offers. |

Existing course pricing, discounts, patient/insurer allocation, read-only prescribed counts and copay, rounding, 60-minute planned appointments, rescheduling charges and working-hours policy are preserved. The earlier authorization audit and complete endpoint-to-permission matrix remain in [RECEPTION_ACCESS_CHECKLIST.md](RECEPTION_ACCESS_CHECKLIST.md).

## Verification and its boundaries

| Check | Result and scope |
| --- | --- |
| Backend regression suite from this audit | **154 passed**, before this UI-only resume; source unchanged afterward. Relational tests use isolated SQLite, HTTP tests use ASP.NET TestServer with real Identity/JWT authorization. Includes Cairo dates, payer separation, allocations, gates, Online receipts and retries. SQL Server model/script checks are offline. |
| Current focused Angular payment suites | **40 passed across 6 files**: Billing form/service, course finance, payment gate and insurer recovery. Includes rendered Arabic/English dropdown selection and decimal input, exact `25.5` HTTP payload, and original-details locking after an uncertain response. HTTP responses in these tests are mocked. |
| Earlier broader reception regression | **218 passed across 22 files**, recorded before the additional two rendered input cases. |
| Current full Angular suite | **285 passed / 27 failed**, 45 files. The same 27 pre-existing failures remain in legacy ClinicState sample-data expectations and generated component tests lacking translation/router/matchMedia providers. They were not disabled or reported as passing. |
| TypeScript | Application and spec type checks passed. |
| Production build | Passed without warnings, **1.47 MB** initial bundle, unchanged budgets. |
| Actual Angular finance browser workflow | Matching backend through local port 7288, real Receptionist Identity login, temporary SQLite only. Self-pay/insurance booking, exact shortfall collection, explicit start/check-out, claims and insurer settlement passed. Deliberately lost patient receipt, claim and insurer receipt responses were recovered after reload without extra records. Business responses came from the backend, not canned fixtures. |
| Isolated ledger reconciliation | 6 invoices: total 1,650 = patient liability 1,410 + insurer liability 240. Patient receipts 470, insurer receipts 80, patient outstanding 940. Exactly 4 distinct payments and 1 claim. Earned insurer outstanding zero; planned unearned liability remains separate. Room available after check-out. All records synthetic in SQLite. |
| Current Arabic/English input browser check | Actual rendered form, API 7223 reads only, refreshed Angular on 4300. Light desktop 1366×768 and dark mobile 390×844 in each language; method selection preserved amount, `25.50` remained numeric `25.5`, amount remained editable, focus and footer geometry passed, no modal horizontal overflow or runtime errors. Screenshots inspected. |
| Current seven-screen browser read check | Dashboard, Patients, Booking, Schedule, Rooms, Insurance and Billing rendered against API 7223. New patient/insurer collection fields present and sum correctly. Insurer lookup 200, administrative Users/GetAll 403, nonexistent invoice 404, patient profile and insurer accounts 200. No mutation requests or runtime errors. Uses a short-lived locally signed token for an existing Receptionist; this is distinct from the real password login exercised in isolation. |
| SQL Server verification from this audit | Read-only target/history/schema and local service/HTTP checks: `db56823.public.databaseasp.net / db56823`, identity S13; latest applied `20261031122754_AppointmentScheduleAudit`, no pending migrations. Profile, dashboard and invoice reads passed. No shared test records. |

## Remaining limits and activation

- Restart the existing Angular development server on port 4200, then refresh the browser. Its old bundle still reproduces the Arabic parsing failure; this is a frontend activation step, not an API or database issue.
- Shared SQL Server financial writes, concurrent collection/locking under that provider and production-load behavior were deliberately not exercised. Passing SQLite and mocked tests do not certify those operations. Do not create shared financial test records without separate authorization.
- The unrelated full-suite failures above remain. The reception audit does not assert that every generated test or legacy demo screen is clean.
- No new migration is needed. Earlier separately authorized finance and schedule-audit migrations are recorded in the backend's reviewed-migration application reports; historical pending statements in older notes are superseded by those reports and the read-only verification above.

## Local evidence

Ignored artifacts contain the detailed logs and screenshots; credentials and tokens are not included in this report.

- `tmp/payment-recovery-regression.log`, `tmp/reception-audit-final-full.log`, `tmp/payment-dialog-build.log`
- `tmp/arabic-payment-dialog/verification.json` and language/theme screenshots; `tmp/arabic-payment-original-port/probe.json` records the still-stale port 4200 behavior.
- `tmp/reception-shared-read-audit/result.json` and seven screen captures.
- `tmp/reception-finance-audit/result.json`, `ledger-verification.json` and workflow captures.
- Backend `.tools/reception-final-audit-tests.log` and `.tools/reception-audit-shared-read.log`.
