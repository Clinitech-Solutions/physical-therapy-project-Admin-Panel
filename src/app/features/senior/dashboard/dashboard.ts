import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { LanguageService } from "../../../core/services/language";
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: "app-senior-dashboard",
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: "./dashboard.html",
  styleUrl: "./dashboard.css",
})
export class Dashboard {
  langService = inject(LanguageService);
}
