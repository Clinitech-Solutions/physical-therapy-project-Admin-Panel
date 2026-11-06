# Patient-grouped Billing and Invoices

Delivered 2026-11-06, Africa/Cairo. Both repositories were modified locally. No push, deployment, database migration or shared-database business write was performed.

## Implemented experience

Billing opens with one row per stable patient ID. Two people with the same name remain separate. Each row contains initials, name/profile navigation, phone, funding, historical company information, matching invoice count, agreed amount, patient liability, actual allocated patient receipts, remaining patient balance and payment status. Desktop uses a compact table; tablet and mobile use adapted rows/cards. Currency values align consistently. Arabic/English, RTL and light/dark themes are supported.

Expansion requests an independent invoice page, preserving the applied filters. Invoice rows show references, Cairo invoice/delivery dates, assessment/session type, saved pricing/account/plan context, funding/company, original patient and insurer shares, actual patient receipts, collectible balance, recorded invoice status and actual treating clinician when recorded. View remains available when Collect is disabled. Patient-settled and invoice-fully-settled are separate states.

Filters apply together, rather than issuing requests for every date edit. Applied filters survive paging and reload in the URL. Removable chips identify applied filters. Clear returns to unfiltered Invoice-date mode, first page. The company picker supports multiple selections. Mobile has a compact filter toolbar and a keyboard-accessible advanced sheet with focus restoration, Tab containment and Escape handling. Failed reads have independent retry states. Superseded summary and expansion subscriptions are cancelled.

The existing Pending Installments tab still reads saved booking/course agreements and current balances. It does not create installment invoices or add scheduled installment amounts to the financial totals. A patient-row Collect action first exposes invoices for staff selection; it does not allocate across unrelated accounts. A saved installment account reuses the existing account/course allocator, with an explicit allocation review before confirmation. The committed payment allocations remain in Payment records and invoice history; the page also displays the reviewed allocation after a successful collection.

## Reusable scope and filter definitions

The backend contract is [BillingQuery](../Physical-Therapy-Center/PTCenter.Application/Contracts/Billing/BillingQuery.cs). [BillingQueryService](../Physical-Therapy-Center/PTCenter.Infrastructure/Services/BillingQueryService.cs) supplies patient pages, invoice expansion and both export formats from one accounting pipeline.

| Filter | Meaning |
| --- | --- |
| Search | Patient's current saved name or phone contains the supplied term; patient identity is always the numeric ID. |
| Funding | Saved course funding, otherwise the invoice's saved liability split: a positive insurer share identifies Insurance; otherwise Self-pay. Mixed is a patient summary badge when matching invoices have both arrangements. |
| Companies | OR across the selected saved course/claim company IDs; combined with other filters using AND. Current patient insurance membership is never substituted. Legacy company identity without saved evidence is unavailable and does not match a specific company. |
| Date range/basis | Inclusive Cairo local day labels, converted to a half-open UTC interval: start of From through start of the day after To. Either bound can be omitted. No bounds means all dates. Invoice is the default basis. |
| Patient payment status | Applied **after grouping the matching invoices**. Unpaid: collectible balance and no patient receipts. Partial: patient receipts and remaining collectible balance. Patient settled: no remaining collectible patient balance. Non-collectible: all matching invoices are waived/cancelled. It is not a filter on insurer debt or the patient's full unfiltered account. |
| Invoice type/status | Existing backend enums; invoice status is preserved independently of patient payment status. |
| Pricing | Saved course agreement's Package/Per Session mode. Historical records without that agreement remain Unknown. |
| Appointment/session status | Actual linked saved appointment or plan-session enum. Missing links are not invented. |
| Plan | Saved course plan, otherwise linked plan-session's plan. |
| Actual clinician | Recorded `TreatmentStartedBy`, including Senior coverage; an assigned clinician is not treated as proof of who delivered care. Missing historical evidence is unavailable. |
| Collection method | An actual Paid receipt must exist with the requested method. In Invoice/Service mode this selects invoices and their full lifetime balances/receipts. In Collection mode it also limits receipts counted in the period. Unpaid invoices have no collection method. Insurance is a payer marker, not an offered collection method. |
| Claim status | Finance only: Unsubmitted, Submitted without receipts, Partially settled, or Settled, based on saved claims and actual insurer receipts. |

