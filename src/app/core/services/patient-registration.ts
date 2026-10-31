import { HttpErrorResponse } from '@angular/common/http';
import { InsuranceDetails, NewPatient, Patient, PatientEditDraft } from '../models/patient.model';
import { CreatePatientRequest, InsuranceDetailsResponse, UpdatePatientRequest } from '../models/patient-api.model';

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

export function patientInsuranceDetails(details?: InsuranceDetails | null): InsuranceDetailsResponse | null {
  if (!details) return null;
  const copay = details.copayPercentage;
  const sessions = details.approvedSessions;
  const errors = patientUpdateErrors({ insuranceDetails: details });
  if (errors.length) throw new PatientValidationError(errors);
  // OpenAPI declares InsuranceStatus as integer without labels. Never guess approval.
  return {
    status: details.apiStatus ?? null,
    copayPercentage: copay ?? null, approvedSessions: sessions ?? null,
    memberId: details.memberId?.trim() || null, employer: details.employer?.trim() || null
  };
}

/** Shared UI/service validation: collect errors without sending a request. */
export function patientRegistrationErrors(draft: NewPatient): PatientInputError[] {
  return patientUpdateErrors({
    nameEn: draft.nameEn, phone: draft.phone, gender: draft.gender,
    birthDate: draft.dob, emergencyContact: draft.emergencyContact, paymentType: draft.paymentType,
    insuranceCompanyId: draft.paymentType === 'Insurance' ? draft.insuranceCompanyId ?? null : undefined,
    insuranceDetails: draft.paymentType === 'Insurance' ? draft.insuranceDetails : undefined
  });
}

/** Validate only supplied fields so partial edits cannot reset unrelated values. */
export function patientUpdateErrors(patient: Partial<Patient>): PatientInputError[] {
  const errors: PatientInputError[] = [];
  const userName = patient.userName?.trim();
  if (userName !== undefined && (userName.length < 3 || userName.length > 50)) {
    errors.push(new PatientInputError('PATIENT_USERNAME_LENGTH', 'Username must contain 3 to 50 characters.', 'userName'));
  }
  const fullName = patient.nameEn?.trim();
  if (fullName !== undefined && (fullName.length < 2 || fullName.length > 150)) {
    errors.push(new PatientInputError('PATIENT_NAME_LENGTH', 'Full name must contain 2 to 150 characters.', 'nameEn'));
  }
  const phoneNumber = patient.phone?.trim();
  if (phoneNumber !== undefined && (!phoneNumber || phoneNumber.length > 20)) {
    errors.push(new PatientInputError('PATIENT_PHONE_LENGTH', 'Enter a phone number of at most 20 characters; emergency contact has the same limit.', 'phone'));
  }
  if ((patient.emergencyContact?.trim().length ?? 0) > 20) {
    errors.push(new PatientInputError('PATIENT_EMERGENCY_CONTACT_LENGTH', 'Emergency contact must contain at most 20 characters.', 'emergencyContact'));
  }
  if (patient.gender !== undefined && patient.gender !== 'Male' && patient.gender !== 'Female') {
    errors.push(new PatientInputError('PATIENT_GENDER_REQUIRED', 'Select the patient gender.', 'gender'));
  }
  try { if (patient.birthDate !== undefined) patientBirthDate(patient.birthDate); } catch (error) {
    if (!(error instanceof PatientInputError)) throw error;
    errors.push(new PatientInputError(error.key, error.message, 'dob'));
  }
  if (patient.email !== undefined && patient.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patient.email.trim())) {
    errors.push(new PatientInputError('PATIENT_EMAIL_INVALID', 'Enter a valid email address.', 'email'));
  }
  if (patient.paymentType != null && patient.paymentType.trim().length > 20) {
    errors.push(new PatientInputError('PATIENT_PAYMENT_TYPE_LENGTH', 'Payment type must contain at most 20 characters.', 'paymentType'));
  }
  if (patient.insuranceCompanyId !== undefined) {
    if ((patient.insuranceCompanyId === null && patient.paymentType === 'Insurance') ||
        (patient.insuranceCompanyId !== null && (!Number.isInteger(patient.insuranceCompanyId) || patient.insuranceCompanyId <= 0 || patient.insuranceCompanyId > 2147483647))) {
      errors.push(new PatientInputError('PATIENT_INSURANCE_COMPANY_REQUIRED', 'Select an insurance company.', 'insuranceCompanyId'));
    }
  }
  const details = patient.insuranceDetails;
  if (details) {
    if (details.copayPercentage != null && (!Number.isFinite(details.copayPercentage) || details.copayPercentage < 0 || details.copayPercentage > 100)) {
      errors.push(new PatientInputError('PATIENT_INSURANCE_NUMBERS_INVALID', 'Copay must be between 0 and 100; approved sessions must be a non-negative whole number.', 'copayPercentage'));
    }
    if (details.approvedSessions != null && (!Number.isInteger(details.approvedSessions) || details.approvedSessions < 0 || details.approvedSessions > 2147483647)) {
      errors.push(new PatientInputError('PATIENT_INSURANCE_NUMBERS_INVALID', 'Copay must be between 0 and 100; approved sessions must be a non-negative whole number.', 'approvedSessions'));
    }
    if (details.apiStatus != null && (!Number.isInteger(details.apiStatus) || details.apiStatus < -2147483648 || details.apiStatus > 2147483647)) {
      errors.push(new PatientInputError('PATIENT_INSURANCE_STATUS_INVALID', 'Insurance status must be a whole number.', 'apiStatus'));
    }
  }
  return errors;
}

