# Clinician absence and booking recovery

Implementation date: 2026-11-04. Frontend: `Api_integrate`, base `ec312d17`, plus the uncommitted changes in this workspace. Backend: `Physical-Therapy-Center`, branch `Abanoub3vv`, base `e980946`, plus its uncommitted changes. No push or deployment.

## Application changes

- Reception's existing `/receptionist/schedule` now embeds the shared `AbsenceRecovery` component. Its toolbar provides Record absence, a real unresolved count, refresh, and compact absence details/correction/withdrawal. Original appointments remain on the schedule with an actionable Needs attention badge.
- Native dialogs provide a compact desktop record form and a desktop recovery side panel. Mobile uses full-height forms with sticky actions and safe-area padding. English/Arabic, RTL, light/dark, first-two-name initials, focus return, separate loading/empty/error states, and failed-save retention are supported.
- Keep time and Change time use server-authoritative candidates. Initial assessments require Seniors; treatments allow Doctors and Seniors explicitly badged Covering treatment. Matching candidates precede separated exceptions; phone agreement starts unchecked and requires an explicit exception action and reason.
- Assigned Senior coverage reuses `/senior/session-notes/:appointmentId` and the existing Doctor session workspace. Coverage also appears on the Senior dashboard and existing absence coverage page, including active coverage carried over from an earlier clinic date. Notes, arrival/payment checks, clinical finalization and Reception departure retain their existing workflow.
- Existing patient-profile activity now includes replacement/rescheduling/contact entries, before/after clinician/time/room, and Phone consent with recorder/time/reason. Assessment appointment activity is included too.

## Server behavior

`AbsencesController` delegates to `BookingService.Absence.cs`; operations use the existing Reception permission set (`Receptionist`, `Ceo`, `Admin`, `Owner`). Doctor and Senior clinical workspace access still requires assignment to that appointment, except existing supervisory access.

Absences support full clinic-local days, custom intervals, optional multi-day spans, partial overlaps, recorded identity/time, corrections/withdrawals, and legacy date-only records. Cancelled, completed and started appointments are excluded; overlapping records produce one case per appointment. No appointment is automatically cancelled or reassigned.

Availability and confirmation check role/gender, saved hours, interval absences, patient occupancy, room activity/capacity and shared clinical commitments. Doctors retain two concurrent treatments in different rooms; Seniors default to **one concurrent clinical appointment**, combining assessments and covered treatment, because no explicit Senior treatment capacity setting exists. Original room is preferred, and existing appointment duration is retained.

Confirmation and contact saves use the existing serializable clinic mutation lock, stable operation keys, request fingerprints and appointment versions. Reassignment/rescheduling, optional consent and audit commit atomically. A stale or taken option leaves the original appointment intact. A saved phone exception applies only to that appointment/clinician and never bypasses other eligibility rules. Consent time means server-recorded confirmation time; an unknown actual call time is not invented.

Appointments retain their IDs, plan/session links, invoice/payment/insurance associations and other agreed plan appointments. Existing normal patient-profile scheduling also supports a saved Senior coverage assignment. Internal reassessment remains the existing separate free workflow; no absence creates a reassessment or charge.

## Migration

Applied `20261104195622_ClinicianAbsenceRecovery` using the previously authorized pinned-script process to `db56823.public.databaseasp.net` / `db56823`, server identity `S13`. The migration is additive; zero pending migrations and unchanged existing row counts and financial totals were verified immediately afterward. See the backend's `Database/ReviewedMigrations/20261104195622_ClinicianAbsenceRecovery.APPLIED.md` for the reviewed SQL hash and preservation evidence.

## Verification

- Full backend suite: **197 passed**, zero failed/skipped. Targeted absence and booking regression run after the last scheduling interval checks: **94 passed**, zero failed/skipped. Final absence HTTP run, including a direct blocked new-booking confirmation and financial rollback assertion: **16 passed**, zero failed/skipped.
- Focused Angular tests: **70 passed in 8 files**, including active Senior coverage across clinic dates. Production Angular build passed without warnings.
- Real authenticated browser integration against the backend's ASP.NET Identity/controllers/services on disposable SQLite exercised recording, partial-overlap impact, contact states, phone consent, a failed transport/save retry, Doctor and Senior assignments, actual Senior note/start/end actions, exactly-once completion, separate Reception checkout, rescheduling one appointment, and cash/insured invoice/payment identity preservation. This was real backend execution through a local HTTP bridge, with only the explicitly injected transport failure fabricated.
- Responsive browser matrix: 1440, 820, 390 and 360 pixels, each English/light and Arabic/dark; no horizontal page/dialog overflow or runtime exceptions. A 390×480 reduced viewport checks focus and reachable confirmation while entering the exception reason. This approximates a mobile keyboard; a physical mobile device keyboard remains unverified.
- Restarted intended API: authenticated Angular reads from `https://localhost:7223` returned 200 for absence list/affected endpoints; the schedule and record dialog loaded.

