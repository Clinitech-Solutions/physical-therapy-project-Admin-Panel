# Reception Billing and company/month insurance finance

Delivered **2026-11-06, Africa/Cairo** in both local repositories. No push or deployment. The reviewed additive migration described below was applied. Shared SQL Server business workflows were read-only; synthetic financial writes used disposable SQLite.

## Reception experience

The page is now titled **Patient billing**, with a patient-focused summary, search and funding selector. It keeps one row per stable patient ID, patient liability, actual allocated patient receipts and a prominent remaining patient balance. Operational funding/company badges, patient profile navigation, filtered/global counts and independent patient/invoice pagination remain available.

Expanded invoices use a compact aligned desktop table: reference/date, collectible patient liability, actual patient receipts, remaining patient balance and separate View/Collect actions. Long saved funding, agreement, plan, pricing, delivery and actual treating clinician context is available in View details. Settled and waived records retain View; their patient collection action stays disabled. Insurer debt never enables a patient collection. Zero amounts use normal typography.

Pending Installments still uses saved booking/course agreements and the existing reviewed allocation workflow. Installment schedule amounts are not additional invoices or cash. The original patient collection guards, balance preconditions, stable operation identity and outcome recovery remain in place.

Search and funding remain visible; the remaining supported controls open through **Filters**, with an active count. Applied chips stay visible when closed. Apply commits the draft together; Clear resets Reception to unfiltered Invoice-date mode. URL state survives reload, paging and expansion. Superseded reads are cancelled; independent failures retain retry actions. Mobile filters use a native modal sheet with explicit Tab containment, Escape handling and focus restoration.

## CEO experience

**CEO ? Insurance** (`/ceo/insurance`) now opens company accounts. Existing company administration is retained at `/ceo/insurance/companies`. The composition is company ? Cairo service month ? patient ? delivered session/invoice, with initials avatars, aligned balances and distinct insurer actions.

The overview shows earned insurer liability, actual insurer receipts and remaining earned balance. Company accounts expose month selection and previous/next navigation, including older unpaid months. Summary totals cover all matching records before patient pagination. Expanded patient rows show compact service date/reference, insurer share, actual receipts, remaining balance and each individual claim's state/reference/ID. View details additionally exposes its submission batch and recorded submission time, saved financial context and patient copay.

The primary account action is **Record cheque**; Monthly claims and Monthly statement are secondary actions. Search, company and month remain prominent. Filters include defined payment/claim state, claim reference, receipt-history date range and supported invoice/service filters. Receipt-date filters are explicitly labelled as history-only; they do not reinterpret service-month balances. Applied filters are retained in the URL and chips, and used by expansion, claim selection, cheque candidates and exports. Cheque review resolves the filtered default candidates to explicit claim IDs, so an unselected filtered-out account is not added silently.

The two screens reuse `BillingQueryService` and the existing course finance rules. Common EGP/Cairo presentation lives in `ReceptionistLocale`, and safe CSV handling is shared through `FinancialCsv`. Each screen has its own composition and actions. New insurer reporting and collection are not mounted in Reception.

## Accounting and record identity

| Concept | Definition |
| --- | --- |
| Historical company | Saved course agreement company, otherwise saved claim evidence. Current patient insurance membership is never substituted. Unknown identity is shown explicitly. |
| Service month | Authoritative delivery timestamp in the half-open interval from Cairo month start to the next Cairo month start, converted to UTC. Existing delivery fallback for a legacy Completed appointment with actual checkout is retained. Future planned services are excluded from earned monthly balances. |
| Earned insurer liability | Eligible delivered invoice insurer shares counted once; waived/cancelled obligations are excluded. |
| Submitted claim amount | Actual saved individual claims for matching delivered invoices. A monthly submission groups their identity and reference without creating another set of charges. Existing claims remain separate. |
| Actual insurer receipts | Actual Paid insurer Payment allocations. Patient payments are excluded. A claim or approval is not a receipt. |
| Remaining earned balance | Sum per invoice of `max(0, earned insurer share ? actual insurer receipts)`. Insurer balances remain independent of patient balances. |
| Receipt count | Distinct cheque header identity, even when its Payment allocations span patients/invoices/months. Legacy actual receipts remain visible as legacy records. The header amount is not summed again as another cash transaction. |
| Receipt date | Staff-confirmed actual Cairo day received; defaults to today's clinic date, with future receipt dates rejected. Actual allocations use that day's UTC boundary. Authenticated actor and server recording timestamp are retained separately. |
| Multi-month receipt history | Full receipt amount and amount allocated to the selected scope are shown separately. Opening a cheque shows its complete immutable allocation evidence. |

