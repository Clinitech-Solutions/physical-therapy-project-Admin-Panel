# Doctor responsive redesign — 1 November 2026

## Delivered

- Desktop uses a chronological schedule table and a separate active-treatment / up-next / review rail. Tablet uses readable cards and a two-column context section. Mobile uses grouped cards, Today/Completed filtering, and functional Today/Reviews/Account navigation. Account reuses the existing authenticated identity and logout; no account-management subsystem was added.
- Shared patient avatars use the first letters of the first and second names, including Arabic, single-word names and extra whitespace. Their colors are deterministic. No patient photos or sample patients were added to application code.
- The schedule supports selected Cairo clinic dates, previous/next, Today, Refresh, name/phone search and status filters. Groups use the same filtered records. Completed/cancelled records are not labelled upcoming. Active treatments remain based on the server's clinical state, including overdue treatments.
- The clinical page has compact identity/progress, distinct prescribed/booked/completed counts, a read-only plan, a two-by-two desktop notes grid, context/last-session panels and a treatment action bar. Mobile uses a slim progress strip, prescription/last-session disclosures, one-column notes and an accessible section selector. Complete prescription counts remain available in the plan disclosure.
- Textareas resize on mobile input, restored content and orientation changes, within a bounded height. Resizing preserves native focus, cursor and values. The existing autosave/version/finalization contracts are unchanged. Context refresh retains unsaved notes and exposes a concurrent saved/finalized version for reconciliation.
- Previous sessions use a newest-first accordion with recorded authors, planned times, known actual start/end/duration, and individual saved note fields. Missing actual times remain unknown. Finalized records remain read-only.
- Senior review uses the existing free internal workflow and APIs. Desktop has the form and real status history; tablet has a centered dialog; mobile has a bottom sheet. Native modal focus handling, Escape/close, restored trigger focus, retained failure text/retry intent and active-request duplicate prevention are preserved. A queued close event cannot erase a reopened sheet.
- The UI blocks a third start at two active treatments. Arrival, payment coverage, capacity, treatment completion and Reception departure remain backend-enforced. No finance controls, treatment-policy changes or changes to clinician working hours were introduced.
- Existing sidebar/topbar, Arabic/English, RTL and themes are retained. Ratios remain ordered in RTL. Date inputs fit at 360px. Plain buttons/status text have readable theme colors. New presentation CSS is imported only by the Doctor components; the original stylesheet used by Senior remains unchanged.

## Verification

| Check | Result / boundary |
| --- | --- |
| Relevant frontend tests | **34 passed, 6 files**: Doctor dashboard/notes, initials, textarea sizing, Senior review and clinical locale regressions. HTTP unit tests use Angular's testing controller; these are mocked HTTP tests, not SQL Server tests. |
| TypeScript | App and spec configurations pass. |
| Production build | Passes without warnings. Existing budgets were preserved. |
| Matching backend tests | **40 passed** clinical/Doctor/reassessment tests against existing commit `195a727`, using isolated relational SQLite and authenticated HTTP tests. No backend source changes were made for this redesign. |
| Browser clinical workflow | Actual Angular and matching ASP.NET TestServer, real Identity logins, unique temporary SQLite. Browser API interception forwards requests to that backend; business responses are not fabricated. |
| Browser assertions | Start; debounced draft save and reload recovery; context refresh without text loss; exact EGP 100 shortfall; eligible insured second patient starts despite insurer debt; third start disabled at capacity; failed review retains text and retries; Senior receives/completes the same-visit review; Doctor sees outcome; End finalizes notes/progress once; Reception departure is separate; financial hash is unchanged by the clinical/review/departure flow. A separate isolated subsequent booking supplies actual saved history for screenshots. |
| Responsive matrix | **36 combinations**: 1366×768, 1440×900, 1920×1080, 768×1024, 820×1180, 1024×768, 360×800, 390×844, 430×932, each in English/Arabic and light/dark. Schedule/session overflow assertions pass. Additional real-history and review-sheet screenshots cover mobile/tablet. Zero browser runtime exceptions in successful runs. The runner retried occasional blank browser navigations; no API failure was converted into an empty or successful result. |
| Keyboard/layout | Native sheet initial focus, Escape and focus return; autosave focus retention; orientation changes and reduced viewport simulating an on-screen keyboard. A failed schedule load does not show zero summaries, and retry recovers. |
| SQL Server | No SQL Server mutations, migration execution or authenticated live workflow verification for this visual task. |

The full unrelated frontend suite was not rerun. Earlier documented legacy failures are not represented as passing.

## Rendered evidence

Screenshots were inspected to correct mobile header wrapping, date clipping, RTL ratio ordering, dialog centering, dark-mode contrast and footer behavior.

- [Desktop schedule](tmp/doctor-redesign-preview/schedule-1366x768-en-light.png)
- [Desktop session](tmp/doctor-redesign-preview/session-1920x1080-en-light.png)
- [Tablet session](tmp/doctor-redesign-preview/session-820x1180-en-light.png)
- [Tablet review dialog](tmp/doctor-redesign-preview/tablet-review-en-light.png)
- [Mobile schedule](tmp/doctor-redesign-preview/schedule-360x800-en-light.png)
- [Mobile clinical notes](tmp/doctor-redesign-preview/mobile-session-notes-en-light.png)
- [Arabic dark mobile session](tmp/doctor-redesign-preview/session-390x844-ar-dark.png)
- [Arabic saved history](tmp/doctor-redesign-preview/history-390-ar-dark.png)

Ignored reproducible evidence: `tmp/doctor-redesign-browser.mjs`, `tmp/doctor-redesign-visual.mjs`, `tmp/doctor-redesign-preview/result.json`, `visual-result-0.json` through `visual-result-2.json`, screenshots and final test/build logs. Backend clinical-test output is `.tools/doctor-redesign-tests.log` in the sibling repository.

## Backend, database and remaining verification limits

The active backend checkout is `Abanoub3vv` at `1eca33f`; it does not contain the existing Doctor workspace implementation. It was preserved. Verification used a detached isolated worktree of the already-existing matching backend commit `195a727`, rather than importing unrelated backend changes into the active branch. Both configured hosted and local unauthenticated endpoint probes returned 401; that does not verify an authenticated clinical workflow on either running service.

No API contracts, backend source, database schema or migration files changed. No migration was necessary or applied. The configured frontend API URL was preserved. No synthetic records were created in a shared database. No push or deployment was performed.

An authenticated acceptance pass against the intended running/deployed backend remains a separate verification step, especially before rebuilding the older active backend branch. Physical iOS/Android virtual-keyboard behavior was not tested on hardware; reduced-viewport and keyboard/focus checks were performed in Chrome.
