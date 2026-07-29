import { Component, signal, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: "app-receptionist-walk-in",
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule],
  templateUrl: "./walk-in.html"
})
export class WalkInComponent {
  patient = signal('');
  gender = signal('Male');
  timePref = signal('Now');
  bookedDoctor = signal<string | null>(null);

  hasSearched = signal(false);
  isSearching = signal(false);

  private baseResults = signal([
    { doctor: 'Dr. Sarah', doctorGender: 'Female', time: '10:30 AM', room: 'Room 1', load: 1 },
    { doctor: 'Dr. Omar', doctorGender: 'Male', time: '11:00 AM', room: 'Room 2', load: 0 },
    { doctor: 'Dr. Youssef', doctorGender: 'Male', time: '12:00 PM', room: 'Room 3', load: 1 },
  ]);

  results = computed(() => {
    return this.baseResults().filter(r => 
      (this.gender() === 'Any' || r.doctorGender === this.gender())
    );
  });

  searchSlots() {
    if (!this.patient()) return;
    this.isSearching.set(true);
    this.hasSearched.set(false);
    this.bookedDoctor.set(null);
    
    setTimeout(() => {
      this.isSearching.set(false);
      this.hasSearched.set(true);
    }, 1000);
  }

  bookSlot(doctor: string) {
    this.bookedDoctor.set(doctor);
    this.hasSearched.set(false);
  }
}
