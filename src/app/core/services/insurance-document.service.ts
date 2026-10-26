import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { MutationState, numericId, ReceptionError } from './reception-api';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class InsuranceDocumentService {
  readonly mutation = new MutationState();
  private http = inject(HttpClient);
  
  private apiUrl = `${environment.apiUrl}/InsuranceDocuments`;

  public uploadDocuments(patientId: number, files: File[]): Observable<any> {
    const formData = new FormData();
    formData.append('PatientId', numericId(patientId).toString());
    
    files.forEach(file => {
      formData.append('Files', file, file.name);
    });

    return this.mutation.run(() => this.http.post<unknown>(`${this.apiUrl}/Add`, formData));
  }

  getDocumentsForPatient(patientId: number): Observable<unknown[]> {
    numericId(patientId);
    return this.http.get<unknown>(this.apiUrl).pipe(map(value => {
      if (Array.isArray(value) && value.length === 0) return [];
      // No list schema, patient association or file URL is documented. Never expose another patient's files.
      throw new ReceptionError('DOCUMENT_RESPONSE_PENDING', 'Document details are unavailable until patient association and file access are verified.');
    }));
  }
  updateDocument(id: number, file: File) {
    const data = new FormData(); data.append('File', file, file.name);
    return this.mutation.run(() => this.http.put<unknown>(`${this.apiUrl}/${numericId(id)}`, data));
  }
  deleteDocument(id: number) {
    return this.mutation.run(() => this.http.delete<unknown>(`${this.apiUrl}/${numericId(id)}`));
  }
}
