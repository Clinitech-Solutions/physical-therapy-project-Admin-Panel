import { ActionButtonDirective } from '../action-ui/action-button';
import { Component, Input, inject } from '@angular/core';
import { PrintService } from './print.service';
import { PrintDocument } from './print-document';

@Component({imports:[ActionButtonDirective],selector:'app-print-button',standalone:true,template:`
  <button [actionPending]="printer.busy()" [actionLoader]="false" appButton="secondary" type="button" (click)="printer.run(prepare)" [disabled]="disabled || printer.busy()" [attr.aria-busy]="printer.busy()"><i class="bi" [class.bi-printer]="!printer.busy()" [class.bi-hourglass-split]="printer.busy()" aria-hidden="true"></i>{{ printer.t('Print') }}</button>
  @if(printer.busy()){<span class="print-status" role="status">{{printer.t('Preparing')}}…</span>}
  @if(printer.error()){<p role="alert">{{printer.error()}}</p>}
`,styles:[`:host{display:inline-block}p{color:#be3248;margin:4px 0}.print-status{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}`]})
export class PrintButtonComponent {
  readonly printer=inject(PrintService);
  @Input({required:true}) prepare!:()=>Promise<PrintDocument>;
  @Input() disabled=false;
}
