"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSuggestedStartTime } from "@/lib/hooks/use-suggested-start-time";
import { minutesBetween } from "@/lib/itinerary-time";
import { travelDurationIssueLabel, travelModeLabel, type TravelMode } from "@/lib/travel-mode";
import type { ItineraryItem } from "@/lib/types";

export function ScheduleConfirmDialog({
  open,
  previousItem,
  destination,
  travelMode,
  isPending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  previousItem: ItineraryItem | null;
  destination: { lat: number; lng: number } | null;
  travelMode: TravelMode | null;
  isPending: boolean;
  onConfirm: (schedule: { startTime: string | null; durationMinutes: number | null }) => void;
  /**
   * Only passed by callers that haven't written anything yet. The itinerary
   * flow omits it on purpose: there the spot already exists by the time this
   * opens, so backing out would leave it orphaned.
   */
  onCancel?: () => void;
}) {
  const [manualStartTime, setManualStartTime] = useState<string | null>(null);
  const [durationDraft, setDurationDraft] = useState("");
  const [confirmEarlyOpen, setConfirmEarlyOpen] = useState(false);

  const {
    suggested,
    travelMinutes,
    isLoading: isTravelTimeLoading,
    issue: travelTimeIssue,
  } = useSuggestedStartTime(open, previousItem, destination, travelMode);

  // Reset the manually-typed values during render (not in an effect) so a
  // stale draft from a previous spot never leaks into this one.
  const openKey =
    open && destination ? `${destination.lat},${destination.lng}:${travelMode ?? ""}` : null;
  const [trackedOpenKey, setTrackedOpenKey] = useState(openKey);
  if (openKey !== trackedOpenKey) {
    setTrackedOpenKey(openKey);
    setManualStartTime(null);
    setDurationDraft("");
  }

  // No previous spot means this is the day's first spot: its departure point,
  // which gets a departure time rather than a stay start time.
  const isDeparture = previousItem === null;
  const prevStart = previousItem?.startTime ?? null;
  const prevDuration = previousItem?.durationMinutes ?? 0;
  const startTime = manualStartTime ?? suggested ?? "";

  // A departure point has no stay, so it never carries a duration.
  const parsedDuration = durationDraft.trim() ? Number(durationDraft) : null;
  const finalDuration =
    isDeparture || parsedDuration == null || Number.isNaN(parsedDuration) ? null : parsedDuration;

  function buildSchedule() {
    return { startTime: startTime.trim() || null, durationMinutes: finalDuration };
  }

  function handleConfirmClick() {
    const schedule = buildSchedule();
    if (schedule.startTime && prevStart != null && travelMinutes != null) {
      const minFeasible = prevDuration + travelMinutes;
      const actualGap = minutesBetween(prevStart, schedule.startTime);
      if (actualGap < minFeasible) {
        setConfirmEarlyOpen(true);
        return;
      }
    }
    onConfirm(schedule);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={() => {}} disablePointerDismissal>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{isDeparture ? "出発時刻" : "滞在スケジュール"}</DialogTitle>
            <DialogDescription>
              {isDeparture
                ? "最初のスポットはこの日の出発地点です。出発時刻を設定できます。"
                : !travelMode
                ? "任意で開始時刻を設定できます。"
                : travelMinutes != null
                  ? `前のスポットから${travelModeLabel[travelMode]}で約${travelMinutes}分`
                  : isTravelTimeLoading
                    ? "移動時間を計算中..."
                    : travelDurationIssueLabel(travelTimeIssue ?? "error", travelMode)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <div className="flex gap-2">
              <div className="grid gap-2">
                <Label htmlFor="pending-schedule-start">
                  {isDeparture ? "出発時刻（任意）" : "開始時刻（任意）"}
                </Label>
                <Input
                  id="pending-schedule-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setManualStartTime(e.target.value)}
                  autoFocus
                  className="w-[140px] max-w-full"
                  style={{ width: 140 }}
                />
              </div>
              {!isDeparture && (
                <div className="grid gap-2">
                  <Label htmlFor="pending-schedule-duration">滞在時間（分）</Label>
                  <Input
                    id="pending-schedule-duration"
                    type="number"
                    min={0}
                    step={5}
                    value={durationDraft}
                    onChange={(e) => setDurationDraft(e.target.value)}
                    placeholder="例: 60"
                    className="w-[140px] max-w-full"
                    style={{ width: 140 }}
                  />
                </div>
              )}
            </div>
            {suggested && manualStartTime === null && (
              <p className="text-xs text-zinc-500">
                前のスポットの滞在終了時刻と移動時間から{suggested}を提案しています
              </p>
            )}
          </div>
          <DialogFooter>
            {onCancel && (
              <Button variant="ghost" onClick={onCancel} disabled={isPending}>
                キャンセル
              </Button>
            )}
            <Button onClick={handleConfirmClick} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              追加する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmEarlyOpen} onOpenChange={setConfirmEarlyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>開始時刻が早すぎる可能性があります</AlertDialogTitle>
            <AlertDialogDescription>
              前のスポットの滞在終了時刻と移動時間を考慮すると、現実的に厳しい時刻です
              {suggested && `（${suggested}以降が目安です）`}。このまま{startTime}
              で追加しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>修正する</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmEarlyOpen(false);
                onConfirm(buildSchedule());
              }}
            >
              このまま追加する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
