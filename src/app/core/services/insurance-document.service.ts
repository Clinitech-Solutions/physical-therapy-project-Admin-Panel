import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable, defer, from, switchMap, catchError, throwError, tap } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ReceptionistLocale } from '../../shared/receptionist-locale';
import { validateInsuranceDocuments } from './insurance-document-policy';
import { MutationState, numericId, ReceptionError, record, textField } from './reception-api';
import { map } from 'rxjs/operators';

export interface InsuranceDocumentRecord { id: number; patientId: number; fileName: string; contentType: string; uploadedAt: string; }

@Injectable({
  providedIn: 'root'
})
export class InsuranceDocumentService {
  private pendingUpload: {patientId:number;key:string;files:File[]}|null=null;
  readonly mutation = new MutationState();
  private http = inject(HttpClient);
  private messages = inject(MessageService, { optional: true });
  private readonly locale = new ReceptionistLocale();
  private validate(files: File[]) {
    return defer(() => from(validateInsuranceDocuments(files, this.locale.language === 'ar-EG')));
  }
  private uploadError(error: unknown) {
    const invalid = ((error as any)?.error?.code ?? (error as any)?.error?.title) === 'InsuranceDocument.InvalidFile';
    const detail = error instanceof Error ? error.message : invalid
      ? (this.locale.language === 'ar-EG' ? 'يسمح بملفات PDF وJPEG وPNG غير الفارغة فقط، بحد أقصى 10 MiB، مع محتوى مطابق للامتداد.' : 'Only non-empty PDF, JPEG and PNG files up to 10 MiB with matching content are allowed.')
      : (this.locale.language === 'ar-EG' ? 'تعذر رفع المستند. تم الاحتفاظ ببيانات المريض والمستندات السابقة.' : 'Document upload failed. The patient and existing documents are preserved.');
    this.messages?.add({ severity: 'error', summary: this.locale.language === 'ar-EG' ? 'خطأ' : 'Error', detail });
    return throwError(() => new Error(detail));
  }
  
  private apiUrl = `${environment.apiUrl}/InsuranceDocuments`;

  public uploadDocuments(patientId: number, files: File[]): Observable<any> {
    numericId(patientId);
    return this.validate(files).pipe(switchMap(()=>from(this.prepareUpload(patientId,files))),switchMap(operation=>{
      const formData=new FormData();formData.append('PatientId',String(patientId));formData.append('IdempotencyKey',operation.key);
      operation.files.forEach(file=>formData.append('Files',file,file.name));
      // Only the original upload can cross an uncertain-response boundary. The server verifies its content hash.
      this.mutation.uncertain.set(false);
      return this.mutation.run(()=>this.http.post<unknown>(`${this.apiUrl}/Add`,formData)).pipe(
        map(value=>{if(!Array.isArray(value)||value.length!==operation.files.length||value.some(row=>Number(row?.patientId)!==patientId||!Number.isSafeInteger(Number(row?.id))||Number(row.id)<=0))throw new ReceptionError('DOCUMENT_RESPONSE_PENDING',this.locale.text('DOCUMENT_RESPONSE_PENDING','The saved upload could not be verified. Retry the original files.'));return value;}),
        tap(()=>{this.pendingUpload=null;this.mutation.uncertain.set(false);}),
        catchError(error=>{if(error instanceof ReceptionError&&error.key==='DOCUMENT_RESPONSE_PENDING')this.mutation.uncertain.set(true);if(!this.mutation.uncertain()&&error?.status>=400&&error.status<500&&error.status!==409)this.pendingUpload=null;return throwError(()=>error);})
      );
    }),catchError(error=>this.uploadError(error)));
  }

  private async bytes(file:File):Promise<Uint8Array>{
    return new Uint8Array(typeof file.arrayBuffer==='function'?await file.arrayBuffer():await new Promise<ArrayBuffer>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as ArrayBuffer);reader.onerror=()=>reject(new Error('Document could not be read.'));reader.readAsArrayBuffer(file);}));
  }
  private async prepareUpload(patientId:number,files:File[]){
    const pending=this.pendingUpload;
    if(!pending){if(this.mutation.uncertain())throw new ReceptionError('DOCUMENT_RESPONSE_PENDING',this.locale.text('DOCUMENT_ORIGINAL_RETRY','Retry the original files before starting a different upload.'));return this.pendingUpload={patientId,key:crypto.randomUUID(),files:[...files]};}
    let same=pending.patientId===patientId&&pending.files.length===files.length;
    for(let index=0;same&&index<files.length;index++){
      const original=pending.files[index],file=files[index];same=original.name===file.name&&original.size===file.size;
      if(same&&original!==file){const[a,b]=await Promise.all([this.bytes(original),this.bytes(file)]);same=a.length===b.length&&a.every((byte,i)=>byte===b[i]);}
    }
    if(!same)throw new ReceptionError('DOCUMENT_RESPONSE_PENDING',this.locale.text('DOCUMENT_ORIGINAL_RETRY','Retry the original files before starting a different upload.'));
    return pending;
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
    return this.validate([file]).pipe(switchMap(() => this.mutation.run(() => this.http.put<unknown>(`${this.apiUrl}/${numericId(id)}`, data))), catchError(error => this.uploadError(error)));
  }
  deleteDocument(id: number) {
    return this.mutation.run(() => this.http.delete<unknown>(`${this.apiUrl}/${numericId(id)}`));
  }
}
