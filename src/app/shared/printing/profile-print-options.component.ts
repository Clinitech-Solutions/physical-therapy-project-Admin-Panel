import { Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { PrintButtonComponent } from './print-button.component';
import { PatientProfilePrintService, ProfilePrintOptions } from './patient-profile-print.service';

@Component({selector:'app-profile-print-options',standalone:true,imports:[FormsModule,DialogModule,PrintButtonComponent],template:`
<p-dialog [visible]="visible" (visibleChange)="visibleChange.emit($event)" [header]="printer.t('Print options')" [modal]="true" appendTo="body" [draggable]="false" [resizable]="false" [style]="{width:'440px',maxWidth:'calc(100vw - 24px)'}">
  <div class="print-options" [attr.dir]="printer.locale.language.startsWith('ar')?'rtl':'ltr'">
    <label><input type="checkbox" [(ngModel)]="options.allCourses">{{printer.t('All courses')}}</label>
    @if(!options.allCourses){<p>{{printer.t('Selected course')}} {{courseId===null?'—':'#'+courseId}}</p>}
    <label><input type="checkbox" [(ngModel)]="options.summary">{{printer.t('Patient summary')}}</label>
    @if(profiles.authorized){<label><input type="checkbox" [(ngModel)]="options.plan">{{printer.t('Saved treatment plan')}}</label>}
    <label><input type="checkbox" [(ngModel)]="options.sessions">{{printer.t('Session schedule/history')}}</label>
    @if(profiles.authorized){
      <label><input type="checkbox" [(ngModel)]="options.clinical">{{printer.t('Clinical notes/assessment history')}}</label>
      <label><input type="checkbox" [(ngModel)]="options.financial">{{printer.t('Patient financial summary')}}</label>
    }
    <label><input type="checkbox" [(ngModel)]="options.activity">{{printer.t('Activity history')}}</label>
    <footer><button type="button" (click)="visibleChange.emit(false)">{{printer.t('Cancel')}}</button><app-print-button [prepare]="prepare" [disabled]="!hasSections" /></footer>
  </div>
</p-dialog>`,styles:[`.print-options{color:var(--text-color,inherit)}label{display:flex;align-items:center;gap:10px;padding:8px 0;font-weight:normal}input{width:17px;height:17px;accent-color:#157e87}p{font-size:.9rem;margin:0 0 8px}footer{display:flex;gap:10px;align-items:start;justify-content:flex-end;margin-top:16px}button{font:inherit;color:inherit;background:transparent;border:1px solid #668b95;border-radius:6px;padding:7px 12px}`]})
export class ProfilePrintOptionsComponent implements OnChanges {
  readonly profiles=inject(PatientProfilePrintService);
  readonly printer=this.profiles.printer;
  @Input() visible=false;
  @Output() visibleChange=new EventEmitter<boolean>();
  @Input({required:true}) patientId!:number;
  @Input() courseId:number|null=null;
  options:ProfilePrintOptions={summary:true,plan:true,sessions:true,clinical:true,financial:true,activity:false,allCourses:false};
  get hasSections(){return Object.entries(this.options).some(([k,v])=>k!=='allCourses'&&v);}
  ngOnChanges(){if(this.visible)this.printer.error.set('');}
  readonly prepare=()=>this.profiles.prepare(this.patientId,this.courseId,{...this.options});
}
