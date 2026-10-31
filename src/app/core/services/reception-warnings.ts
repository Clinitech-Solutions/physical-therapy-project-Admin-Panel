import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ReceptionistLocale } from '../../shared/receptionist-locale';

/** Called once at the operation boundary; persistent inline errors remain visible. */
@Injectable({providedIn:'root'})
export class ReceptionWarnings {
  private messages=inject(MessageService,{optional:true});
  private locale=new ReceptionistLocale();
  show(detail:string) {
    this.messages?.add({severity:'warn',summary:this.locale.text('WARNING','Please review'),detail:this.locale.label(detail)});
  }
}
