import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ClinicIdentity } from '../../core/services/ceo-workspace.service';
import { ReceptionistLocale } from '../receptionist-locale';
import { PrintDocument, PrintSection, PRINT_ROW_LIMIT, parsePrintCsv, renderPrintDocument } from './print-document';

const arabic: Record<string,string> = {
  Row:'السجل', 'No saved values':'لا توجد قيم محفوظة',
  'Booked sessions (including cancelled/no-show)':'الجلسات المحجوزة (بما فيها الملغاة وعدم الحضور)',
  'Lifetime insurer receipts against the selected services. Receipt-date filters apply only to receipt history.':'متحصلات التأمين طوال المدة مقابل الخدمات المحددة. فلاتر تاريخ التحصيل تخص سجل المتحصلات فقط.',
  'Emergency contact':'جهة اتصال الطوارئ', 'Member ID':'رقم العضوية', 'Frequency per week':'عدد الجلسات أسبوعياً',
  'Action':'الإجراء', 'Previous clinician':'المعالج السابق', 'Contact outcome':'نتيجة التواصل',
  'Consent method':'طريقة الموافقة', 'Consent recorded at':'تاريخ تسجيل الموافقة', 'Consent reason':'سبب الموافقة',
  'Collection date':'تاريخ التحصيل', 'Service delivery date':'تاريخ تقديم الخدمة', 'Invoice date':'تاريخ الفاتورة',
  'Current balance':'الرصيد الحالي', 'Scheduled service start':'بداية الخدمة المجدولة',
  'Collection':'التحصيل', 'Service':'الخدمة', 'Clinic timezone':'التوقيت المحلي للعيادة',
  'All matching records; page parameters do not limit export':'جميع السجلات المطابقة؛ دون الاقتصار على صفحة الشاشة',
  'All matching records; collections show payment allocations, not extra receipt headers':'جميع السجلات المطابقة؛ التحصيل يعرض توزيعات المدفوعات',
  'Recorded clinical seconds':'الثواني السريرية المسجلة',
  Print:'طباعة', Preparing:'جارٍ تجهيز الطباعة', 'Print options':'خيارات الطباعة', Cancel:'إلغاء',
  'Patient summary':'ملخص المريض', 'Saved treatment plan':'خطة العلاج المحفوظة', 'Session schedule/history':'جدول الجلسات وسجلها',
  'Clinical notes/assessment history':'الملاحظات والتقييمات السريرية', 'Patient financial summary':'الملخص المالي للمريض',
  'Activity history':'سجل النشاط', 'All courses':'جميع الدورات العلاجية', 'Selected course':'الدورة العلاجية المحددة',
  'Patient profile':'ملف المريض', 'Summary':'الملخص', 'Report rows':'سجلات التقرير', 'Applied filters':'الفلاتر المطبقة',
  'No additional filters':'دون فلاتر إضافية', 'Service period':'فترة تقديم الخدمة', 'Collection period':'فترة التحصيل',
  'Current balances':'الأرصدة الحالية', 'Scheduled service period':'فترة الخدمة المجدولة',
  'Patient':'المريض', 'Patient ID':'رقم المريض', 'Phone':'الهاتف', 'Funding':'جهة التمويل', 'Companies':'الشركات',
  'Invoices':'الفواتير', 'Agreed':'المتفق عليه', 'Patient liability':'التزام المريض', 'Lifetime patient receipts':'متحصلات المريض طوال المدة',
  'Patient remaining':'المتبقي على المريض', 'Collected in period':'المحصل في الفترة', 'Patient status':'حالة المريض',
  'Invoice fully settled':'الفاتورة مسددة بالكامل', 'Reference':'المرجع', 'Reference / operation':'المرجع / العملية',
  'Invoice UTC':'تاريخ الفاتورة', 'Delivery UTC':'تاريخ الخدمة', 'Historical company':'الشركة المسجلة',
  'Pricing':'التسعير', 'Type':'النوع', 'Invoice status':'حالة الفاتورة', 'Original patient share':'حصة المريض الأصلية',
  'Insurer share':'حصة شركة التأمين', 'Actual clinician':'المعالج الفعلي', 'Clinician':'المعالج',
  'Date UTC':'التاريخ', 'Amount':'المبلغ', 'Collected':'المحصل', 'Remaining':'المتبقي', 'Status':'الحالة', 'Method':'الطريقة',
  'Scheduled end UTC':'نهاية الموعد', 'Arrival UTC':'الوصول للاستقبال', 'Departure UTC':'المغادرة من الاستقبال',
  'Clinical start UTC':'بدء العلاج الفعلي', 'Clinical end UTC':'انتهاء العلاج الفعلي', 'Recorded seconds':'الثواني المسجلة',
  'Visits':'الزيارات', 'Clinically completed':'المكتمل سريرياً', 'Missing clinical timestamps':'أوقات سريرية غير متوفرة',
  'Matching rows':'السجلات المطابقة', 'Receipt count':'عدد المتحصلات', 'Matching patients':'المرضى المطابقون', 'Matching invoices':'الفواتير المطابقة',
  'Planned insurer liability':'التزام التأمين المخطط', 'Earned insurer receivables':'مستحقات التأمين المكتسبة',
  'Submitted claims':'المطالبات المقدمة', 'Actual insurer receipts':'متحصلات التأمين الفعلية', 'Earned outstanding balance':'الرصيد المكتسب المستحق',
  'Date basis':'أساس التاريخ', 'Scope':'النطاق', 'Currency':'العملة', 'From':'من', 'To':'إلى',
  'Name':'الاسم', 'Date of birth':'تاريخ الميلاد', 'Email':'البريد الإلكتروني', 'Insurer':'شركة التأمين',
  'Prescribed sessions':'الجلسات الموصوفة', 'Booked sessions':'الجلسات المحجوزة', 'Clinically completed sessions':'الجلسات المكتملة سريرياً',
  'Treatment course':'دورة العلاج', 'Diagnosis':'التشخيص', 'Saved instructions':'التعليمات المحفوظة', 'Notes':'الملاحظات',
  'Session':'الجلسة', 'Scheduled start':'بداية الموعد', 'Scheduled end':'نهاية الموعد', 'Room':'الغرفة',
  'Reception arrival':'الوصول للاستقبال', 'Reception departure':'المغادرة من الاستقبال', 'Clinical start':'بداية العلاج', 'Clinical end':'نهاية العلاج',
  'Patient amount':'المبلغ على المريض', 'Patient paid':'مدفوعات المريض', 'Patient balance':'رصيد المريض',
  'Insurer amount':'المبلغ على التأمين', 'Insurer paid':'مدفوعات التأمين', 'Insurer balance':'رصيد التأمين',
  'Session times':'أوقات الجلسات', 'Payments':'المدفوعات', 'Date':'التاريخ', 'Payer':'الدافع', 'Invoice':'الفاتورة',
  'Assessment':'التقييم', 'Completed':'مكتمل', 'Saved assessment — awaiting completion':'تقييم محفوظ — في انتظار الإكمال',
  'Changed at':'تاريخ التغيير', 'Actor':'بواسطة', 'Reason':'السبب', 'Previous schedule':'الموعد السابق', 'New schedule':'الموعد الجديد',
};

