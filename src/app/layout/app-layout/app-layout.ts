import { ActionButtonDirective } from '../../shared/action-ui/action-button';
import { Component, inject } from '@angular/core';
import { CeoNotifications } from '../../core/services/ceo-notifications';
import { LanguageService } from '../../core/services/language';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [ActionButtonDirective, RouterOutlet, Sidebar, Topbar, TranslateModule],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.css',
})
export class AppLayoutComponent { readonly notices=inject(CeoNotifications);readonly language=inject(LanguageService); }
