import { Injectable, computed, inject, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, finalize, map, tap } from "rxjs";
import { environment } from "../../../environments/environment";
import { RoomRecord, RoomWriteRequest } from "../models/room-api.model";
import {
  apiError,
  finiteNumber,
  MutationState,
  numericId,
  record,
  ReceptionError,
  ReceptionEvents,
  textField,
} from "./reception-api";

export function decodeRoom(value: unknown): RoomRecord {
  const r = record(value);
  if (typeof r["isActive"] !== "boolean")
    throw new ReceptionError(
      "ROOM_RESPONSE_PENDING",
      "Room response fields need confirmation from a non-empty response.",
    );
  return {
    id: numericId(r["id"]),
    name: textField(r["name"]),
    capacity: finiteNumber(r["capacity"]),
    isActive: r["isActive"],
  };
}
@Injectable({ providedIn: "root" })
export class RoomService {
  private http = inject(HttpClient);
  private events = inject(ReceptionEvents);
  private url = `${environment.apiUrl}/Rooms`;
  readonly rooms = signal<RoomRecord[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly mutation = new MutationState();
  private generation = 0;
  /** Active records are candidates, never evidence of availability at a time. */
  readonly candidates = computed(() => this.rooms().filter((r) => r.isActive));
  list(): Observable<RoomRecord[]> {
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set(null);
    return this.http.get<unknown>(this.url).pipe(
      map((value) => {
        if (!Array.isArray(value))
          throw new ReceptionError(
            "ROOM_RESPONSE_PENDING",
            "Room response fields need confirmation from a non-empty response.",
          );
        return value.map(decodeRoom);
      }),
      tap({
        next: (rooms) => {
          if (generation === this.generation) this.rooms.set(rooms);
        },
        error: (e) => {
          if (generation === this.generation) this.error.set(apiError(e));
        },
      }),
      finalize(() => {
        if (generation === this.generation) this.loading.set(false);
      }),
    );
  }
  load() {
    this.list().subscribe({ error: () => {} });
  }
  get(id: number) {
    return this.http
      .get<unknown>(`${this.url}/${numericId(id)}`)
      .pipe(map(decodeRoom));
  }
  private validate(data: RoomWriteRequest): RoomWriteRequest {
    if (
      !data.name.trim() ||
      !Number.isInteger(data.capacity) ||
      data.capacity < 1 ||
      typeof data.isActive !== "boolean"
    ) {
      throw new ReceptionError(
        "ROOM_VALIDATION",
        "Enter a room name, a positive whole capacity and its active state.",
      );
    }
    return {
      name: data.name.trim(),
      capacity: data.capacity,
      isActive: data.isActive,
    };
  }
  create(data: RoomWriteRequest) {
    return this.mutation
      .run(() => this.http.post<unknown>(this.url, this.validate(data)))
      .pipe(tap(() => this.events.changed.next("rooms")));
  }
  update(id: number, data: RoomWriteRequest) {
    return this.mutation
      .run(() =>
        this.http.put<unknown>(
          `${this.url}/${numericId(id)}`,
          this.validate(data),
        ),
      )
      .pipe(tap(() => this.events.changed.next("rooms")));
  }
  delete(id: number) {
    return this.mutation
      .run(() => this.http.delete<unknown>(`${this.url}/${numericId(id)}`))
      .pipe(tap(() => this.events.changed.next("rooms")));
  }
  maintenance(id: number, maintenance: boolean) {
    return this.mutation
      .run(() =>
        this.http.patch<unknown>(`${this.url}/${numericId(id)}/maintenance`, {
          maintenance,
        }),
      )
      .pipe(tap(() => this.events.changed.next("rooms")));
  }
}
