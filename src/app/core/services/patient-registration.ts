import { HttpErrorResponse } from '@angular/common/http';
import { InsuranceDetails, NewPatient } from '../models/patient.model';
import { CreatePatientRequest, InsuranceDetailsResponse } from '../models/patient-api.model';

export class PatientInputError extends Error {
  constructor(public readonly key: string, message: string, public readonly field?: string) { super(message); }
}

export class PatientValidationError extends PatientInputError {
  constructor(public readonly errors: PatientInputError[]) {
    super(errors[0].key, errors.map(error => error.message).join('\n'), errors[0].field);
  }
}

export class PatientOutcomeUnknownError extends Error {
  constructor() { super('The patient may have been saved. Check the patient list before registering again.'); }
}

export function emptyPatientRegistration(): NewPatient {
  return {
    userName: '', nameEn: '', nameAr: '', phone: '', dob: '', gender: 'Male',
    emergencyContact: '', paymentType: 'Cash', insuranceCompanyId: null,
    insuranceCompany: '', insuranceDetails: { company: '', status: 'Unknown' },
    docs: { medicalConsent: false, liabilityWaiver: false, idCard: false }
  };
}

export function patientBirthDate(value: string): string {
  const day = value?.slice(0, 10);
  const date = new Date(`${day}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day ?? '') || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) {
    throw new PatientInputError('PATIENT_BIRTH_DATE_REQUIRED', 'Enter a valid date of birth.');
  }
  return date.toISOString();
}

export function patientInsuranceDetails(details?: InsuranceDetails): InsuranceDetailsResponse | null {
  if (!details) return null;
  const copay = details.copayPercentage;
  const sessions = details.approvedSessions;
  if ((copay != null && !Number.isFinite(copay)) || (sessions != null && !Number.isInteger(sessions))) {
    throw new PatientInputError('PATIENT_INSURANCE_NUMBERS_INVALID', 'Enter numeric copay and whole approved sessions.');
  }
  // OpenAPI declares InsuranceStatus as integer without labels. Never guess approval.
  return {
    status: details.apiStatus ?? null,
    copayPercentage: copay ?? null, approvedSessions: sessions ?? null,
    memberId: details.memberId?.trim() || null, employer: details.employer?.trim() || null
  };
}

/** Shared UI/service validation: collect errors without sending a request. */
export function patientRegistrationErrors(draft: NewPatient): PatientInputError[] {
  const errors: PatientInputError[] = [];
  const userName = draft.userName?.trim() ?? '';
  const fullName = draft.nameEn.trim();
  const phoneNumber = draft.phone.trim();
  if (userName.length < 3 || userName.length > 50) {
    errors.push(new PatientInputError('PATIENT_USERNAME_LENGTH', 'Username must contain 3 to 50 characters.', 'userName'));
  }
  if (fullName.length < 2 || fullName.length > 150) {
    errors.push(new PatientInputError('PATIENT_NAME_LENGTH', 'Full name must contain 2 to 150 characters.', 'nameEn'));
  }
  if (!phoneNumber || phoneNumber.length > 20) {
    errors.push(new PatientInputError('PATIENT_PHONE_LENGTH', 'Enter a phone number of at most 20 characters; emergency contact has the same limit.', 'phone'));
  }
  if ((draft.emergencyContact?.trim().length ?? 0) > 20) {
    errors.push(new PatientInputError('PATIENT_EMERGENCY_CONTACT_LENGTH', 'Emergency contact must contain at most 20 characters.', 'emergencyContact'));
  }
  if (draft.gender !== 'Male' && draft.gender !== 'Female') {
    errors.push(new PatientInputError('PATIENT_GENDER_REQUIRED', 'Select the patient gender.', 'gender'));
  }
  try { patientBirthDate(draft.dob); } catch (error) {
    if (!(error instanceof PatientInputError)) throw error;
    errors.push(new PatientInputError(error.key, error.message, 'dob'));
  }
  if (draft.paymentType === 'Insurance') {
    if (!Number.isInteger(draft.insuranceCompanyId) || Number(draft.insuranceCompanyId) <= 0) {
      errors.push(new PatientInputError('PATIENT_INSURANCE_COMPANY_REQUIRED', 'Select an insurance company.', 'insuranceCompanyId'));
    }
    const details = draft.insuranceDetails;
    if (details?.copayPercentage != null && !Number.isFinite(details.copayPercentage)) {
      errors.push(new PatientInputError('PATIENT_INSURANCE_NUMBERS_INVALID', 'Enter numeric copay and whole approved sessions.', 'copayPercentage'));
    }
    if (details?.approvedSessions != null && !Number.isInteger(details.approvedSessions)) {
      errors.push(new PatientInputError('PATIENT_INSURANCE_NUMBERS_INVALID', 'Enter numeric copay and whole approved sessions.', 'approvedSessions'));
    }
  }
  return errors;
}

export function createPatientRequest(draft: NewPatient): CreatePatientRequest {
  const errors = patientRegistrationErrors(draft);
  if (errors.length) throw new PatientValidationError(errors);
  const insured = draft.paymentType === 'Insurance';
  return {
    userName: draft.userName?.trim() ?? '', fullName: draft.nameEn.trim(), phoneNumber: draft.phone.trim(),
    // Existing frontend mapping retained unchanged, as requested by the user.
    gender: draft.gender === 'Female' ? 1 : 0,
    birthDate: patientBirthDate(draft.dob), paymentType: draft.paymentType,
    emergencyContact: draft.emergencyContact?.trim() || null,
    insuranceCompanyId: insured ? draft.insuranceCompanyId : null,
    insuranceDetails: insured ? patientInsuranceDetails(draft.insuranceDetails) : null
  };
}

export function patientOutcomeIsUnknown(error: unknown): boolean {
  return error instanceof PatientOutcomeUnknownError ||
    (error instanceof HttpErrorResponse && (error.status === 0 || error.status === 408 || error.status >= 500 || (error.status >= 200 && error.status < 300))) ||
    (error instanceof Error && error.name === 'TimeoutError');
}

export function patientServerError(error: unknown): string | undefined {
  if (!(error instanceof HttpErrorResponse)) return undefined;
  const body = error.error;
  if (!body || typeof body !== 'object') return undefined;
  if (body.errors && typeof body.errors === 'object') {
    const messages = Object.entries(body.errors).flatMap(([field, values]) =>
      (Array.isArray(values) ? values : [values]).filter(v => typeof v === 'string').map(v => `${field}: ${v}`));
    if (messages.length) return messages.join('\n');
  }
  return [body.detail, body.title].filter(v => typeof v === 'string').join('\n') || undefined;
}