Underlying record filters precede patient grouping; patient payment-status filtering follows grouping. Patient groups are ordered by name, then stable ID, and only then paginated. Invoice expansion is ordered by creation timestamp descending, then invoice ID descending. Global totals and separate matching patient/invoice counts cover **all** matching groups, independently of the visible page. Expansion totals describe that patient's matching invoices. A profile action opens the existing full patient profile, separately from the filtered billing result.

API entry points:

- `GET /api/Billing/patients`
- `GET /api/Billing/patients/{patientId}/invoices`
- `GET /api/Billing/filter-options`
- `GET /api/Billing/export?kind=patients|invoices`
- `GET /api/Billing/accounts/{key}/allocation?amount=...`

The backend validates dates, ranges, enum values, status labels, company IDs, search length and page bounds. Patient pages default to 20 groups; expansion requests 10 invoices; the API caps page size at 100. Expansion queries restrict the database read to the selected patient. Structural filters are pushed into SQL where implemented; exact decimal aggregation and grouping run in the backend over the matching records. This is server-side aggregation, not grouping an invoice page in Angular. Very large unbounded reports still require production load/memory acceptance; database-side aggregate optimization is not claimed here.

## Financial metric definitions

All currency is EGP. Invoice values are counted once; receipt/allocation rows are never joined in a way that multiplies invoice liability.

| Metric | Definition |
| --- | --- |
| Agreed invoice amount | Sum of saved original invoice totals, including historical face values on waived/cancelled records. Their status remains visible; this figure is not collectible patient debt or earned revenue. |
| Patient liability | Sum of patient shares on eligible invoices, excluding waived/cancelled obligations. Detail rows retain original shares for audit. |
| Lifetime patient receipts | Actual Paid patient receipts allocated to the matching invoices, using the existing `CourseFinanceService.PatientReceipt` definition. Pending payments and insurer receipts are excluded. |
| Remaining patient balance | Sum of each eligible invoice's `max(0, patient share − actual patient receipts)`; waived/cancelled invoices contribute zero. No insurer balance becomes patient debt. |
| Collected in period | In Collection-date mode, actual eligible receipt allocations within the Cairo UTC interval and selected method. Reception sees patient receipts. Authorized finance users include patient and insurer receipts. It is shown separately from lifetime patient receipts and current balances. |
| Receipt count | Global operation count: recognized course/package/booking allocation rows share one receipt identity. Distinct invoice operations, including numeric retry keys, stay distinct. This count is not the number of allocation rows. |
| Planned insurer liability | Eligible saved insurer shares, including future planned services. Finance only. |
| Earned insurer receivables | Eligible insurer shares whose service has recorded delivery. Reuses the existing delivery rule: `DeliveredAt`, otherwise a legacy Completed appointment with saved actual checkout. Future services are excluded. Finance only. |
| Submitted claims | Saved submitted claim amounts for the matching invoices. Finance only. |
| Actual insurer receipts | Actual Paid insurer receipts; claims and approvals are not cash. Finance only. |
| Earned outstanding | Sum per invoice of `max(0, earned insurer amount − actual insurer receipts)`. Finance only. |

Invoice-date mode selects by invoice creation timestamp. Service-date mode selects recorded delivered services, excluding records without delivery evidence. Both show selected invoices' lifetime allocated receipts and current balances. Collection-date mode selects invoices with actual matching receipts in the interval, shows those period receipts separately, and retains those invoices' lifetime/current values. It does not describe cumulative invoice payments as cash collected during the period.

## Collection and role boundaries

Reception can search/filter operational billing, explain original payer shares and collect the collectible **patient** share through existing supported methods. Zero patient liability, a fully paid patient share, waivers and cancellations do not permit collection, including where insurer money remains due. No zero-value payment is fabricated and no waived invoice is relabelled Paid.

The invoice endpoint validates positive amounts, currency precision, payer/method, actual remaining balance and a submitted expected balance. Collection is transactional and uses the existing clinic mutation lock. Retry keys return the existing receipt and reject changed intent. The frontend preserves the original expected balance and payment intent through unresolved outcomes. It exposes the existing reconciliation path and locks competing collection actions while an outcome is unresolved.

