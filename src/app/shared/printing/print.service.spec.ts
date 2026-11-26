import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach } from 'vitest';
import { PrintService } from './print.service';

describe('full-scope printing',()=>{
  let service:PrintService;
  beforeEach(()=>{TestBed.configureTestingModule({providers:[provideHttpClient()]});service=TestBed.inject(PrintService);});
  it('preserves all rows and totals and removes technical identifiers',async()=>{
    const rows=Array.from({length:67},(_,i)=>`"${i}","Ref ${i}","Patient ${i}","private","5.25","Paid"`).join('\r\n');
    const doc=await service.csv(new Blob(['"Matching rows","67","Collected","351.75"\r\n"ID","Reference / operation","Patient","Clinician ID","Collected","Status"\r\n'+rows]),'Collections',['Applied scope']);
    expect(doc.sections[0].rows).toHaveLength(67);
    expect(JSON.stringify(doc)).not.toContain('private');
    expect(doc.sections.at(-1)?.totals).toContainEqual(['Collected','351.75']);
    expect(doc.sections[0].rows?.at(-1)).toContain('Patient 66');
  });
  it('refuses inconsistent and over-limit exports rather than silently clipping',async()=>{
    await expect(service.csv(new Blob(['"Matching rows","2"\n"ID","Patient"\n"1","A"']),'Scope',[])).rejects.toThrow('Export count mismatch');
    expect(()=>service.limit(5001)).toThrow('narrow the filters');
    expect(()=>service.limit(5000)).not.toThrow();
  });
  it('uses Cairo time with a matching label and excludes irrelevant activity columns from collections',async()=>{
    const doc=await service.csv(new Blob(['"Matching rows","1","Collected","5.25"\n"ID","Reference / operation","Patient","Date UTC","Amount","Clinical start UTC"\n"1","receipt","A","2026-11-26T08:00:00Z","5.25",""']),'Collections',[],'patient-collections');
    expect(doc.sections[0].columns).toContain('Date (Africa/Cairo)');
    expect(doc.sections[0].columns).not.toContain('Clinical start (Africa/Cairo)');
    expect(JSON.stringify(doc.sections[0].rows)).toContain('10:00');
  });
});