## Intended running API and SQL Server acceptance

The live acceptance run used **the actual Angular app on port 4200 and the restarted API on `https://localhost:7223`**, backed by the verified SQL Server target above. There was no HTTP bridge or API-response substitution for this run except one explicit pre-send 503 injection to test failed-save retention. New staff logged in through the real Identity password endpoint; no signed test tokens bypassed authentication.

Passed workflows:

- Reception recorded a full-day Senior absence and a partial Doctor absence through the UI. The impact list counted only the overlapping, unstarted bookings, excluded the synthetic completed assessments, and left the original appointments intact. New booking preview rejected the absent clinician.
- Initial assessment candidates were Seniors, and a Doctor confirmation was rejected. Declined and unreachable phone outcomes stayed open. An eligible different-gender Senior required explicit phone agreement and a reason; its saved audit identified the authenticated synthetic Receptionist and server confirmation time. The UI retained consent/selection after the injected failure and saved successfully on retry.
- A Doctor and a Senior received separate treatment replacements. Assigned schedules updated; the former Doctor and an unassigned Senior were denied access. Two simultaneous identical SQL confirmations returned 200 with one replacement audit.
- The assigned Senior opened the actual clinical route, was blocked before arrival, then started after Reception check-in, saved notes and ended treatment in the UI. Reload and repeated end confirmed exactly one completed session. Reception departure remained a separate action.
- Rescheduling changed one existing appointment; another agreed appointment remained identical. Two simultaneous distinct confirmations produced 200/409. Plan/session identities, financial fields and payments were unchanged by recovery. Correcting an absence recalculated open impact without undoing confirmed moves.
- Live screenshots cover the record forms, populated queue, consent, failed save, Senior clinical workspace, and Arabic/dark mobile layout. Browser runtime exception checks passed. Full capacity/patient/room/taken-slot, unauthorized, nonstandard-duration and insured-allocation combinations also passed the isolated authenticated HTTP tests; those additional combinations were not all repeated as SQL Server mutations.

Synthetic data is clearly prefixed `qa.abs1104.mw2m5kw2`: patients **19, 20, 21**, staff accounts with that prefix, and rooms **6, 7, 8**. Completed clinical/audit records were retained. Other synthetic appointments were cancelled, all five synthetic absences withdrawn, all six staff accounts had roles and working hours removed, and all three test rooms were deactivated. Fresh authenticated reads verified cleanup, **zero open cases**, and one completed Senior session. Eight synthetic invoices have **zero total, zero patient/insurer liability, and zero payments**; no cash receipt was invented. Real existing patients, staff schedules and room configuration were not modified.

The live synthetic bookings used November 5/6 schedule dates and the application's existing early-arrival behavior to exercise clinical completion on November 4. The server clock and existing appointments were not changed.

Actual running app screenshots:

- [Record full-day Senior absence](tmp/absence-recovery-browser/live-sql-record-senior-full-day.png)
- [Record partial Doctor absence with affected bookings](tmp/absence-recovery-browser/live-sql-record-doctor-partial.png)
- [Populated Needs attention queue](tmp/absence-recovery-browser/live-sql-needs-attention.png)
- [Phone exception confirmation](tmp/absence-recovery-browser/live-sql-exception-confirmation.png)
- [Failed save retains consent](tmp/absence-recovery-browser/live-sql-failed-save-retains-selection.png)
- [Senior's saved clinical notes](tmp/absence-recovery-browser/live-sql-senior-covered-treatment-notes.png)
- [Senior treatment finished; Reception departure still separate](tmp/absence-recovery-browser/live-sql-senior-covered-treatment-finished.png)
- [Arabic/dark mobile record form](tmp/absence-recovery-browser/live-sql-record-mobile-ar-dark.png)
- [True empty queue after cleanup](tmp/absence-recovery-browser/live-sql-empty-queue-after-cleanup.png)
- [Tablet Arabic/dark form, isolated authenticated backend](tmp/absence-recovery-browser/record-820-ar-dark.png)
- [Mobile consent, isolated authenticated backend](tmp/absence-recovery-browser/gender-exception-confirmation-mobile.png)

Evidence: `tmp/absence-recovery-browser/live-workflow.json`, `live-cleanup-verified.json`, `live-restarted-api.json`, and `live-sql-*.png`. Earlier cancelled synthetic attempts came from browser-driver timing/date-format corrections; they remain auditable rather than being deleted. There are no remaining implementation blockers. Physical-device keyboard behavior remains unverified as described above; Senior concurrent capacity defaults to one.

Ignored evidence lives in `tmp/absence-recovery-browser/`, including `result.json`, `live-restarted-api.json`, and screenshots. Test commands/build logs are in frontend `tmp/absence-*.log` and backend `.tools/absence-*.log`. No tokens or connection credentials are included in this report.
