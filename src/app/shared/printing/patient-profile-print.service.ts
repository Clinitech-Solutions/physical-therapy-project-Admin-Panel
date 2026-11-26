import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { PatientProfileService } from '../../core/services/patient-profile.service';
import { PatientService } from '../../core/services/patient.service';
import { AuthService } from '../../core/services/auth';
import { PatientResponse } from '../../core/models/patient-api.model';
import { AssessmentRecord, TreatmentPlanRecord, TreatmentPlanSessionRecord } from '../../core/models/clinical-api.model';
import { environment } from '../../../environments/environment';
import { PrintService } from './print.service';
import { PrintDocument, PrintSection, PrintValue } from './print-document';

export interface ProfilePrintOptions {
  summary:boolean; plan:boolean; sessions:boolean; clinical:boolean; financial:boolean; activity:boolean; allCourses:boolean;
}
@Injectable({providedIn:'root'})
export class PatientProfilePrintService {
  private readonly http=inject(HttpClient);
  private readonly profiles=inject(PatientProfileService);
  private readonly patients=inject(PatientService);
  private readonly auth=inject(AuthService);
  readonly printer=inject(PrintService);
  // These are the same StaffRead roles used by the profile and clinical read APIs.
  get authorized(){return ['Receptionist','Senior','Doctor','Ceo','Admin','Owner'].some(r=>this.auth.hasRole(r));}
  private read<T>(path:string){return firstValueFrom(this.http.get<T>(environment.apiUrl+'/'+path).pipe(timeout(20000)));}
  async prepare(id:number,selected:number|null,options:ProfilePrintOptions):Promise<PrintDocument>{
    if(!this.authorized)throw new Error('Profile access required');
    const o={...options}, p=this.printer,t=p.t;
    const [profile,raw]=await Promise.all([firstValueFrom(this.profiles.profile(id)),this.read<PatientResponse>('Patients/GetById/'+id)]);
    if(Number(raw.id)!==id)throw new Error('Patient mismatch');
    const patient=this.patients.mapToFrontendPatient(raw);
    const courses=o.allCourses?profile.courses:profile.courses.filter(c=>c.id===selected);
    if(!o.allCourses&&selected!=null&&!courses.length)throw new Error('Selected course changed');
    const recordCount=courses.reduce((n,c)=>n+(o.sessions||o.clinical?c.sessions.length:0)+(o.financial?c.payments.length:0)+(o.activity?c.activity.length:0),courses.length);
    p.limit(recordCount);
    const sections:PrintSection[]=[];
    const fields=(title:string,values:[string,PrintValue][])=>sections.push({title,fields:values.filter(([,v])=>v!==null&&v!==undefined&&v!=='').map(([k,v])=>[t(k),v])});
    const money=(v:number)=>p.locale.money(v),date=(v:string|null|undefined)=>p.date(v);
    if(o.summary)fields(t('Patient summary'),[['Name',p.locale.patientName(patient)],['Patient ID',id],['Phone',patient.phone],['Date of birth',patient.birthDate?.slice(0,10)],['Email',patient.email],['Emergency contact',patient.emergencyContact],['Insurer',patient.insuranceCompanyName],['Member ID',patient.insuranceDetails?.memberId]]);
    let plans:TreatmentPlanRecord[]=[],assessments:(AssessmentRecord&{completedAt?:string|null})[]=[];
    if(o.plan||o.clinical){
      const [a,allPlans]=await Promise.all([this.read<(AssessmentRecord&{completedAt?:string|null})[]>('Assessments/GetAll?patientId='+id),this.read<TreatmentPlanRecord[]>('TreatmentPlans/GetAll?patientId='+id)]);
      if(!Array.isArray(a)||!Array.isArray(allPlans)||a.some(x=>x.patientId!==id))throw new Error('Clinical scope mismatch');
      const assessmentIds=new Set(a.map(x=>x.id));
      plans=allPlans.filter(x=>courses.some(c=>c.id===x.id)&&assessmentIds.has(x.assessmentId));
      assessments=o.allCourses||selected===null?a:a.filter(x=>plans.some(plan=>plan.assessmentId===x.id));
      p.limit(recordCount+(o.clinical?assessments.length:0));
    }
    for(const c of courses){
      fields(`${t('Treatment course')} #${c.id} · ${c.treatmentType}`, [['Clinician',c.doctorName],['Status',p.locale.label(c.status)],['Prescribed sessions',c.prescribedSessions],['Booked sessions (including cancelled/no-show)',c.sessions.filter(s=>s.appointmentId!==null).length],['Clinically completed sessions',c.completedSessions]]);
      const plan=plans.find(x=>x.id===c.id);
      if(o.plan){
        if(!plan)throw new Error('Saved plan unavailable');
        fields(t('Saved treatment plan'),[['Frequency per week',plan.frequencyPerWeek],['Saved instructions',plan.exercises]]);
      }
      if(o.sessions){
        sections.push({title:t('Session schedule/history'),columns:['Session','Scheduled start','Scheduled end','Clinician','Room','Status'].map(t),rows:c.sessions.map(s=>[s.sessionNumber,date(s.startTime),date(s.endTime),s.doctorName,s.roomName,p.locale.label(s.status)])});
        const actual=c.sessions.filter(s=>s.receptionCheckIn||s.receptionCheckOut||s.clinicalStart||s.clinicalEnd);
        if(actual.length)sections.push({title:t('Session times'),columns:['Session','Reception arrival','Reception departure','Clinical start','Clinical end'].map(t),rows:actual.map(s=>[s.sessionNumber,date(s.receptionCheckIn),date(s.receptionCheckOut),date(s.clinicalStart),date(s.clinicalEnd)])});
      }
      if(o.clinical){
        const notes=await this.read<TreatmentPlanSessionRecord[]>('TreatmentPlanSessions/GetAll?treatmentPlanId='+c.id);
        if(!Array.isArray(notes)||notes.some(s=>s.treatmentPlanId!==c.id))throw new Error('Session scope mismatch');
        p.limit(notes.length);
        for(const s of notes.filter(s=>s.notes))fields(`${t('Session')} ${s.sessionNumber} · ${t('Notes')}`, [['Notes',s.notes]]);
      }
      if(o.financial){
        fields(t('Patient financial summary')+' · EGP',[['Patient amount',money(c.patientAmount)],['Patient paid',money(c.patientPaid)],['Patient balance',money(c.patientBalance)],['Insurer amount',money(c.insurerAmount)],['Insurer paid',money(c.insurerPaid)],['Insurer balance',money(c.insurerBalance)]]);
        sections.push({title:t('Payments'),columns:['Date','Invoice','Payer','Method','Amount'].map(t),rows:c.payments.map(r=>[date(r.date),r.invoiceNumber,t(r.payer),p.locale.label(r.method),money(r.amount)])});
      }
      if(o.activity)for(const a of c.activity)fields(t('Activity history'),[['Changed at',date(a.changedAt)],['Actor',a.actorName],['Action',a.action],['Reason',a.reason],['Previous schedule',date(a.previousStart)+' — '+date(a.previousEnd)+' · '+a.previousRoomName],['New schedule',date(a.newStart)+' — '+date(a.newEnd)+' · '+a.newRoomName],['Previous clinician',a.previousClinicianName],['Clinician',a.clinicianName],['Contact outcome',a.contactOutcome],['Consent method',a.consentMethod],['Consent recorded at',a.consentRecordedAt?date(a.consentRecordedAt):null],['Consent reason',a.consentReason]]);
    }
    if(o.clinical)for(const a of assessments)fields(t('Assessment')+' · '+date(a.assessmentDate),[['Clinician',a.seniorName],['Status',t(a.completedAt?'Completed':'Saved assessment — awaiting completion')],['Diagnosis',a.diagnosis],['Notes',a.notes]]);
    if(o.allCourses&&o.financial&&profile.assessmentPayments?.length)sections.push({title:t('Assessment')+' · '+t('Payments'),columns:['Date','Invoice','Payer','Method','Amount'].map(t),rows:profile.assessmentPayments.map(r=>[date(r.date),r.invoiceNumber,t(r.payer),p.locale.label(r.method),money(r.amount)])});
    if(o.allCourses&&o.activity)for(const a of profile.appointmentActivity??[])fields(t('Activity history'),[['Changed at',date(a.changedAt)],['Actor',a.actorName],['Reason',a.reason],['Previous schedule',date(a.previousStart)+' — '+date(a.previousEnd)],['New schedule',date(a.newStart)+' — '+date(a.newEnd)]]);
    return {title:t('Patient profile'),subtitle:p.locale.patientName(patient),scope:[t(o.allCourses?'All courses':'Selected course')+(selected!==null&&!o.allCourses?' #'+selected:''),'EGP · Africa/Cairo'],sections};
  }
}
