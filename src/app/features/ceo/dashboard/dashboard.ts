import { PrintService } from '../../../shared/printing/print.service';
import { PrintButtonComponent } from '../../../shared/printing/print-button.component';
import { firstValueFrom as printValue } from 'rxjs';
import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { switchMap, catchError, of, tap } from "rxjs";
import {
  CeoWorkspaceService,
  Overview,
} from "../../../core/services/ceo-workspace.service";
import { CeoLocale } from "../workspace/ceo-locale";

@Component({
  selector: "app-ceo-dashboard",
  standalone: true,
  imports: [FormsModule, RouterLink, PrintButtonComponent],
  templateUrl: "./dashboard.html",
  styleUrl: "../workspace/workspace.css",
})
export class Dashboard {
  readonly printer = inject(PrintService);
  readonly preparePrint = async () => {
    const saved=this.data();
    if(!saved)throw new Error('Overview unavailable');
    const d=await printValue(this.api.overview({from:saved.from,to:saved.to}));
    return {title:this.t('Overview'),scope:[this.t('Collection period · Africa/Cairo')+': '+d.from+' — '+d.to],sections:[
      {title:this.t('Actual collections by Cairo day'),fields:[[this.t('Patient collections'),this.money(d.patientCollections)],[this.t('Insurer collections'),this.money(d.insurerCollections)]] as [string,string][]},
      {title:this.t('Current balances'),fields:[[this.t('Patient outstanding'),this.money(d.patientOutstanding)],[this.t('Earned insurer receivables'),this.money(d.earnedInsurerOutstanding)],[this.t('Planned insurer liability'),this.money(d.plannedInsurerLiability)]] as [string,string][]},
      {title:this.printer.t('Scheduled service period')+': '+d.from+' — '+d.to,fields:[[this.t('Scheduled visits'),d.scheduled],[this.t('Clinically completed'),d.clinicallyCompleted],[this.t('Cancelled'),d.cancelled],[this.t('NoShow'),d.noShow]] as [string,number][]},
      {title:this.t('Clinical occupancy'),fields:[[this.t('Clinical occupancy'),d.occupied],[this.t('Active room capacity'),d.activeRoomCapacity],[this.t('Available room slots'),d.availableRoomSlots],[this.t('Unsubmitted services'),d.unsubmittedServices],[this.t('Outstanding claims'),d.outstandingClaims],[this.t('Absence recovery'),d.unresolvedAbsenceWork]] as [string,number][]},
      {title:this.t('Actual collections by Cairo day'),columns:[this.t('Date'),this.t('Patient collections'),this.t('Insurer collections')],rows:d.collections.map(row=>[row.day,this.money(row.patient),this.money(row.insurer)])}
    ]};
  };
  readonly api = inject(CeoWorkspaceService);
  readonly locale = new CeoLocale();
  readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  readonly data = signal<Overview | null>(null);
  readonly loading = signal(true);
  readonly error = signal("");
  from = "";
  to = "";
  constructor() {
    this.route.queryParamMap
      .pipe(
        tap((p) => {
          this.to = p.get("to") ?? this.locale.today();
          this.from = p.get("from") ?? this.to.slice(0, 7) + "-01";
          this.loading.set(true);
          this.error.set("");
          this.data.set(null);
        }),
        switchMap(() =>
          this.api.overview({ from: this.from, to: this.to }).pipe(
            catchError((e) => {
              this.error.set(
                this.locale.failure(e, "Could not load data. Retry."),
              );
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((x) => {
        this.data.set(x);
        this.loading.set(false);
      });
  }
  t(s: string) {
    return this.locale.t(s);
  }
  money(n: number) {
    return this.locale.money(n);
  }
  apply() {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { from: this.from, to: this.to },
    });
  }
  retry() {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { from: this.from, to: this.to, retry: Date.now() },
    });
  }
  report(kind: string, period = true) {
    return {
      kind,
      ...(period ? { from: this.data()?.from, to: this.data()?.to } : {}),
    };
  }
  get chart() {
    return this.data()?.collections.filter((x) => x.patient || x.insurer) ?? [];
  }
  get chartMax() {
    return Math.max(1, ...this.chart.flatMap((x) => [x.patient, x.insurer]));
  }
}
