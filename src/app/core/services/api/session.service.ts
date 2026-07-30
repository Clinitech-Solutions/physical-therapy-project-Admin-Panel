import { Injectable, signal } from '@angular/core';
import { Session } from '../../models/session.model';
import { mockSessions } from '../../mock-data/mock-db';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private sessionsSignal = signal<Session[]>([]);
  public sessions = this.sessionsSignal.asReadonly();
  public loading = signal<boolean>(false);

  constructor() {
    this.fetchSessions();
  }

  async fetchSessions() {
    this.loading.set(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    this.sessionsSignal.set([...mockSessions]);
    this.loading.set(false);
  }

  async updateSessionStatus(id: string, status: Session['status']) {
    this.loading.set(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    this.sessionsSignal.update(sessions => 
      sessions.map(s => s.id === id ? { ...s, status } : s)
    );
    this.loading.set(false);
  }

  async checkIn(id: string) {
    return this.updateSessionStatus(id, 'In Progress');
  }

  async checkOut(id: string) {
    return this.updateSessionStatus(id, 'Completed');
  }
}
