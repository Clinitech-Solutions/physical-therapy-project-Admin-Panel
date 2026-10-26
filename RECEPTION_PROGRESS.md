# MediQova Reception progress

Updated: 2026-10-26 (Africa/Cairo).

## Phase status

| Phase | Status | Next action |
| --- | --- | --- |
| 1. Audit integration and fix Add Patient | Independent implementation and local checks finished; runtime verification pending. **Not complete.** | Verify cash and insurance registration, reload, booking selection and document recovery using an approved test API and Receptionist account. Resolve the contract questions below. |
| 2. Clinicians and rooms | Not started | Audit room contracts and an authorized clinician lookup after Phase 1 verification. |
| 3. Bookings and daily schedule | Not started | Verify appointment, assessment, treatment plan/session and invoice behavior. |
| 4. Billing, insurance and patient profile | Not started | Verify payment, insurance, document and patient history contracts. |
| 5. Dashboard and final validation | Not started | Validate statistics, two-session consistency, languages and end-to-end workflows. |

Only Phase 1 was authorized for this implementation. No push, deployment, live patient creation or financial transaction was performed. Login, interceptors and guards were preserved.

## Phase 1 audit

Read the repository README, existing registration implementations, models, services, templates, locale support and test configuration before editing. No applicable repository AGENTS.md was present.

