import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { map, timeout } from "rxjs";
import { environment } from "../../../environments/environment";
import {
  ProfileData,
  RescheduleAvailability,
  RescheduleRequest,
  RescheduleReceipt,
} from "../models/patient-profile.model";
import { numericId, ReceptionError } from "./reception-api";

@Injectable({ providedIn: "root" })
export class PatientProfileService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/Bookings`;
  profile(id: number) {
    return this.http
      .get<ProfileData>(`${this.url}/patients/${numericId(id)}/profile`)
      .pipe(
        timeout(20000),
        map((data) => {
          if (
            data?.patientId !== id ||
            !Array.isArray(data.courses) ||
            !Array.isArray(data.assessments)
          )
            throw new ReceptionError(
              "PROFILE_LOAD_FAILED",
              "The patient profile response could not be verified.",
            );
          return data;
        }),
      );
  }
  slots(id: number, date: string) {
    return this.http
      .get<RescheduleAvailability>(
        `${this.url}/appointments/${numericId(id)}/reschedule-slots`,
        { params: { date } },
      )
      .pipe(timeout(20000));
  }
  save(id: number, request: RescheduleRequest) {
    return this.http
      .put<RescheduleReceipt>(
        `${this.url}/appointments/${numericId(id)}/reschedule`,
        request,
      )
      .pipe(timeout(30000));
  }
  reconcile(id: number, key: string) {
    return this.http
      .get<RescheduleReceipt>(
        `${this.url}/appointments/${numericId(id)}/reschedules/${encodeURIComponent(key)}`,
      )
      .pipe(timeout(20000));
  }
}