Saved-account previews identify the actual invoices and amounts in existing allocator order. A normalized hash of the reviewed account/balances is rechecked within the collection transaction. A changed allocation returns 409; staff must review again. The original hash is retained with an unresolved operation. Existing clients remain compatible with optional expected-balance/hash fields; authoritative amount, payer, status and overpayment checks always apply.

Insurer account reporting, claim submission and settlement API routes now require **Ceo/Admin/Owner**. Reception direct requests return 403. The existing controls are mounted at **CEO → Insurance** (`/ceo/insurance`); their normal claim and receipt actions were exercised with a real CEO login. The CEO menu also links to grouped Billing. Explicit Owner routing to Billing and Insurance is supported, and existing administrative access is retained. The shared insurer component's source directory does not grant Reception access.

## Reconciliation examples

The initial disposable fixture has two patients with the same display name and 27 invoices. Grouping produces two patient rows, not 27 repeated patient rows:

| Scope | Agreed | Patient liability | Actual patient receipts | Patient remaining |
| --- | ---: | ---: | ---: | ---: |
| All matching fixture invoices | 2,650.00 | 1,450.00 | 310.00 | 1,140.00 |
| Saved company 1, 12 insured invoices | 1,200.00 | 240.00 | 240.00 | 0.00 |
| After browser collection of 25.50, all matching invoices | 2,650.00 | 1,450.00 | 335.50 | 1,114.50 |

The all-record agreed figure includes a waived invoice with original total/share 100. Its collectible liability and balance are zero. Company 1's patient share is settled while insurer planned liability is 960 and earned liability is 480; Reception cannot collect the insurer share. Changing current patient membership to company 2 does not relabel company 1's invoices.

A single 70 receipt allocated as 30 + 40 contributes 70 cash and one receipt identity. In Collection-date mode on 2026-11-06 with Cash selected, those two allocations select two invoices and contribute 70 period collections. The 240 earlier Visa receipts are not money collected in that period. The browser's later 25.50 cash receipt brings period patient collections to 95.50.

A separate normal package booking creates a saved 300 agreement with installments. Its reviewed 150 payment allocates 100 + 50, produces one receipt identity, retains the allocation evidence, and leaves 150 patient balance. Installment schedule values are not added as extra charges. HTTP tests also change the allocation between review and confirmation and verify rejection, refreshed review and idempotent retry.

For an earned insurer share of 80, CEO submission records an 80 claim; an actual 30 insurer receipt leaves 50 earned outstanding. It does not increase patient receipts. Retrying the same settlement does not add cash.

Exports use the same filtered pipeline and role permissions. Patient-summary and invoice-detail CSV formats include all matches, independent of page parameters, with filters, date basis, Cairo timezone, UTC export timestamp, currency and summary totals. Text is quoted and formula-like cells are neutralized. The company-filtered detail export contains all 12 invoices even with page size 1; its totals match the screen and expansion.

## Verification and screenshots

- Backend: **220 passed, 0 failed, 0 skipped**. Includes the 207 prior cases and 13 grouped-billing HTTP cases. Real password-authenticated Reception/CEO tests cover grouping, same names, multi-page scope, mixed/history/company changes, exports/formula escaping, allocations/receipt identity, partial/zero/waived/insurer collection, stale balances, concurrent collection, retries, permissions and Cairo normal/23-hour/25-hour boundaries.
- Angular: **383 passed in 53 files, 0 failed, 0 skipped**. Includes grouped report rendering, disabled collection with enabled details, deferred filter application, scope preservation, stale-request cancellation, retry, export parameters and Arabic/RTL. Existing payment recovery tests additionally retain the reviewed balance/allocation identity. No tests were disabled or assertions removed to obtain a pass.
- Production build: **PASS**, no Angular build warnings. Application and spec `tsc --noEmit`: **PASS**.
- Real browser: actual Angular application on 4200, actual controllers/Identity/services/EF through a fresh `BookingTestHost` on 7290, unique disposable SQLite. CDP changed API transport only; successful responses were not substituted. Currency editing used keyboard events. Patient collection, company filtering/URL state, invoice paging, export, CEO claims/receipts, package allocation/installments and patient-profile navigation were exercised. Runtime exceptions: **zero**.
- Responsive checks: **1440/820/390/360px**, Arabic RTL, English, light/dark. Patient and expanded invoice bounds stay inside the viewport; no horizontal page overflow. Mobile filter-sheet modal semantics and Escape were exercised. Screenshots were visually inspected.