Downloaded the current [OpenAPI specification](https://clinitech-solutions65.runasp.net/openapi/v1.json) directly over HTTPS on 2026-10-26. The browser fetch failed, but PowerShell Invoke-RestMethod succeeded. The supplied [backend reference](https://github.com/MinaRomany78/Physical-Therapy-Center) returned repository not found; its implementation and enum definitions could not be inspected.

### Original registration paths

- **Patients:** `patients.html` bound most fields to `newPatient`, but insurance company used `formControlName="insuranceCompanyId"` on a separate, unused reactive form. `createProfile()` submitted `newPatient` through `PatientService.addPatient()`, then optionally uploaded documents. Creation response IDs fell back to `Date.now()`. There was no submission lock. Retrying after upload failure could create a second patient.
- **Bookings:** `openQuickAddModal()` / `saveQuickPatient()` existed, but no dialog or trigger was present in the template. The handler submitted a fabricated `1995-01-01` birth date and document-checklist flags, derived a username from the name, and also fell back to a timestamp ID. Selection ran before the patient cache had the created record.
- **Shared mapping:** saved birth date, emergency contact and actual insurance details were discarded. Insurance status, last visit and other UI properties used defaults. The update payload reused creation defaults, risking replacement of saved data.

### Confirmed contracts

- `POST /api/Patients/Add`: JSON `CreatePatientRequest`, direct `PatientResponse` on HTTP 200.
- Required create fields: `userName` (3-50 characters), `fullName` (2-150), integer `gender`, date-time `birthDate`, `phoneNumber` (maximum 20). The UI also requires a nonblank phone number, as already intended by the registration workflow.
- Optional create fields: string/null `paymentType`, string/null `emergencyContact` (maximum 20), nullable numeric company ID and nullable `insuranceDetails`.
- `email` is absent from CreatePatientRequest. A separate Arabic name, address, occupation and document checklist flags are absent from both patient write contracts. Registration now collects one full name in either language and only supported fields. Unsupported edit controls are disabled so they do not imply persistence.
- `PatientResponse` returns the actual patient ID, birth date, phone, payment type, emergency contact, insurer ID/name and nested insurance details. Patient ID and company ID are int32 identifiers, including documented numeric-string serialization. Clinician ID conversions were not changed in this phase.
- `GET /api/Patients/GetAll`: paginated `items`, `PageNumber` and `PageSize` query parameters. All documented pages are loaded before replacing the cache, so selection is not restricted to the first page.
- `PUT /api/Patients/Update/{id}` has a separate update DTO. Absent values must remain absent instead of becoming create defaults.
- `GET /api/InsuranceCompanies/GetAll`: direct array. Documented numeric-string IDs are normalized for both selectors.
- `POST /api/InsuranceDocuments/Add`: `PatientId` and `Files`; no response DTO. Its documented content type is `application/x-www-form-urlencoded` despite `IFormFile` fields. Existing multipart FormData behavior is retained pending runtime confirmation; the contract is insufficient to claim upload interoperability.

## Phase 1 implemented behavior

- Shared registration fields and draft factory for both entry points. Quick registration is now reachable from Bookings.
- Explicit username and real birth date collection; no generated username, invented birth date, synthetic patient ID or mock success fallback.
- Shared payload validation, trimming, ISO date-time formatting and insurance company binding. Unknown optional insurance numbers remain null; actual zero values survive mapping.
- Typed direct response mapping. Returned birth date, emergency contact, insurer and nested details survive normalization and subsequent list reads. The shared profile displays the saved birth date.
- Newly created patients enter the shared server-data cache before selection. Bookings selects the normalized returned ID immediately; a subsequent refresh is separate from creation success.
- Submission guards in both screens and the shared service. Buttons/fields are disabled during submission. A network failure, HTTP 408/5xx, successful-response parsing failure or unrecognized success response is treated as an unknown creation outcome. It is not automatically retried; further creation in that app instance is blocked while staff reconcile the patient list. Reloading does not automatically resubmit.
- Server ProblemDetails validation errors appear with their fields; ordinary confirmed rejections allow correction. Refresh failures produce a separate warning and preserve the cached created record.
- After creation, failed document upload retains the actual patient and files while the Patients component remains mounted, including closing/reopening its dialog. Save cannot create another patient in this recovery state. Retry sends only the upload; staff can finish without documents. Unknown upload outcomes require checking documents before a manual retry. Files are cleared for the next registration. Navigation/reload does not restore browser File objects; later document management is Phase 4 work.
- Patient updates no longer supply blank/default username or birth date, default emergency contact or default approval/cost/session data in place of saved fields.
- English/Arabic translation keys and existing RTL support preserved. No business records were added to browser storage.

### Enum handling confirmed by the user

- Keep the existing Gender mapping unchanged: Male -> 0, Female -> 1. OpenAPI declares an integer without enum labels; no replacement mapping was introduced.
- InsuranceStatus numeric definitions remain unavailable. Valid returned numeric status is preserved as `apiStatus` and round-tripped on updates. Its label displays as Unknown until its meaning is verified. No numeric approval mapping is guessed.
- A new patient's optional status is sent as documented `null`; it is never silently Approved or Pending. If runtime backend validation requires an explicit status, only that insurance operation remains pending until the enum definition is provided.
- Editing/assigning an explicit insurance approval status remains unavailable. Existing booking gates require known approval; insurance booking cannot be verified/enabled from an unidentified status integer. Required missing information: the authoritative InsuranceStatus member names and their numeric values, including null semantics.

## Main files

- `src/app/core/models/patient-api.model.ts`: current patient wire contracts.
- `src/app/core/models/patient.model.ts`: saved birth date/emergency contact and preserved raw insurance status.
- `src/app/core/services/patient-registration.ts`: shared draft, validation, payload and error handling.
- `src/app/core/services/patient.service.ts`: direct response normalization, cache, pagination, submission guard and update mapping.
- `src/app/core/services/insurance.service.ts`: documented company array and numeric-ID normalization.
- `src/app/shared/components/patient-registration-fields/`: common bilingual form fields.
- `src/app/features/receptionist/patients/patients.{ts,html}`: submission and document recovery.
- `src/app/features/receptionist/bookings/bookings.{ts,html}`: reachable quick registration and immediate selection.
- `src/app/shared/components/patient-profile/patient-profile.component.html`: saved birth date display.
- `public/assets/i18n/{en,ar}.json`: registration labels, errors and recovery actions.
- `src/app/core/services/patient-registration.spec.ts`: focused HTTP/component regression tests.
- `src/app/features/receptionist/bookings/bookings.spec.ts`: explicit providers for the now-required registration services; existing clinic-state test assumptions otherwise preserved.

## Local verification

| Check | Result |
| --- | --- |
| `npm run build` (production default) | Passed. Existing CEO optional-chain diagnostics and Schedule/Bookings CSS warning budgets remain. |
| `npx tsc --noEmit -p tsconfig.app.json` | Passed. |
| `npx tsc --noEmit -p tsconfig.spec.json` | Passed. |
| `npm test -- --watch=false --include=src/app/core/services/patient-registration.spec.ts` | **27 passed.** HTTP is intercepted locally; these are not live API tests. |
| `npm test -- --watch=false` | **106 passed, 40 failed** across 32 files (15 passing, 17 failing). The initial baseline was 79 passed, 40 failed across 31 files. The same failure count remains after adding 27 passing registration tests. |
| `git diff --check` | Passed. |

Focused coverage: insurance selector writes to the submitted draft; company string-ID normalization; required fields/lengths; invalid dates; direct response and real IDs; zero-valued insurance fields; numeric status preservation; duplicate clicks/shared overlap; unknown response/network outcome; server validation errors; pagination/reload mapping; update field preservation; quick registration selection before refresh; refresh failure following successful persistence; document-only retries and dialog recovery.

Existing full-suite failures concern empty sample-data expectations, missing TranslateService/ActivatedRoute/MessageService test providers, missing matchMedia, and the fakeAsync/zone-testing setup. They were not hidden or reported as passing.

## Required runtime verification and blockers

No approved non-production API URL or Receptionist test account was supplied. Endpoint documentation does not verify Receptionist authorization. No mutation requests were made to the supplied live API.

1. Verify Receptionist access to patient Add/GetAll/GetById/Update, insurance companies and document upload on an approved environment.
2. Create a cash patient with actual username/name/phone/birth date, reload, inspect the returned record and select it in Bookings. Repeat with insurance company/member/employer/copay/session data; check the exact backend response and persisted null status behavior.
3. Verify real server validation and username constraints beyond those documented, plus date-time acceptance without a date shift.
4. Confirm InsuranceStatus definitions and null semantics. Verify round-trip status preservation before allowing explicit status changes or claiming insurance booking works.
5. Confirm document upload media type, field binding and partial-upload behavior; induce an upload rejection and verify only documents are retried for the saved patient ID. Reconcile uncertain outcomes before retrying.
6. Verify refresh/direct navigation, browser duplicate clicks and timeout handling against real persistence. Local tests confirm client behavior only.
7. Review the rendered registration dialogs and shared profile in Arabic, English and RTL on a browser. Angular templates compile and the shared form has a DOM binding test, but interactive visual/browser verification is pending.

**Stopping point:** Phase 1 implementation and local checks are finished; Phase 1 stays open for the runtime checks above. The next action is approved-environment verification and resolution of the exact enum/upload questions. Phases 2-5 were not started.
