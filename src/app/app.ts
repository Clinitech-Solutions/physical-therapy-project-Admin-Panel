import { Component, signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { TranslateModule } from '@ngx-translate/core';
import { PatientPaymentGateComponent } from './shared/components/patient-payment-gate';
import { SessionPaymentPrompt } from './core/services/session-payment-prompt';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastModule, TranslateModule, PatientPaymentGateComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly finance = inject(SessionPaymentPrompt);
  protected readonly title = signal('pysical-therapy-project');
}
