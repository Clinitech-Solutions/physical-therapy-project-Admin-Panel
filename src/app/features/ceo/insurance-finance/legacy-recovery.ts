import { Component,inject,signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CourseFinanceService,FinancialIntent } from '../../../core/services/course-finance.service';
import { BookingPaymentMethod } from '../../../core/models/booking.model';
import { ReceptionistLocale } from '../../../shared/receptionist-locale';

/** Only original pre-cheque operations are exposed here; new insurer money uses the cheque screen. */
@Component({standalone:true,imports:[RouterLink],template:`<section class="card p-4"><h1>{{ text('Earlier operation recovery','استرداد عملية سابقة') }}</h1><p>{{ text('Recover the saved original operation. New insurer collections require a reviewed cheque receipt.','تحقق من العملية الأصلية المحفوظة. تتطلب التحصيلات الجديدة إيصال شيك بعد مراجعة توزيعه.') }}</p><a routerLink="/ceo/insurance">{{ text('Insurance finance','مالية التأمين') }}</a>@if(error()){<p role="alert">{{ error() }}</p>}@for(operation of finance.pendingInsurance();track operation.key){<article class="py-3"><strong>{{ operation.scope }}</strong><p>{{ operation.key }}</p><button type="button" class="btn btn-primary" [disabled]="busy()" (click)="recover(operation)">{{ text('Recover original operation','استرداد العملية الأصلية') }}</button></article>}@empty{<p>{{ text('No earlier operation needs recovery.','لا توجد عمليات سابقة تحتاج إلى الاسترداد.') }}</p>}</section>`})
export class LegacyInsuranceRecovery {
  readonly finance=inject(CourseFinanceService);readonly locale=new ReceptionistLocale();readonly busy=signal(false);readonly error=signal('');
  text(en:string,ar:string){return this.locale.language==='ar-EG'?ar:en;}
  async recover(operation:FinancialIntent){if(this.busy())return;this.busy.set(true);this.error.set('');try{const id=Number(operation.scope.split('-')[1]),body=operation.body;if(operation.scope.startsWith('claim-'))await firstValueFrom(this.finance.claim(id,operation.key,String(body['submissionReference'])));else await firstValueFrom(this.finance.settle(id,operation.key,Number(body['amount']),body['method'] as BookingPaymentMethod,String(body['settlementReference'])));}catch(e){this.error.set((e as {error?:{detail?:string}}).error?.detail ?? this.text('The original outcome still needs review. Keep its operation identity.','ما زالت النتيجة الأصلية تحتاج إلى مراجعة. احتفظ بمعرف العملية.'));}finally{this.busy.set(false);}}
}
