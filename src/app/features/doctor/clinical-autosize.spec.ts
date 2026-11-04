import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {ClinicalAutosize} from './clinical-autosize';
@Component({standalone:true,imports:[ClinicalAutosize],template:'<textarea clinicalAutosize [value]="text"></textarea>'})
class NotesHost {text='Saved clinical text';}
describe('Responsive clinical textarea sizing',()=>{
 const original=window.matchMedia;let mobile=true;
 beforeEach(()=>{mobile=true;window.matchMedia=vi.fn().mockImplementation(()=>({matches:mobile}));});
 afterEach(()=>{window.matchMedia=original;});
 it('sizes restored text and preserves its native focus and cursor',async()=>{
   const fixture=TestBed.createComponent(NotesHost);fixture.detectChanges();const field=fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
   Object.defineProperty(field,'scrollHeight',{value:180,configurable:true});field.focus();field.setSelectionRange(2,4);
   await new Promise(resolve=>setTimeout(resolve,1));
   expect(field.style.height).toBe('182px');expect(document.activeElement).toBe(field);expect(field.selectionStart).toBe(2);expect(field.value).toBe('Saved clinical text');
 });
 it('caps mobile growth and returns to desktop sizing on orientation changes',()=>{
   const fixture=TestBed.createComponent(NotesHost);fixture.detectChanges();const node=fixture.debugElement.query(By.directive(ClinicalAutosize));const field=node.nativeElement as HTMLTextAreaElement;
   Object.defineProperty(field,'scrollHeight',{value:900,configurable:true});const directive=node.injector.get(ClinicalAutosize);directive.resize();expect(field.style.height).toBe('260px');mobile=false;directive.resize();expect(field.style.height).toBe('');expect(field.value).toBe('Saved clinical text');
 });
});