@Injectable({providedIn:'root'})
export class PrintService {
  private readonly http = inject(HttpClient);
  readonly locale = new ReceptionistLocale();
  readonly busy = signal(false);
  readonly error = signal('');
  t = (text: string) => this.locale.language.startsWith('ar') ? arabic[text] ?? this.locale.label(text) : text.replace(/ UTC$/,' (Africa/Cairo)');
  date(value: string|null|undefined,compact=false) {
    if (!value) return '—';
    // API DateTimes without an offset represent UTC, just as in the existing app.
    const date = new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(value)?value:value+'Z');
    if (!Number.isFinite(date.getTime())) throw new Error('Invalid saved date');
    if(compact)return new Intl.DateTimeFormat(this.locale.language,{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);
    return new Intl.DateTimeFormat(this.locale.language,{timeZone:'Africa/Cairo',weekday:'short',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(date);
  }
  limit(count:number) {
    if (count > PRINT_ROW_LIMIT) throw new Error(this.locale.language.startsWith('ar')
      ? `حد الطباعة ${PRINT_ROW_LIMIT} سجل. يرجى تضييق الفلاتر ثم إعادة المحاولة.`
      : `Printing supports up to ${PRINT_ROW_LIMIT} records. Please narrow the filters and try again.`);
  }
  /** Every CSV is the existing full-scope authorized export, in its existing sort order. */
  async csv(blob:Blob,title:string,scope:string[],kind?:string):Promise<PrintDocument> {
    const rows = parsePrintCsv(await blob.text());
    const start = rows.findIndex(r=>r[0]==='Patient ID' || r[0]==='Invoice ID' || r[0]==='ID');
    if (start < 0) throw new Error('Unrecognized export contract');
    const headers=rows[start], data=rows.slice(start+1);
    this.limit(data.length);
    if(data.some(r=>r.length!==headers.length))throw new Error('Incomplete export');
    const excluded = new Set(['ID','Clinician ID','Company ID','Invoice ID','Account','Plan']);
    const reportColumns:Record<string,string[]>={
      'patient-collections':['Reference / operation','Patient','Patient ID','Historical company','Date UTC','Amount','Method','Status'],
      'insurer-collections':['Reference / operation','Patient','Patient ID','Historical company','Date UTC','Amount','Method','Status'],
      'patient-outstanding':['Reference / operation','Patient','Patient ID','Historical company','Date UTC','Amount','Collected','Remaining','Status'],
      'insurer-receivables':['Reference / operation','Patient','Patient ID','Historical company','Date UTC','Amount','Collected','Remaining','Status'],
      activity:['Reference / operation','Patient','Patient ID','Clinician','Date UTC','Scheduled end UTC','Arrival UTC','Departure UTC','Clinical start UTC','Clinical end UTC','Recorded seconds','Status'],
      workload:['Clinician','Visits','Clinically completed','Recorded seconds','Missing clinical timestamps'],
    };
    const columns=kind?reportColumns[kind]:undefined;
    const printable=headers.map((h,i)=>({h,i})).filter(x=>!excluded.has(x.h)&&(!columns||columns.includes(x.h)));
    const empty=printable.filter(x=>data.length>0&&data.every(r=>!r[x.i]));
    const indices=printable.filter(x=>!empty.includes(x));
    const value = (v:string,h:string) => /UTC$/.test(h)&&v?this.date(v,true):/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(v)?'—':v||'—';
    const summary: [string,string][]=[];
    for(const row of rows.slice(0,start)) {
      if (['Clinic','Filters','Applied filters','Generated UTC','Exported UTC','Report'].includes(row[0])) continue;
      for(let i=0;i<row.length;i+=2)if(row[i])summary.push([this.t(row[i]),['Date basis','Scope'].includes(row[i])?this.t(row[i+1]):row[i+1]||'—']);
    }
    const countLabel=headers[0]==='ID'?'Matching rows':headers[0]==='Patient ID'?'Matching patients':'Matching invoices';
    const count=summary.find(([label])=>label===this.t(countLabel));
    if(count && Number(count[1])!==data.length)throw new Error('Export count mismatch');
    const sections:PrintSection[]=[];
    // Split wide exports into readable tables with repeated identity columns.
    // Report-specific columns are explicit; billing retains every business column.
    const anchors=indices.filter(x=>['Patient','Reference','Reference / operation'].includes(x.h)).slice(0,2);
    const other=indices.filter(x=>!anchors.includes(x));
    const size=8-anchors.length, bands=data.length?Math.max(1,Math.ceil(other.length/size)):1;
    for(let band=0;band<bands;band++){
      const columns=[...anchors,...other.slice(band*size,(band+1)*size)];
      sections.push({title:`${this.t('Report rows')}${bands>1?' · '+(band+1)+'/'+bands:''}`,columns:[this.t('Row'),...columns.map(x=>this.t(x.h))],rows:data.map((r,n)=>[n+1,...columns.map(x=>value(r[x.i],x.h))])});
    }
    if(empty.length)sections.push({title:this.t('No saved values'),paragraphs:[empty.map(x=>this.t(x.h)).join(' · ')]});
    sections.push({title:this.t('Summary'),totals:summary});
    return {title,scope:[...scope,`${this.t('Matching rows')}: ${data.length} · EGP · Africa/Cairo`],landscape:indices.length>6,sections};
  }
  async run(prepare:()=>Promise<PrintDocument>):Promise<void> {
    if(this.busy())return;
    this.busy.set(true);this.error.set('');
    let frame:HTMLIFrameElement|undefined;
    const focusBefore=document.activeElement as HTMLElement|null;
    try {
      let preparationTimer:ReturnType<typeof setTimeout>|undefined;
      const timeoutPreparation=new Promise<never>((_,reject)=>{preparationTimer=setTimeout(()=>reject(new Error('Print preparation timed out')),60000);});
      let model:PrintDocument,identity:ClinicIdentity;
      try {
        [model,identity]=await Promise.race([Promise.all([prepare(),firstValueFrom(this.http.get<ClinicIdentity>(environment.apiUrl+'/clinic-identity').pipe(timeout(20000)))]),timeoutPreparation]);
      } finally {clearTimeout(preparationTimer);}
      if(!identity?.name?.trim())throw new Error('Clinic identity unavailable');
      const html=renderPrintDocument(model,identity,this.locale.language);
      frame=document.createElement('iframe');frame.title=model.title;
      frame.setAttribute('aria-hidden','true');frame.style.cssText='position:fixed;left:-10000px;top:0;width:210mm;height:1px;border:0;pointer-events:none';
      const ready=new Promise<void>((resolve,reject)=>{frame!.onload=()=>resolve();frame!.onerror=()=>reject(new Error('Print document failed'));});
      frame.srcdoc=html;document.body.appendChild(frame);await ready;
      const doc=frame.contentDocument!, win=frame.contentWindow!;
      await doc.fonts.ready;
      await Promise.all(Array.from(doc.images).map(img=>img.decode()));
      await new Promise<void>(resolve=>win.requestAnimationFrame(()=>win.requestAnimationFrame(()=>resolve())));
      await new Promise<void>((resolve,reject)=>{
        let timer:ReturnType<typeof setTimeout>;
        const finished=()=>{clearTimeout(timer);win.removeEventListener('afterprint',finished);resolve();};
        win.addEventListener('afterprint',finished,{once:true});
        // Bound the lifetime of private content if a browser omits afterprint.
        timer=setTimeout(finished,120000);
        try{win.print();}catch(e){clearTimeout(timer);reject(e);}
      });
    } catch(e) {
      const limit=e instanceof Error&&(/Printing supports|حد الطباعة/.test(e.message));
      this.error.set(limit?(e as Error).message:this.locale.language.startsWith('ar')?'تعذر تجهيز الطباعة. لم تتغير الشاشة. يرجى إعادة المحاولة.':'Could not prepare printing. Your screen is unchanged. Please try again.');
    } finally {
      frame?.remove();this.busy.set(false);if(focusBefore?.isConnected)focusBefore.focus({preventScroll:true});
    }
  }
}