export function updatePatientRequest(patient: Partial<Patient>): UpdatePatientRequest {
  const errors = patientUpdateErrors(patient);
  if (errors.length) throw new PatientValidationError(errors);
  const payload: UpdatePatientRequest = {};
  if (patient.userName !== undefined) payload.userName = patient.userName.trim();
  if (patient.email !== undefined) payload.email = patient.email.trim();
  if (patient.nameEn !== undefined) payload.fullName = patient.nameEn.trim();
  if (patient.phone !== undefined) payload.phoneNumber = patient.phone.trim();
  if (patient.gender !== undefined) payload.gender = patient.gender === 'Female' ? 1 : 0;
  if (patient.birthDate !== undefined) payload.birthDate = patientBirthDate(patient.birthDate);
  if (patient.emergencyContact !== undefined) payload.emergencyContact = patient.emergencyContact?.trim() || null;
  if (patient.paymentType !== undefined) payload.paymentType = patient.paymentType?.trim() || null;
  if (patient.insuranceCompanyId !== undefined) payload.insuranceCompanyId = patient.insuranceCompanyId;
  if (patient.insuranceDetails !== undefined) payload.insuranceDetails = patientInsuranceDetails(patient.insuranceDetails);
  return payload;
}

export function patientEditDraft(patient: Patient): PatientEditDraft {
  return {
    ...emptyPatientRegistration(), userName: '', email: patient.email ?? '', nameEn: patient.nameEn,
    phone: patient.phone, dob: patient.birthDate?.slice(0, 10) ?? '', gender: patient.gender,
    emergencyContact: patient.emergencyContact ?? '', paymentType: patient.paymentType,
    insuranceCompanyId: patient.insuranceCompanyId ?? null,
    insuranceCompany: patient.insuranceCompanyName ?? '',
    insuranceDetails: patient.insuranceDetails ? { ...patient.insuranceDetails } : { company: '', status: 'Unknown' }
  };
}

/** Diff against GetById, including nulls, rather than resubmitting the list row. */
export function patientEditChanges(original: Patient, draft: PatientEditDraft): Partial<Patient> {
  const changes: Partial<Patient> = {};
  if (draft.userName?.trim()) changes.userName = draft.userName;
  if (draft.nameEn.trim() !== original.nameEn.trim()) changes.nameEn = draft.nameEn;
  if (draft.phone.trim() !== original.phone.trim()) changes.phone = draft.phone;
  if (draft.email.trim() !== (original.email ?? '').trim()) changes.email = draft.email;
  if (draft.gender !== original.gender) changes.gender = draft.gender;
  if (draft.dob !== original.birthDate?.slice(0, 10)) changes.birthDate = draft.dob;
  if ((draft.emergencyContact?.trim() || null) !== (original.emergencyContact?.trim() || null)) changes.emergencyContact = draft.emergencyContact;
  if (draft.paymentType !== original.paymentType) changes.paymentType = draft.paymentType;
  if (original.paymentType === 'Insurance' && draft.paymentType !== 'Insurance') {
    changes.insuranceCompanyId = null; changes.insuranceDetails = null;
  } else if (draft.paymentType === 'Insurance' || draft.paymentType == null) {
    if (draft.insuranceCompanyId !== (original.insuranceCompanyId ?? null) ||
        (draft.paymentType === 'Insurance' && original.paymentType !== 'Insurance')) changes.insuranceCompanyId = draft.insuranceCompanyId;
    const details = patientInsuranceDetails(draft.insuranceDetails);
    const before = patientInsuranceDetails(original.insuranceDetails);
    // Empty form controls do not turn a saved null insuranceDetails into an object.
    const empty = details && Object.values(details).every(value => value === null);
    if (!(empty && before === null) && JSON.stringify(details) !== JSON.stringify(before)) changes.insuranceDetails = draft.insuranceDetails;
  }
  return changes;
}

export function createPatientRequest(draft: NewPatient): CreatePatientRequest {
  const errors = patientRegistrationErrors(draft);
  if (errors.length) throw new PatientValidationError(errors);
  const insured = draft.paymentType === 'Insurance';
  return {
    fullName: draft.nameEn.trim(), phoneNumber: draft.phone.trim(),
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
  if(/Exception|SqlClient|stack trace|System\./i.test(JSON.stringify(body)))return undefined;
  if (body.errors && typeof body.errors === 'object') {
    const messages = Object.entries(body.errors).flatMap(([field, values]) =>
      (Array.isArray(values) ? values : [values]).filter(v => typeof v === 'string').map(v => `${field}: ${v}`));
    if (messages.length) return messages.join('\n');
  }
  return [body.detail, body.title].filter(v => typeof v === 'string').join('\n') || undefined;
}
