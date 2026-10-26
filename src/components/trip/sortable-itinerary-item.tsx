"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { Clock, Copy, GripVertical, Loader2, StickyNote, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { addMinutesToTime, formatDuration, timeToMinutes } from "@/lib/itinerary-time";
import { useSuggestedStartTime } from "@/lib/hooks/use-suggested-start-time";
import { fetchTravelDuration } from "@/lib/travel-mode";
import type { ItineraryItem } from "@/lib/types";

export function SortableItineraryItem({
  item,
  order,
  previousItem,
  nextItem,
  readOnly,
  onRemove,
  onUpdateNotes,
  onUpdateSchedule,
}: {
  item: ItineraryItem;
  order: number;
  previousItem: ItineraryItem | null;
  nextItem: ItineraryItem | null;
  readOnly: boolean;
  onRemove: () => void;
  onUpdateNotes: (notes: string) => void;
  onUpdateSchedule: (schedule: { startTime: string | null; durationMinutes: number | null }) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, disabled: readOnly });
  // The first spot of the day is the departure point: it has a departure time
  // instead of a stay, so there's no duration to enter or display.
  const isDeparture = order === 0;
  const routesLib = useMapsLibrary("routes");

  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(item.spot.notes ?? "");
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [manualStartTime, setManualStartTime] = useState<string | null>(null);
  const [durationDraft, setDurationDraft] = useState(
    item.durationMinutes != null ? String(item.durationMinutes) : "",
  );
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [isCheckingNextSpot, setIsCheckingNextSpot] = useState(false);
  const [pendingSave, setPendingSave] = useState<{
    schedule: { startTime: string | null; durationMinutes: number | null };
    message: string;
  } | null>(null);

  // Enabled for the whole editing session (not just when startTime is unset)
  // so travelMinutes is available to validate against the previous spot even
  // when overriding an already-suggested or already-set value.
  const { suggested: suggestedStartTime, travelMinutes: travelMinutesFromPrevious } =
    useSuggestedStartTime(isEditingSchedule, previousItem, item.spot, item.travelMode);
  const startTimeDraft = manualStartTime ?? item.startTime ?? suggestedStartTime ?? "";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  function startEditing() {
    setNotesDraft(item.spot.notes ?? "");
    setIsEditingNotes(true);
  }

  function saveNotes() {
    onUpdateNotes(notesDraft.trim());
    setIsEditingNotes(false);
  }

  function startEditingSchedule() {
    setManualStartTime(null);
    setDurationDraft(item.durationMinutes != null ? String(item.durationMinutes) : "");
    setIsEditingSchedule(true);
  }

  async function saveSchedule() {
    const durationMinutes = durationDraft.trim() ? Number(durationDraft) : null;
    const finalDuration = isDeparture
      ? null
      : durationMinutes != null && !Number.isNaN(durationMinutes)
        ? durationMinutes
        : null;
    const finalStartTime = startTimeDraft.trim() || null;
    const schedule = { startTime: finalStartTime, durationMinutes: finalDuration };

    // Backward check: is this item's own new start time realistic given the
    // previous spot's stay end time and the travel time to get here?
    if (finalStartTime && previousItem?.startTime != null && travelMinutesFromPrevious != null) {
      const minFeasible = (previousItem.durationMinutes ?? 0) + travelMinutesFromPrevious;
      const actualGap = timeToMinutes(finalStartTime) - timeToMinutes(previousItem.startTime);
      if (actualGap < minFeasible) {
        setPendingSave({
          schedule,
          message: `前のスポット「${previousItem.spot.name}」の滞在終了時刻と移動時間を考慮すると、現実的に厳しい時刻です。このまま保存しますか？`,
        });
        return;
      }
    }

    // Forward check: does this new time make the next spot's already-set
    // start time unreachable?
    if (finalStartTime && nextItem?.startTime && nextItem.travelMode && routesLib) {
      setIsCheckingNextSpot(true);
      const travel = await fetchTravelDuration(
        routesLib,
        item.spot,
        nextItem.spot,
        nextItem.travelMode,
      );
      setIsCheckingNextSpot(false);
      if (travel.status === "ok") {
        const minFeasible = (finalDuration ?? 0) + travel.minutes;
        // Plain (non-wrapping) subtraction: unlike the forward-only suggestion
        // math, a negative gap here always means the next spot's existing
        // time is no longer reachable, not a legitimate next-day rollover.
        const actualGap = timeToMinutes(nextItem.startTime) - timeToMinutes(finalStartTime);
        if (actualGap < minFeasible) {
          setPendingSave({
            schedule,
            message: `この変更を保存すると、「${nextItem.spot.name}」（${nextItem.startTime}〜）までの移動時間が現実的に厳しくなる可能性があります。このまま保存しますか？`,
          });
          return;
        }
      }
    }

    onUpdateSchedule(schedule);
    setIsEditingSchedule(false);
  }

  function scheduleLabel(): string | null {
    if (isDeparture) return item.startTime ? `${item.startTime} 出発` : null;
    if (item.startTime && item.durationMinutes != null) {
      const end = addMinutesToTime(item.startTime, item.durationMinutes);
      return `${item.startTime} 〜 ${end}（${formatDuration(item.durationMinutes)}）`;
    }
    if (item.startTime) return `${item.startTime} 〜`;
    if (item.durationMinutes != null) return `（${formatDuration(item.durationMinutes)}）`;
    return null;
  }

  async function copyAddress() {
    if (!item.spot.address) return;
    try {
      await navigator.clipboard.writeText(item.spot.address);
      toast.success("住所をコピーしました");
    } catch {
      toast.error("コピーに失敗しました");
    }
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-col gap-2 overflow-hidden rounded-xl border bg-white p-2 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg dark:bg-zinc-900",
        !readOnly && "cursor-grab active:cursor-grabbing",
      )}
      {...(!readOnly ? attributes : {})}
      {...(!readOnly ? listeners : {})}
    >
      <div className="flex items-start gap-2">
        {!readOnly && (
          <GripVertical className="mt-1.5 h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
        )}
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
          {order + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            {isDeparture && (
              <Badge className="shrink-0 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                出発
              </Badge>
            )}
            <p className="truncate text-[16px] font-medium">{item.spot.name}</p>
          </div>
          {!isEditingSchedule && scheduleLabel() && (
            <p className="text-[11px] font-medium text-indigo-700 dark:text-indigo-400">
              {scheduleLabel()}
            </p>
          )}
          {item.spot.address && (
            <button
              type="button"
              onClick={copyAddress}
              onPointerDown={(e) => e.stopPropagation()}
              title="タップして住所をコピー"
              className="block w-full text-left text-[11px] leading-snug break-words text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              {item.spot.address}
              <Copy className="ml-1 inline h-3.5 w-3.5 align-text-bottom text-zinc-400 dark:text-zinc-300" />
            </button>
          )}
        </div>
        {!readOnly && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "mt-0.5 h-7 w-7 shrink-0",
                (item.startTime || item.durationMinutes != null) &&
                  "text-indigo-600 dark:text-indigo-400",
              )}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() =>
                isEditingSchedule ? setIsEditingSchedule(false) : startEditingSchedule()
              }
            >
              <Clock className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "mt-0.5 h-7 w-7 shrink-0",
                item.spot.notes && "text-indigo-600 dark:text-indigo-400",
              )}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => (isEditingNotes ? setIsEditingNotes(false) : startEditing())}
            >
              <StickyNote className="h-4 w-4" />
            </Button>
            <AlertDialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
              <AlertDialogTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-0.5 h-7 w-7 shrink-0"
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                }
              >
                <X className="h-4 w-4" />
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>「{item.spot.name}」を削除しますか？</AlertDialogTitle>
                  <AlertDialogDescription>
                    行程からこのスポットを削除します。この操作は取り消せません。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      onRemove();
                      setConfirmRemoveOpen(false);
                    }}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    削除する
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>

      {isEditingSchedule && (
        <div className="flex flex-col gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
          <div className="ml-[56px] flex gap-2">
            <div>
              <Label htmlFor={`schedule-start-${item.id}`} className="text-xs">
                {isDeparture ? "出発時刻" : "開始時刻"}
              </Label>
              <Input
                id={`schedule-start-${item.id}`}
                type="time"
                value={startTimeDraft}
                onChange={(e) => setManualStartTime(e.target.value)}
                className="h-8 w-[140px] max-w-full"
                style={{ width: 140 }}
              />
              {suggestedStartTime && !item.startTime && manualStartTime === null && (
                <p className="mt-1 text-[11px] text-zinc-500">
                  前のスポットの滞在終了時刻と移動時間から{suggestedStartTime}を提案しています
                </p>
              )}
            </div>
            {!isDeparture && (
              <div>
                <Label htmlFor={`schedule-duration-${item.id}`} className="text-xs">
                  滞在時間（分）
                </Label>
                <Input
                  id={`schedule-duration-${item.id}`}
                  type="number"
                  min={0}
                  step={5}
                  value={durationDraft}
                  onChange={(e) => setDurationDraft(e.target.value)}
                  placeholder="例: 60"
                  className="h-8 w-[140px] max-w-full"
                  style={{ width: 140 }}
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsEditingSchedule(false)}
            >
              キャンセル
            </Button>
            <Button type="button" size="sm" onClick={saveSchedule} disabled={isCheckingNextSpot}>
              {isCheckingNextSpot && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              保存
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={pendingSave !== null} onOpenChange={(open) => !open && setPendingSave(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>開始時刻が現実的に厳しい可能性があります</AlertDialogTitle>
            <AlertDialogDescription>{pendingSave?.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>修正する</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingSave) onUpdateSchedule(pendingSave.schedule);
                setPendingSave(null);
                setIsEditingSchedule(false);
              }}
            >
              このまま保存する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!isEditingNotes && item.spot.notes && (
        <button
          type="button"
          onClick={() => !readOnly && startEditing()}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "rounded-md bg-zinc-50 px-2 py-1.5 text-left text-xs whitespace-pre-wrap text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
            !readOnly && "cursor-text hover:bg-zinc-100 dark:hover:bg-zinc-700",
          )}
        >
          {item.spot.notes}
        </button>
      )}

      {isEditingNotes && (
        <div className="flex flex-col gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
          <Textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="このスポットについてのメモ"
            className="min-h-16"
            autoFocus
          />
          <div className="flex justify-end gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsEditingNotes(false)}
            >
              キャンセル
            </Button>
            <Button type="button" size="sm" onClick={saveNotes}>
              保存
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
