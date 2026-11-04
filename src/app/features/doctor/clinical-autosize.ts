import { AfterViewInit, Directive, ElementRef, HostListener, OnDestroy, inject } from '@angular/core';

/** Resize the existing field, preserving its value, selection and native focus. */
@Directive({selector: 'textarea[clinicalAutosize]', standalone: true})
export class ClinicalAutosize implements AfterViewInit, OnDestroy {
  private element = inject(ElementRef<HTMLTextAreaElement>);
  private initial?: ReturnType<typeof setTimeout>;
  ngAfterViewInit() { this.initial=setTimeout(()=>this.resize(),0); }
  ngOnDestroy() { clearTimeout(this.initial); }
  @HostListener('input')
  @HostListener('window:resize')
  resize() {
    if(typeof window==='undefined') return;
    const field=this.element.nativeElement;
    field.style.removeProperty('height');
    if(window.matchMedia('(max-width:767px)').matches) {
      field.style.height='auto';
      field.style.height=Math.min(260,Math.max(100,field.scrollHeight+2))+'px';
    }
  }
}