Actual local captures:

- [Desktop summary](tmp/grouped-billing-browser/billing-desktop-light.png), [desktop invoice expansion](tmp/grouped-billing-browser/billing-desktop-expanded-light.png), [desktop dark](tmp/grouped-billing-browser/billing-1440-en-dark.png).
- [Tablet](tmp/grouped-billing-browser/billing-820-en-light.png), [mobile English cards](tmp/grouped-billing-browser/billing-cards-390-en-light.png), [mobile Arabic/dark cards](tmp/grouped-billing-browser/billing-cards-390-ar-dark.png), [360px Arabic/light cards](tmp/grouped-billing-browser/billing-cards-360-ar-light.png).
- [Arabic advanced filter sheet](tmp/grouped-billing-browser/advanced-filters-ar-mobile.png), [patient settled with insurer debt](tmp/grouped-billing-browser/patient-settled-insurer-outstanding.png).
- [Account allocation before confirmation](tmp/grouped-billing-browser/account-allocation-before-confirmation.png), [saved allocation evidence](tmp/grouped-billing-browser/saved-account-allocation-evidence.png), [CEO insurer operations](tmp/grouped-billing-browser/ceo-insurer-finance-entry.png).
- [Browser result record](tmp/grouped-billing-browser/results.json), [actual filtered CSV](tmp/grouped-billing-browser/filtered-invoices.csv).

Local logs: `tmp/grouped-billing-angular-tests.log`, `tmp/grouped-billing-build.log`, `tmp/grouped-billing-app-types.log`, `tmp/grouped-billing-spec-types.log`; backend `.tools/grouped-billing-full.log` and `.tools/grouped-billing-results/grouped-billing-full.trx`. Drivers, disposable databases/browser profiles and evidence remain ignored local artifacts, consistent with the existing release reports.

Reproducible commands:

```powershell
& 'C:\Program Files\dotnet\dotnet.exe' test PTCenter.Tests/PTCenter.Tests.csproj --artifacts-path .tools/grouped-billing-build --logger 'trx;LogFileName=grouped-billing-full.trx' --results-directory .tools/grouped-billing-results
npx ng test --watch=false
npx ng build
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p tsconfig.spec.json
```

## Source, preservation and limits

Frontend base: `Api_integrate`, `9d8933d98120c16b34f5521e0c27e13eb242a631`, plus this workspace's changes. Backend base: `Abanoub3vv`, `a8e19e64bd22daeba5bc0234cbf3fabf1b8aad7e`, plus this workspace's changes. Both working trees were initially clean; existing release/audit work was preserved.

No entity/snapshot/migration changes were required. This reuses saved invoices, course agreements, claims and receipt allocations. No migration was generated or applied; shared database data was not modified. All financial workflow writes used disposable SQLite. Provider-specific SQL Server concurrency/mutation acceptance, production-sized report/export load, physical-device keyboards and external insurer/bank integration are not certified by these checks. Existing `System.Security.Cryptography.Pkcs 9.0.4` NU1902/NU1903 restore warnings remain outside this billing scope.

The configured frontend API URL remains `https://localhost:7223/api`. A fresh unauthenticated request for the new `/api/Billing/patients` route returned **404** on the existing API process **24128**. Automatic approval review rejected the attempted stop/restart of that API with **“blocked by policy”**; the action was not executed. Restart/build the updated backend from its owning terminal before acceptance through the normal configuration. Browser verification through 7290 does not certify that older 7223 binary. The temporary billing verification host was stopped after evidence capture; the pre-existing Angular development server was retained.

Remaining business decisions: reconstruction/approval of unavailable legacy funding/company/delivery/clinician evidence; audited cancellation/refund and signed-financial/clinical amendment policies; and reconciliation policy for legacy inconsistent or overpaid records. No historical evidence, financial amendment or insurer-assessment waiver policy was invented. Future CEO dashboards can reuse the query/filter/metric contracts without redefining these accounting meanings.
