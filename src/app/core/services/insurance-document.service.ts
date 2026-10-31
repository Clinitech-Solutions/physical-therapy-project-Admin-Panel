import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { MutationState, numericId, ReceptionError, record, textField } from './reception-api';
import { map } from 'rxjs/operators';

export interface InsuranceDocumentRecord { id: number; patientId: number; fileName: string; contentType: string; uploadedAt: string; }

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

  getDocumentsForPatient(patientId: number): Observable<InsuranceDocumentRecord[]> {
    numericId(patientId);
    return this.http.get<unknown>(this.apiUrl, {params:{patientId}}).pipe(map(value => {
      if (!Array.isArray(value)) throw new ReceptionError('DOCUMENT_RESPONSE_PENDING', 'The document response could not be verified.');
      return value.map(value => {
        const row=record(value);
        if (numericId(row['patientId']) !== patientId) throw new ReceptionError('DOCUMENT_RESPONSE_PENDING', 'Document patient association could not be verified.');
        return {id:numericId(row['id']),patientId,fileName:textField(row['fileName']),contentType:textField(row['contentType']),uploadedAt:textField(row['uploadedAt'])};
      });
    }));
  }
  downloadDocument(id: number) { return this.http.get(`${this.apiUrl}/${numericId(id)}/file`, {responseType:'blob'}); }
  updateDocument(id: number, file: File) {
    const data = new FormData(); data.append('File', file, file.name);
    return this.mutation.run(() => this.http.put<unknown>(`${this.apiUrl}/${numericId(id)}`, data));
  }
  deleteDocument(id: number) {
    return this.mutation.run(() => this.http.delete<unknown>(`${this.apiUrl}/${numericId(id)}`));
  }
}
