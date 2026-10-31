import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ClinicianService } from './clinician.service';
import { InsuranceService } from './insurance.service';
import { InsuranceDocumentService } from './insurance-document.service';

describe('Reception lookup permissions and patient document boundaries (mocked HTTP)', () => {
  let http: HttpTestingController;
  const base=environment.apiUrl;
  beforeEach(()=>{TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]});http=TestBed.inject(HttpTestingController);});
  afterEach(()=>http.verify());
  it('loads the minimal clinician directory without asking for staff-account administration',()=>{
    const service=TestBed.inject(ClinicianService);service.load();
    http.expectOne(`${base}/Receptionist/clinicians`).flush([{id:'clinical-guid',name:'Clinician',gender:'Female',roles:['Senior','Doctor'],currentLoad:1,workingHours:[{dayOfWeek:1,startTime:'08:00:00',endTime:'16:00:00'}],absenceDates:['2031-01-01']}]);
    expect(service.error()).toBeNull();expect(service.clinicians()[0]).toMatchObject({id:'clinical-guid',gender:'Female',roles:['Senior','Doctor'],currentLoad:1});
    http.expectNone(`${base}/Users/GetAll`);
  });
  it('cancels an obsolete directory request and distinguishes a denied load from a successful empty directory',()=>{
    const service=TestBed.inject(ClinicianService);service.load();const obsolete=http.expectOne(`${base}/Receptionist/clinicians`);
    service.load();expect(obsolete.cancelled).toBe(true);
    http.expectOne(`${base}/Receptionist/clinicians`).flush({}, {status:403,statusText:'Forbidden'});expect(service.error()).toBeTruthy();expect(service.loading()).toBe(false);
    service.load();http.expectOne(`${base}/Receptionist/clinicians`).flush([]);expect(service.error()).toBeNull();expect(service.clinicians()).toEqual([]);
  });
  it('keeps insurer errors separate and clears them after an empty successful retry',()=>{
    const service=TestBed.inject(InsuranceService);service.getCompanies();
    http.expectOne(`${base}/InsuranceCompanies/GetAll`).flush({}, {status:403,statusText:'Forbidden'});expect(service.error()).toBeTruthy();
    service.getCompanies();http.expectOne(`${base}/InsuranceCompanies/GetAll`).flush([]);expect(service.error()).toBeNull();expect(service.companies()).toEqual([]);
  });
  it('requests only the selected patient documents and uses an authenticated API file endpoint',async()=>{
    const service=TestBed.inject(InsuranceDocumentService);const list=firstValueFrom(service.getDocumentsForPatient(2));
    http.expectOne(r=>r.url===`${base}/InsuranceDocuments`&&r.params.get('patientId')==='2').flush([{id:7,patientId:2,fileName:'approval.pdf',contentType:'application/pdf',uploadedAt:'2030-01-01T10:00:00Z',filePath:'/untrusted/path'}]);
    expect(await list).toEqual([{id:7,patientId:2,fileName:'approval.pdf',contentType:'application/pdf',uploadedAt:'2030-01-01T10:00:00Z'}]);
    const download=firstValueFrom(service.downloadDocument(7));const request=http.expectOne(`${base}/InsuranceDocuments/7/file`);expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['document'],{type:'application/pdf'}));expect(await download).toBeInstanceOf(Blob);
  });
});
