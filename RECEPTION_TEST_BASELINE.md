# Reception test baseline and current result

Baseline commit: `d1b0860592cbbe138811a8f98c4b109e280e6408` (before Phases 2-5).

An isolated checkout reproduced **106 passed / 40 failed** out of 146 tests. The suite also has a pre-existing fakeAsync/zone-testing initialization error. No production code or test globals were altered in that checkout.

Current result: **133 passed / 32 failed** out of 165 tests. **32 unchanged baseline assertion failures, 8 obsolete Bookings cases migrated, 0 newly failing assertions.**

The eight Bookings cases expected simulated assessment gates, mock clinician/room assignments and local insurance rules. They were replaced with backend workflow tests and HTTP integration coverage. They are classified as migrated, not reported as fixes to their original assertions. Other changed suites use explicit DTOs, persisted IDs and shared workflows; no tests were skipped to hide failures.

Legacy ClinicStateService tests explicitly seed their own room fixtures. Production code does not load those fixtures or clinic_rooms browser storage. The existing 17 failures in that legacy business-rule suite remain unchanged.

## Original 40 assertion failures

1. **Unchanged baseline failure** ? `app/app.spec.ts`
   - App should create the app
2. **Unchanged baseline failure** ? `app/app.spec.ts`
   - App should render title
3. **Unchanged baseline failure** ? `app/core/services/state/clinic-state.spec.ts`
   - ClinicStateService Business Rules & Date Filtering Unit Tests Business Rule: Insurance Workflow Gate should allow an existing/old patient to book a standard Session
4. **Unchanged baseline failure** ? `app/core/services/state/clinic-state.spec.ts`
   - ClinicStateService Business Rules & Date Filtering Unit Tests Business Rule: Insurance Workflow Gate should allow booking for non-insurance patients (Cash, Online)
5. **Unchanged baseline failure** ? `app/core/services/state/clinic-state.spec.ts`
   - ClinicStateService Business Rules & Date Filtering Unit Tests Business Rule: Insurance Workflow Gate should allow finding slot and booking for Approved Insurance patient (Patient 2 - Mona Zaki)
6. **Unchanged baseline failure** ? `app/core/services/state/clinic-state.spec.ts`
   - ClinicStateService Business Rules & Date Filtering Unit Tests Business Rule: Insurance Workflow Gate should strictly throw error when calling addSession or bookSession for pending Insurance patient
7. **Unchanged baseline failure** ? `app/core/services/state/clinic-state.spec.ts`
   - ClinicStateService Business Rules & Date Filtering Unit Tests Business Rule: Insurance Workflow Gate should strictly throw error when finding slot for Insurance patient whose approval is pending (Patient 7)
8. **Unchanged baseline failure** ? `app/core/services/state/clinic-state.spec.ts`
   - ClinicStateService Business Rules & Date Filtering Unit Tests Business Rule: Strict Gender Matching & Slot Finding should correctly return patient gender
9. **Unchanged baseline failure** ? `app/core/services/state/clinic-state.spec.ts`
   - ClinicStateService Business Rules & Date Filtering Unit Tests Business Rule: Strict Gender Matching & Slot Finding should find nearest slot matching Female patient (Sara Mahmoud) with Female doctor and currentLoad < 2
10. **Unchanged baseline failure** ? `app/core/services/state/clinic-state.spec.ts`
   - ClinicStateService Business Rules & Date Filtering Unit Tests Business Rule: Strict Gender Matching & Slot Finding should find nearest slot matching Male patient (Youssef Ali) with Male doctor and currentLoad < 2
11. **Unchanged baseline failure** ? `app/core/services/state/clinic-state.spec.ts`
   - ClinicStateService Business Rules & Date Filtering Unit Tests Business Rule: isPatientNew (Assessment First) should identify patient 1 (Ahmed Fathy) as NOT new because they have completed assessment in history
12. **Unchanged baseline failure** ? `app/core/services/state/clinic-state.spec.ts`
   - ClinicStateService Business Rules & Date Filtering Unit Tests Business Rule: isPatientNew (Assessment First) should identify patient 2 (Mona Zaki) as NOT new because they have completed assessment in history
13. **Unchanged baseline failure** ? `app/core/services/state/clinic-state.spec.ts`
   - ClinicStateService Business Rules & Date Filtering Unit Tests Gender Matching & Slot Finding Edge Cases should throw clear error if all doctors of the matching gender have currentLoad >= 2
14. **Unchanged baseline failure** ? `app/core/services/state/clinic-state.spec.ts`
   - ClinicStateService Business Rules & Date Filtering Unit Tests Gender Matching & Slot Finding Edge Cases should throw clear error if candidateDoctors has no doctors of the matching gender
15. **Unchanged baseline failure** ? `app/core/services/state/clinic-state.spec.ts`
   - ClinicStateService Business Rules & Date Filtering Unit Tests Historical Date Filtering should have historical sessions in global sessions
16. **Unchanged baseline failure** ? `app/core/services/state/clinic-state.spec.ts`
   - ClinicStateService Business Rules & Date Filtering Unit Tests Treatment Plan & Check-In/Out Timestamps should calculate getPatientProgressBadge correctly
