import { TableLoadingComponent } from '../../../shared/table-ui/table-ui';
import { ActionButtonDirective } from '../../../shared/action-ui/action-button';
import { CeoNotifications } from "../../../core/services/ceo-notifications";
import { Component, inject, signal } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import {
  CeoWorkspaceService,
  ClinicIdentity,
} from "../../../core/services/ceo-workspace.service";
import { CeoLocale } from "../workspace/ceo-locale";

@Component({
  selector: "app-ceo-settings",
  standalone: true,
  imports: [TableLoadingComponent, ActionButtonDirective, FormsModule],
  templateUrl: "./settings.html",
  styleUrl: "../workspace/workspace.css",
})
export class Settings {
  readonly api = inject(CeoWorkspaceService);
  readonly locale = new CeoLocale();
  readonly notices = inject(CeoNotifications);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal("");
  readonly saved = signal(false);
  model: ClinicIdentity | null = null;
  constructor() {
    this.load();
  }
  t(s: string) {
    return this.locale.t(s);
  }
  load() {
    this.loading.set(true);
    this.error.set("");
    this.api.settings().subscribe({
      next: (x) => {
        this.model = x;
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(this.locale.failure(e, "Could not load data. Retry."));
      },
    });
  }
  save(form: NgForm) {
    if (this.saving()) return;
    this.saved.set(false);
    if (form.invalid || !this.model?.name.trim()) {
      form.control.markAllAsTouched();
      this.error.set(this.t("Enter the required fields."));
      return;
    }
    this.saving.set(true);
    this.error.set("");
    this.api.saveSettings(this.model).subscribe({
      next: (x) => {
        this.model = x;
        this.api.identity.set(x);
        this.saving.set(false);
        this.saved.set(true);
        form.form.markAsPristine();
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(this.locale.failure(e));
        this.notices.show(this.error());
      },
    });
  }
}
