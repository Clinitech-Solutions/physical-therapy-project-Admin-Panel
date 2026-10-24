import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class InsuranceDocumentService {
  private http = inject(HttpClient);
  
  private apiUrl = `${environment.apiUrl}/InsuranceDocuments`;

  public uploadDocuments(patientId: number, files: File[]): Observable<any> {
    const formData = new FormData();
    formData.append('PatientId', patientId.toString());
    
    files.forEach(file => {
      formData.append('Files', file, file.name);
    });

    return this.http.post<any>(`${this.apiUrl}/Add`, formData);
  }
}
