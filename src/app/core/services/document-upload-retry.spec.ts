import{TestBed}from'@angular/core/testing';import{provideHttpClient}from'@angular/common/http';import{HttpTestingController,provideHttpClientTesting}from'@angular/common/http/testing';import{TranslateModule}from'@ngx-translate/core';import{firstValueFrom}from'rxjs';
import{InsuranceDocumentService}from'./insurance-document.service';import{environment}from'../../../environments/environment';
describe('Document upload uncertain response recovery',()=>{
 let service:InsuranceDocumentService,http:HttpTestingController;
 beforeEach(()=>{TestBed.configureTestingModule({imports:[TranslateModule.forRoot()],providers:[provideHttpClient(),provideHttpClientTesting()]});service=TestBed.inject(InsuranceDocumentService);http=TestBed.inject(HttpTestingController);});
 afterEach(()=>http.verify());
 it('retries the original upload key after network failure and rejects changed content without another request',async()=>{
  const file=new File(['%PDF-1.7 one'],'approval.pdf'),first=firstValueFrom(service.uploadDocuments(1,[file])).catch(error=>error);
  const request=await vi.waitFor(()=>http.expectOne(`${environment.apiUrl}/InsuranceDocuments/Add`)),key=request.request.body.get('IdempotencyKey');request.error(new ProgressEvent('error'));await first;expect(service.mutation.uncertain()).toBe(true);
  await expect(firstValueFrom(service.uploadDocuments(1,[new File(['%PDF-1.7 two'],'approval.pdf')]))).rejects.toThrow();http.expectNone(`${environment.apiUrl}/InsuranceDocuments/Add`);
  const retry=firstValueFrom(service.uploadDocuments(1,[file]));const repeated=await vi.waitFor(()=>http.expectOne(`${environment.apiUrl}/InsuranceDocuments/Add`));expect(repeated.request.body.get('IdempotencyKey')).toBe(key);repeated.flush([{id:7,patientId:1,fileName:'approval.pdf'}]);await retry;expect(service.mutation.uncertain()).toBe(false);
 });
 it('does not report a malformed success response as a verified saved upload',async()=>{
  const file=new File(['%PDF-1.7 original'],'approval.pdf'),first=firstValueFrom(service.uploadDocuments(1,[file])).catch(error=>error);
  const request=await vi.waitFor(()=>http.expectOne(`${environment.apiUrl}/InsuranceDocuments/Add`)),key=request.request.body.get('IdempotencyKey');request.flush([]);expect(await first).toBeInstanceOf(Error);expect(service.mutation.uncertain()).toBe(true);
  const retry=firstValueFrom(service.uploadDocuments(1,[file]));const repeated=await vi.waitFor(()=>http.expectOne(`${environment.apiUrl}/InsuranceDocuments/Add`));expect(repeated.request.body.get('IdempotencyKey')).toBe(key);repeated.flush([{id:7,patientId:1,fileName:'approval.pdf'}]);await retry;
 });
});
