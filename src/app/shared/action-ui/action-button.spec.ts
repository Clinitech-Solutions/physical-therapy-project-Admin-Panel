import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ActionButtonDirective } from './action-button';
import { TablePagerComponent } from '../table-ui/table-ui';

@Component({standalone:true,imports:[ActionButtonDirective,TablePagerComponent],template:`<form (submit)="$event.preventDefault();submits=submits+1"><button appButton="secondary" type="button" (click)="actions=actions+1">View</button><button appButton="primary" type="submit" [actionPending]="pending">Save</button><button appButton="danger" type="button" [disabled]="locked" (click)="actions=actions+1">Cancel booking</button></form><app-table-pager [total]="total" [page]="page" [pageSize]="10" label="invoices" (pageChange)="page=$event" />`})
class Host {pending=false;submits=0;actions=0;locked=true;total=0;page=1;}

describe('shared native actions and independent pager',()=>{
 beforeEach(()=>TestBed.configureTestingModule({imports:[Host]}));
 it('preserves form ownership, non-submit actions and disabled restrictions',()=>{
  const f=TestBed.createComponent(Host);f.detectChanges();const b=f.nativeElement.querySelectorAll('form button') as NodeListOf<HTMLButtonElement>;
  b[0].click();expect(f.componentInstance.actions).toBe(1);expect(f.componentInstance.submits).toBe(0);
  b[2].click();expect(f.componentInstance.actions).toBe(1);expect(b[2].disabled).toBe(true);
  b[1].click();expect(f.componentInstance.submits).toBe(1);
 });
 it('exposes pending state without altering the caller disabled restriction or form association',()=>{
  const f=TestBed.createComponent(Host);f.detectChanges();f.componentInstance.pending=true;f.changeDetectorRef.markForCheck();f.detectChanges();
  const save=f.nativeElement.querySelector('button[type=submit]') as HTMLButtonElement;
  expect(save.getAttribute('aria-busy')).toBe('true');expect(save.form).toBeTruthy();
  expect((f.nativeElement.querySelector('button[data-action-variant=danger]') as HTMLButtonElement).disabled).toBe(true);
  f.componentInstance.pending=false;f.changeDetectorRef.markForCheck();f.detectChanges();expect(save.getAttribute('aria-busy')).toBeNull();
 });
 it('hides unnecessary controls and emits bounded page changes without submitting the form',()=>{
  const f=TestBed.createComponent(Host);f.detectChanges();expect(f.nativeElement.querySelector('app-table-pager nav')).toBeNull();
  f.componentInstance.total=1;f.changeDetectorRef.markForCheck();f.detectChanges();expect(f.nativeElement.querySelectorAll('app-table-pager button')).toHaveLength(0);
  f.componentInstance.total=23;f.changeDetectorRef.markForCheck();f.detectChanges();let b=f.nativeElement.querySelectorAll('app-table-pager button') as NodeListOf<HTMLButtonElement>;
  expect(b[0].disabled).toBe(true);b[1].click();f.detectChanges();expect(f.componentInstance.page).toBe(2);expect(f.componentInstance.submits).toBe(0);
  b[1].click();f.detectChanges();expect(f.componentInstance.page).toBe(3);expect(b[1].disabled).toBe(true);
 });
});