A December receipt can settle October services: October earned liability stays in October and its remaining balance decreases; Collection-date reporting recognizes the actual December receipt date. No future/planned invoice face amount is labelled collected cash. Unavailable historical company/delivery evidence is displayed and excluded from invented earned monthly assignments.

Monthly submission batches preserve each original claim ID/reference and add batch, actor, server timestamp and stable retry identity. They use the existing delivered-service/approval eligibility checks and claim creation service under the clinic mutation lock.

## Cheque collection and recovery

Cheque entry captures company, explicit service months, optional specified claim selection, cheque number, bank, actual amount, received date, optional cheque date/notes, authenticated actor and server timestamp. Default candidates are the oldest eligible submitted outstanding claims within the selected matching company/month. Additional months require explicit selection. A month without submitted eligible claims directs staff to Monthly claims.

Review shows the exact claim/invoice/patient allocations, their original references, amount received and selected balance before/after. Confirmation explains that **receiving the cheque records actual insurer collection immediately**, as requested. A cheque date is descriptive; no later bank-clearing step is invented.

The existing insurer settlement allocator writes Paid insurer Payment rows. One new cheque header and all allocations commit atomically inside a serializable transaction with the existing clinic-wide mutation lock. A reviewed normalized balance/scope hash is rechecked inside that transaction. Overpayment reports the eligible balance and excess; changed eligibility/balances require fresh review. Positive amounts and currency precision are authoritative backend checks.

Stable operation keys and request hashes prevent double collection and reject changed intent. An uncertain frontend outcome retains the complete original request, reviewed hash and key in the existing durable financial-intent store, locks competing actions and exposes reconciliation. Reconciliation waits on the same mutation lock. A confirmed missing operation can retry only its original intent/key; the page does not generate a replacement identity silently. Successful responses are validated before clearing recovery state.

Normalized company/bank/cheque-number identity uses Unicode compatibility normalization, case normalization and collapsed whitespace, protected by a unique index. A possible duplicate returns the existing receipt ID and an Open existing receipt action. New collections through the earlier non-cheque settlement endpoint are blocked; exact historical committed operations can still be replayed for recovery. Saved pre-cheque operations retain a separate recovery entry point.

Saved cheque headers and allocation snapshots are read-only through these APIs. Existing invoice deletion/status guards preserve payment records. No receipt deletion, reversal, bounced-cheque adjustment or replacement policy was invented.

## Permissions and export

Company/month accounts, claim submission, cheque preview/recording, reconciliation, receipt history and statements require **Ceo/Admin/Owner** at the API. Reception can view operational invoice/payer context and collect the eligible patient share through existing methods. Actual password-authenticated Reception calls to the insurer routes return **403**. Actual CEO password login exercised claims and cheque collection; actual existing Admin membership also passed SQL read smoke. Explicit Owner routing and existing administrative guard behavior are retained.

CSV and print statements include company, service month, generated time, EGP, Cairo timezone, applied filters, reconciled summary and all matching patient/session detail independently of page parameters. CSV uses shared quoting and spreadsheet formula neutralization. Printing builds a separate document with text nodes, rather than inserting financial/customer text as HTML. The actual Print action was exercised and its complete five-row output captured. Reviewable mutation selections are bounded to 1,000 services; CSV/print data are not restricted to a visible page or that selection bound.

## Reconciliation examples

The disposable browser fixture has saved AXA October services for two patients, including one whose current insurer was changed to Historical Bupa. Saved AXA identity remains authoritative. October has **5 delivered invoices ? EGP 80 insurer share = EGP 400 earned**. A future planned service is excluded; separate September/November services and Bupa/unknown-company services remain separate.

| Browser event / scope | Earned insurer liability | Actual insurer receipts | Remaining insurer balance | Receipts |
| --- | ---: | ---: | ---: | ---: |
| AXA / October before collection | 400.00 | 0.00 | 400.00 | 0 |
| AXA / October after one partial cheque | 400.00 | 100.00 | 300.00 | 1 |
| Explicitly selected two claims at review | 160.00 | 100.00 allocation | 60.00 | one shared cheque |

The cheque allocates **80 + 20 across two patients**. Its committed successful response was deliberately lost at transport level. Reconciliation using the original key recovered the same receipt and both saved allocations; no extra cash was added. A case/whitespace variant of the same bank/cheque identity opened that existing receipt.

Separately, Reception collected **EGP 25.50** against an open patient invoice: fixture patient receipts changed **200.00 ? 225.50**, and patient remaining **100.00 ? 74.50**. The insurer receipt did not alter these patient figures. Settled and waived invoice details stayed available.

