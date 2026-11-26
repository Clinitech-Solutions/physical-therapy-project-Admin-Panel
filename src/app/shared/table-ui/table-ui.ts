import { ActionButtonDirective } from '../action-ui/action-button';
import { afterNextRender, Component, Directive, ElementRef, EventEmitter, inject, Input, OnDestroy, Output } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Component({imports:[ActionButtonDirective],selector:'app-table-empty',standalone:true,template:`<div class="table-empty" [class.compact]="compact" role="status"><i class="bi bi-inbox" aria-hidden="true"></i><strong>{{ar?'لا توجد سجلات':'No records found'}}</strong>@if(hint){<p>{{hint}}</p>}@if(canClear){<button appButton="secondary" type="button" (click)="clear.emit()">{{ar?'مسح الفلاتر':'Clear filters'}}</button>}<ng-content /></div>`,styles:[`:host{display:block;min-width:0}.table-empty{min-height:170px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;padding:24px 16px;color:var(--text-secondary);text-align:center}.table-empty.compact{min-height:112px;padding:18px 12px}.table-empty>i{font-size:36px;line-height:1;color:var(--text-secondary);opacity:.7}.table-empty strong{font-size:15px;font-weight:600;color:var(--text-primary)}p{font-size:13px;max-width:48ch;margin:0;overflow-wrap:anywhere}button{font:inherit;padding:8px 12px;min-height:40px;border:1px solid var(--border-color);border-radius:7px;background:var(--bg-card);color:var(--text-primary)}`]})
export class TableEmptyComponent {
  private readonly translate=inject(TranslateService,{optional:true});
  get ar(){return this.translate?.currentLang==='ar';}
  @Input() compact=false; @Input() hint=''; @Input() canClear=false;
  @Output() clear=new EventEmitter<void>();
}

@Component({selector:'app-table-loading',standalone:true,template:`<div class="table-loading" role="status" aria-live="polite" [attr.aria-label]="ar?'جارٍ تحميل السجلات':'Loading records'"><span>{{ar?'جارٍ تحميل السجلات':'Loading records'}}…</span><div aria-hidden="true"></div><div aria-hidden="true"></div><div aria-hidden="true"></div></div>`,styles:[`:host{display:block}.table-loading{padding:16px;display:grid;gap:10px;color:var(--text-secondary);font-size:13px}.table-loading div{height:12px;border-radius:4px;background:var(--border-color);opacity:.55;max-width:100%;animation:table-pulse 1.4s ease-in-out infinite}.table-loading div:nth-child(3){width:83%}.table-loading div:nth-child(4){width:91%}@keyframes table-pulse{50%{opacity:.25}}@media(prefers-reduced-motion:reduce){.table-loading div{animation:none}}`]})
export class TableLoadingComponent {private readonly translate=inject(TranslateService,{optional:true});get ar(){return this.translate?.currentLang==='ar';}}

@Component({imports:[ActionButtonDirective],selector:'app-table-pager',standalone:true,template:`@if(total>0){<nav [attr.aria-label]="recordLabel" [class.compact]="compact"><span>{{total}} {{recordLabel}}</span>@if(pages>1){<span class="page-count">{{ar?'صفحة':'Page'}} {{page}} {{ar?'من':'of'}} {{pages}}</span><button appButton="secondary" type="button" (click)="pageChange.emit(page-1)" [disabled]="disabled || page<=1" [attr.aria-label]="recordLabel+' · '+(ar?'الصفحة السابقة':'Previous page')">{{ar?'السابق':'Previous'}}</button><button appButton="secondary" type="button" (click)="pageChange.emit(page+1)" [disabled]="disabled || page>=pages" [attr.aria-label]="recordLabel+' · '+(ar?'الصفحة التالية':'Next page')">{{ar?'التالي':'Next'}}</button>}</nav>}`,styles:[`:host{display:block;min-width:0}nav{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:8px 12px;padding:12px 4px;color:var(--text-secondary);font-size:13px;font-variant-numeric:tabular-nums}nav.compact{font-size:12px;padding:10px 4px}.page-count{margin-inline-start:auto}button{min-height:40px;min-width:44px;font:inherit;border:1px solid var(--border-color);border-radius:7px;background:var(--bg-card);color:var(--text-primary);padding:7px 12px}button:disabled{opacity:.5}button:focus-visible{outline:3px solid var(--mq-teal);outline-offset:2px}@media(max-width:600px){button{min-height:44px}nav{justify-content:space-between}}`]})
export class TablePagerComponent {
  private readonly translate=inject(TranslateService,{optional:true});get ar(){return this.translate?.currentLang==='ar';}
  @Input() total=0;@Input() page=1;@Input() pageSize=20;@Input() label='';@Input() compact=false;@Input() disabled=false;
  @Output() pageChange=new EventEmitter<number>();
  get recordLabel(){return !this.label || this.label==='Records' ? (this.ar?'\u0633\u062c\u0644\u0627\u062a':'records') : this.label;}
  get pages(){return Math.max(1,Math.ceil(this.total/Math.max(1,this.pageSize)));}
}

/** Opt-in presentation only: the table keeps Angular ownership and native columns. */
@Directive({selector:'table[appTable]',standalone:true,host:{class:'ui-data-table','[attr.data-ui-table]':'appTable','[attr.data-card-size]':'cardSize'}})
export class TablePresentationDirective implements OnDestroy {
  @Input() appTable:'scroll'|'cards'='scroll';
  @Input() cardSize:'wide'|'medium'|'narrow'='medium';
  private readonly element=inject<ElementRef<HTMLTableElement>>(ElementRef);
  private observer?:MutationObserver;
  constructor(){afterNextRender(()=>{this.enhance();this.observer=new MutationObserver(()=>this.enhance());this.observer.observe(this.element.nativeElement,{childList:true,subtree:true,characterData:true});});}
  private enhance(){
    const table=this.element.nativeElement,headers=Array.from(table.tHead?.rows[0]?.cells??[]);
    headers.forEach(h=>h.setAttribute('scope','col'));
    const rows=Array.from(table.tBodies).flatMap(b=>Array.from(b.rows));
    for(const row of rows){
      if(row.cells.length!==headers.length)continue;
      Array.from(row.cells).forEach((cell,i)=>{
        if(cell.colSpan>1)return;
        const label=headers[i]?.textContent?.trim()??'';
        if(!cell.hasAttribute('data-label') || cell.hasAttribute('data-ui-label')){cell.setAttribute('data-label',label);cell.setAttribute('data-ui-label','');}
        if(cell.classList.contains('amount')||/\bEGP\b|ج\.?م|^\s*[\d٠-٩.,٬٫]+\s*$/.test(cell.textContent?.trim()??'')){
          cell.classList.add('ui-money');headers[i]?.classList.add('ui-money');
        }
        if(i===headers.length-1&&cell.querySelector('button,a')){cell.classList.add('ui-actions');headers[i]?.classList.add('ui-actions');}
      });
    }
  }
  ngOnDestroy(){this.observer?.disconnect();}
}

@Directive({selector:'[appTableRegion]',standalone:true,host:{class:'ui-table-scroll',role:'region',tabindex:'0','[attr.aria-label]':'label'}})
export class TableRegionDirective {
  private readonly translate=inject(TranslateService,{optional:true});
  get label(){return this.translate?.currentLang==='ar'?'السجلات — تمرير أفقي عند الحاجة':'Records — scroll horizontally when needed';}
}

export const TABLE_UI=[TableEmptyComponent,TableLoadingComponent,TablePagerComponent,TablePresentationDirective,TableRegionDirective] as const;
