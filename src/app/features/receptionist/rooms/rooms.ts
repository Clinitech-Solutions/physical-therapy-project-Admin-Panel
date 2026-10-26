import { Component, OnInit, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TranslateModule } from "@ngx-translate/core";
import { DialogModule } from "primeng/dialog";
import { MessageService } from "primeng/api";
import { firstValueFrom, Observable } from "rxjs";
import { ReceptionistLocale } from "../../../shared/receptionist-locale";
import { RoomService } from "../../../core/services/room.service";
import {
  RoomRecord,
  RoomWriteRequest,
} from "../../../core/models/room-api.model";
import { apiError } from "../../../core/services/reception-api";

@Component({
  selector: "app-receptionist-rooms",
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, DialogModule],
  templateUrl: "./rooms.html",
  styleUrl: "./rooms.css",
})
export class RoomsComponent implements OnInit {
  readonly locale = new ReceptionistLocale();
  readonly roomService = inject(RoomService);
  private messages = inject(MessageService);
  readonly rooms = this.roomService.rooms;
  readonly loading = this.roomService.loading;
  readonly error = this.roomService.error;
  readonly isSubmitting = this.roomService.mutation.busy;
  readonly isAddRoomModalOpen = signal(false);
  readonly formError = signal("");
  editingId: number | null = null;
  newRoom: RoomWriteRequest = { name: "", capacity: 1, isActive: true };
  ngOnInit() {
    this.retry();
  }
  retry() {
    this.roomService.load();
  }
  openAddRoomModal() {
    this.editingId = null;
    this.newRoom = { name: "", capacity: 1, isActive: true };
    this.formError.set("");
    this.isAddRoomModalOpen.set(true);
  }
  closeAddRoomModal() {
    if (!this.isSubmitting()) this.isAddRoomModalOpen.set(false);
  }
  async edit(room: RoomRecord) {
    this.formError.set("");
    try {
      const current = await firstValueFrom(this.roomService.get(room.id));
      this.editingId = current.id;
      this.newRoom = {
        name: current.name,
        capacity: current.capacity,
        isActive: current.isActive,
      };
      this.isAddRoomModalOpen.set(true);
    } catch (error) {
      this.formError.set(apiError(error));
    }
  }
  async saveNewRoom() {
    if (this.isSubmitting()) return;
    const request =
      this.editingId === null
        ? this.roomService.create(this.newRoom)
        : this.roomService.update(this.editingId, this.newRoom);
    await this.perform(request, true);
  }
  async delete(room: RoomRecord) {
    if (
      this.isSubmitting() ||
      !confirm(this.locale.text("DELETE_ROOM_CONFIRM", "Delete this room?"))
    )
      return;
    await this.perform(this.roomService.delete(room.id));
  }
  async setMaintenance(room: RoomRecord, maintenance: boolean) {
    if (!this.isSubmitting())
      await this.perform(this.roomService.maintenance(room.id, maintenance));
  }
  private async perform(request: Observable<unknown>, close = false) {
    this.formError.set("");
    try {
      await firstValueFrom(request);
    } catch (error) {
      this.formError.set(apiError(error));
      return;
    }
    if (close) this.closeAddRoomModal();
    this.messages.add({
      severity: "success",
      summary: this.locale.text("SUCCESS", "Success"),
      detail: this.locale.text(
        "ROOM_OPERATION_SAVED",
        "Room change saved. The list will refresh separately.",
      ),
    });
    this.retry();
  }
}