17. **Unchanged baseline failure** ? `app/core/services/state/clinic-state.spec.ts`
   - ClinicStateService Business Rules & Date Filtering Unit Tests Treatment Plan & Check-In/Out Timestamps should calculate getSessionBadge correctly from session object
18. **Unchanged baseline failure** ? `app/core/services/state/clinic-state.spec.ts`
   - ClinicStateService Business Rules & Date Filtering Unit Tests Treatment Plan & Check-In/Out Timestamps should stamp checkInTime when checking in a patient
19. **Unchanged baseline failure** ? `app/core/services/state/clinic-state.spec.ts`
   - ClinicStateService Business Rules & Date Filtering Unit Tests Treatment Plan & Check-In/Out Timestamps should stamp checkOutTime when checking out a patient
20. **Unchanged baseline failure** ? `app/core/services/theme.spec.ts`
   - ThemeService should be created
21. **Unchanged baseline failure** ? `app/features/auth/login/login.spec.ts`
   - Login should create
22. **Unchanged baseline failure** ? `app/features/ceo/dashboard/dashboard.spec.ts`
   - Dashboard should create
23. **Unchanged baseline failure** ? `app/features/doctor/dashboard/dashboard.spec.ts`
   - Dashboard should create
24. **Migrated: obsolete Bookings behavior** ? `app/features/receptionist/bookings/bookings.spec.ts`
   - BookingsComponent Logic Unit Tests Assessment First Business Rule should detect existing patient as not new
25. **Migrated: obsolete Bookings behavior** ? `app/features/receptionist/bookings/bookings.spec.ts`
   - BookingsComponent Logic Unit Tests Insurance & Booking Gates (The Gates) should allow booking for Approved Insurance patient (Patient 2 - Mona Zaki)
26. **Migrated: obsolete Bookings behavior** ? `app/features/receptionist/bookings/bookings.spec.ts`
   - BookingsComponent Logic Unit Tests Insurance & Booking Gates (The Gates) should allow old patient to book standard Session
27. **Migrated: obsolete Bookings behavior** ? `app/features/receptionist/bookings/bookings.spec.ts`
   - BookingsComponent Logic Unit Tests Insurance & Booking Gates (The Gates) should block booking and show error toast when Insurance patient has Pending status (Patient 7)
28. **Migrated: obsolete Bookings behavior** ? `app/features/receptionist/bookings/bookings.spec.ts`
   - BookingsComponent Logic Unit Tests Strict Gender Matching should return only Female doctors when Female patient (Sara Mahmoud) is selected
29. **Migrated: obsolete Bookings behavior** ? `app/features/receptionist/bookings/bookings.spec.ts`
   - BookingsComponent Logic Unit Tests Strict Gender Matching should return only Male doctors when Male patient (Youssef Ali) is selected
30. **Migrated: obsolete Bookings behavior** ? `app/features/receptionist/bookings/bookings.spec.ts`
   - BookingsComponent Logic Unit Tests Walk-in Nearest Slot Finding should auto-fill doctor, room, and date within filteredDoctors for male patient
31. **Migrated: obsolete Bookings behavior** ? `app/features/receptionist/bookings/bookings.spec.ts`
   - BookingsComponent Logic Unit Tests Walk-in Nearest Slot Finding should auto-fill female doctor for female patient
32. **Unchanged baseline failure** ? `app/features/senior/assessment-form/assessment-form.spec.ts`
   - AssessmentForm should create
33. **Unchanged baseline failure** ? `app/features/senior/dashboard/dashboard.spec.ts`
   - Dashboard should create
34. **Unchanged baseline failure** ? `app/features/senior/live-dashboard/live-dashboard.spec.ts`
   - LiveDashboard should create
35. **Unchanged baseline failure** ? `app/features/senior/re-assessment-form/re-assessment-form.spec.ts`
   - ReAssessmentForm should create
36. **Unchanged baseline failure** ? `app/layout/app-layout/app-layout.spec.ts`
   - AppLayoutComponent should create
37. **Unchanged baseline failure** ? `app/layout/sidebar/sidebar.spec.ts`
   - Sidebar should create
38. **Unchanged baseline failure** ? `app/layout/topbar/topbar.spec.ts`
   - Topbar should create
39. **Unchanged baseline failure** ? `app/shared/components/language-selector/language-selector.spec.ts`
   - LanguageSelector should create
40. **Unchanged baseline failure** ? `app/shared/components/theme-toggle/theme-toggle.spec.ts`
   - ThemeToggle should create

## Existing suite initialization error

`src/app/features/receptionist/receptionist-e2e-integration.spec.ts` cannot initialize because fakeAsync requires zone-testing. It remains separate from the 40 original assertion failures.

## Local-only new coverage

Focused registration, room, appointment, billing/profile and refresh tests intercept HTTP locally. Their passing responses are test fixtures, not verified live API behavior. Authenticated runtime verification, visual browser checks and two-receptionist-session consistency remain pending an approved test environment.