Authenticated HTTP coverage additionally records a **5 December** cheque against October services using an explicitly injected **15 December TimeProvider** in the disposable test application. The OS clock, production clock and stored service timestamps are not changed. October's account shows the allocation, October receipt-history dates exclude it, December history/Collection-date reporting include it, and Reception's December patient collection total remains zero. An explicit September/October cheque of 90 allocates 80 + 10, has one receipt identity, and shows full receipt 90 versus October allocation 10.

## Verification and actual captures

| Check | Result |
| --- | --- |
| Full backend suite | **230 passed, 0 failed, 0 skipped**; all 220 previous cases plus 10 company/month/cheque HTTP cases. Existing insurer-route assertions now require the cheque workflow while retaining actual partial receipt and payer-separation checks. |
| Full Angular suite | **393 passed in 54 files, 0 failed, 0 skipped**; all 383 previous cases plus 10 finance rendering/filter/cancellation/recovery cases. No tests disabled or assertions removed to obtain a pass. |
| Production build | **PASS**, no Angular build warnings. Both application/spec `tsc --noEmit` checks pass. |
| Real browser | Actual Angular on **4200** and current-source ASP.NET controllers/Identity/services/EF through BookingTestHost on **7290**, unique disposable SQLite. CDP forwards API transport only; no successful business response was fabricated. Real password logins for Reception and CEO. |
| Browser financial flow | Monthly submission, specified claim selection, exact partial cheque allocation, deliberately lost response after actual commit, original-key reconciliation, duplicate resolution, history, complete monthly statement/print, patient collection and disabled settled/waived collection. |
| Runtime/responsive | **Zero runtime exceptions**. Desktop 1440, tablet 820, mobile 390/360; English/Arabic RTL and light/dark. Patient/session rows stay inside the viewport; no horizontal page overflow. Final native sheets, Tab containment, Escape and restored trigger focus pass. |
| Current-source SQL read | Direct Kestrel **https://localhost:7443**, verified SQL Server, existing Admin password login. Company overview/month/history and Reception invoice/detail reads succeed. CDP changed only destination port; business writes blocked. |

Actual application screenshots, visually inspected:

- [Reception compact desktop invoice table](tmp/insurance-month-browser/reception-compact-invoices-desktop.png), [Reception final desktop](tmp/insurance-month-browser/final-reception-cards-1440-en-light.png), [Reception Arabic/dark mobile](tmp/insurance-month-browser/final-reception-cards-390-ar-dark.png), [360px Arabic/light](tmp/insurance-month-browser/final-reception-cards-360-ar-light.png).
- [Company overview](tmp/insurance-month-browser/ceo-companies-desktop-light.png), [October desktop patients/sessions](tmp/insurance-month-browser/final-ceo-patient-cards-1440-en-light.png), [tablet dark](tmp/insurance-month-browser/final-ceo-patient-cards-820-en-dark.png), [Arabic/dark mobile patient/session cards](tmp/insurance-month-browser/final-ceo-patient-cards-390-ar-dark.png), [360px Arabic/light](tmp/insurance-month-browser/final-ceo-patient-cards-360-ar-light.png).
- [Reviewed cheque allocation](tmp/insurance-month-browser/cheque-reviewed-desktop.png), [saved receipt and allocations](tmp/insurance-month-browser/cheque-saved-allocation-desktop.png), [final Arabic mobile cheque sheet](tmp/insurance-month-browser/final-cheque-entry-390-ar-dark.png), [monthly statement](tmp/insurance-month-browser/monthly-statement-desktop.png), [waived invoice details](tmp/insurance-month-browser/waived-invoice-details-remain-accessible.png).
- [Complete browser flow result](tmp/insurance-month-browser/results.json), [final layout/focus/print result](tmp/insurance-month-browser/final-ui-results.json), [actual statement CSV](tmp/insurance-month-browser/axa-october-statement.csv), [actual print document](tmp/insurance-month-browser/monthly-print-statement.html), [direct Kestrel/SQL result](tmp/insurance-month-browser/current-source-sql-read.json).

Logs: frontend `tmp/insurance-month-{angular-tests,build,app-types,spec-types}.log`; backend `.tools/insurance-month-full.log` and `.tools/insurance-month-results/insurance-month-full.trx`. Browser profiles, drivers, disposable databases and generated evidence remain ignored local artifacts, consistent with prior delivery reports. Failed driver attempts corrected selection order, timing, native Escape handling and currency whitespace; the product rendering/focus/CSS issues they exposed were fixed and final checks pass.

