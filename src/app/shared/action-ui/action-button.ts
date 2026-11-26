import { afterNextRender, Directive, ElementRef, inject, Input } from '@angular/core';

/** Presentation only. The caller retains disabled restrictions, form ownership and handlers. */
@Directive({selector:'button[appButton],p-button[appButton]',standalone:true,host:{class:'app-button','[attr.data-action-variant]':'appButton','[attr.data-action-size]':'actionSize','[attr.data-action-appearance]':'actionAppearance','[attr.aria-busy]':'pending || null','[attr.data-action-loader]':'hasPending && ownLoader ? true : null'}})
export class ActionButtonDirective {
  private readonly element=inject<ElementRef<HTMLElement>>(ElementRef);
  constructor(){afterNextRender(()=>{
    const host=this.element.nativeElement, button=host.tagName==='BUTTON'?host:host.querySelector('button');
    if(!button?.textContent?.trim() && !button?.getAttribute('aria-label'))return;
    button?.querySelectorAll('i:not([aria-label])').forEach(icon=>icon.setAttribute('aria-hidden','true'));
  });}
  @Input() appButton:'primary'|'secondary'|'dismiss'|'danger'='secondary';
  @Input() actionAppearance:'button'|'utility'|'identity'|'avatar'='button';
  @Input() actionSize:'regular'|'compact'='regular';
  pending=false;
  hasPending=false;
  @Input() actionLoader=true;
  get ownLoader(){return this.actionLoader && (this.element.nativeElement.tagName==='BUTTON' || !this.element.nativeElement.hasAttribute('icon'));}
  @Input() set actionPending(value:boolean){this.hasPending=true;this.pending=!!value;}
}
