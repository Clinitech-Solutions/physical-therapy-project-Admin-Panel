import { Component, computed, input } from "@angular/core";

export function patientInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join("")
    .toLocaleUpperCase();
}
@Component({
  selector: "app-patient-avatar",
  standalone: true,
  template: `<span
    aria-hidden="true"
    [style.background]="palette()[0]"
    [style.color]="palette()[1]"
    >{{ initials() }}</span
  >`,
  styles: [
    `
      :host {
        display: inline-flex;
        flex-shrink: 0;
      }
      span {
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        font-size: 15px;
        font-weight: 700;
      }
    `,
  ],
})
export class PatientAvatar {
  name = input.required<string>();
  initials = computed(() => patientInitials(this.name()));
  palette = computed(() => {
    const colors = [
      ["#dff3ff", "#075789"],
      ["#d9f7ee", "#006750"],
      ["#eee8ff", "#55349a"],
      ["#ffe8ee", "#9c2852"],
    ];
    const hash = Array.from(this.name().trim()).reduce(
      (sum, c) => (sum * 31 + c.codePointAt(0)!) >>> 0,
      0,
    );
    return colors[hash % colors.length];
  });
}