Reproducible commands:

```powershell
# Backend repository
& 'C:\Program Files\dotnet\dotnet.exe' test PTCenter.Tests/PTCenter.Tests.csproj --artifacts-path .tools/insurance-month-final --logger 'trx;LogFileName=insurance-month-full.trx' --results-directory .tools/insurance-month-results
# Frontend repository
npx ng test --watch=false
npx ng build
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p tsconfig.spec.json
```

## Applied migration and preservation

Applied **`20261106160811_InsuranceChequeReceipts`** through the established reviewed, pinned SQL process to **`db56823.public.databaseasp.net / db56823`**, after verifying connected server identity **S13**. It adds two initially empty identity/audit tables, four nullable Payment allocation evidence fields and one nullable claim batch link, with unique operation/cheque/allocation indexes and restrictive foreign keys. No business backfill, charge or receipt insertion ran on the shared database.

SQL SHA256: **`DF447C8181F633E11448C65A1DBAC450F343976CD191DBC2B974F035895F3D7B`**. Model/snapshot and migration chain match; zero pending migrations. All **19** checked original business/Identity table counts and original-column SHA256 row fingerprints are identical before/after. Existing invoice totals remain **EGP 15,600 face / 7,600 patient / 8,000 insurer / 4,600 paid**; actual Payments remain **EGP 4,600**. Both new tables were verified empty, current-model reads succeeded, and all five nullable fields and four unique identity/allocation indexes were verified.

See [applied migration and preservation record](../Physical-Therapy-Center/Database/ReviewedMigrations/20261106160811_InsuranceChequeReceipts.APPLIED.md) and [reviewed SQL](../Physical-Therapy-Center/Database/ReviewedMigrations/20261106160811_InsuranceChequeReceipts.sql).

## Source and activation identity

- Frontend: **Api_integrate**, base **`afe032022585fa0b3c7148abbdf23927db51d2f8`**, plus these workspace changes.
- Backend: **Abanoub3vv**, base **`d8634c83e0a0ea2a368145999725995f93025c2c`**, plus these workspace changes.
- Both working trees were initially clean. Prior release, grouped billing and clinical work was preserved.
- Verified current-source API DLL SHA256: **`4D511C9C761F184C7932BC93D2045326EAA4A789E965A9658869A6C48E1DB401`**; Infrastructure DLL: **`BF1546AD397C4F106E8E21F2396118A2CB0A372AA8528BBCA57D9F2886E7904A`**, from `.tools/insurance-month-final` used for final tests/browser and Kestrel reads.

**Normal local activation remains blocked.** The frontend configuration remains `https://localhost:7223/api`. Its pre-existing `PTCenter.Api` process **2256** returned **404** for `/api/Finance/insurance/companies`. The explicitly authorized `Stop-Process -Id 2256 -ErrorAction Stop` attempt failed with Windows **?Access is denied.?** No process was stopped and no configured URL was changed. This task's blocker is Windows process access, rather than the earlier delivery's automatic approval-policy rejection. Verification on 7290/7443 does not certify the old 7223 binary.

From the API's owning elevated terminal, verify the still-current listener PID, stop that old process and run the updated source:

```powershell
Set-Location 'E:\TPC\admin panel\Physical-Therapy-Center'
# Verify the listener before stopping it; PID 2256 was observed during this delivery.
Get-NetTCPConnection -LocalPort 7223 -State Listen | Select-Object OwningProcess
Stop-Process -Id 2256
& 'C:\Program Files\dotnet\dotnet.exe' run --project PTCenter.Api/PTCenter.Api.csproj --launch-profile https
```

The temporary verification hosts on 7290/7443 were stopped after evidence capture. The existing Angular development server on 4200 and old API on 7223 were retained.

## Remaining decisions and limits

No approved auditable cheque reversal, bounced/replaced-cheque correction or signed financial amendment policy exists in the inspected workflow. Define authority, reason, immutable history and reallocation/accounting effects before adding one. Saved receipts are not silently edited or deleted. Legacy inconsistent/overpaid records and unavailable company/delivery evidence still require clinic reconciliation policy; no historical values were reconstructed.

All synthetic financial mutations used relational SQLite. Provider-specific SQL Server financial concurrency/mutation acceptance, production-sized unbounded aggregation/export/print load, actual physical-device keyboards, native printer hardware and external bank/insurer integration are not certified. The existing backend `System.Security.Cryptography.Pkcs 9.0.4` NU1902/NU1903 restore warnings remain outside this scope. The explicitly blocked normal 7223 activation remains an operational acceptance step.
