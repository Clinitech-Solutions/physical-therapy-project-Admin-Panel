import { Injectable, signal } from "@angular/core";
@Injectable({ providedIn: "root" })
export class CeoNotifications {
  readonly message = signal("");
  private timer: ReturnType<typeof setTimeout> | undefined;
  show(message: string) {
    clearTimeout(this.timer);
    this.message.set(message);
    this.timer = setTimeout(() => this.message.set(""), 7000);
  }
}
