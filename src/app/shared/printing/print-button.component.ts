import { Component, Input, inject } from '@angular/core';
import { PrintService } from './print.service';
import { PrintDocument } from './print-document';

@Component({selector:'app-print-button',standalone:true,template:`
  <button type="button" (click)="printer.run(prepare)" [disabled]="disabled || printer.busy()" [attr.aria-busy]="printer.busy()">{{ printer.t(printer.busy()?'Preparing':'Print') }}</button>
  @if(printer.busy()){<span role="status">{{printer.t('Preparing')}}…</span>}
  @if(printer.error()){<p role="alert">{{printer.error()}}</p>}
`,styles:[`:host{display:inline-block}button{font:inherit;color:inherit;background:transparent;border:1px solid #668b95;border-radius:6px;padding:7px 12px;cursor:pointer}button:disabled{opacity:.6;cursor:wait}p{color:#be3248;margin:4px 0}span{margin-inline:6px}`]})
export class PrintButtonComponent {
  readonly printer=inject(PrintService);
  @Input({required:true}) prepare!:()=>Promise<PrintDocument>;
  @Input() disabled=false;
}
