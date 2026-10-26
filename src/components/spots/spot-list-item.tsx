"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, StickyNote, X } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { HintBubble } from "@/components/onboarding/hint-bubble";
import { cn } from "@/lib/utils";
import type { SavedSpot } from "@/lib/types";
import { AddToTripDialog } from "./add-to-trip-dialog";

export function SpotListItem({
  spot,
  order,
  readOnly = false,
  onRemove,
  onUpdateNotes,
}: {
  spot: SavedSpot;
  order: number;
  readOnly?: boolean;
  onRemove: () => void;
  onUpdateNotes: (notes: string) => void;
}) {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(spot.notes ?? "");
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

  function startEditing() {
    setNotesDraft(spot.notes ?? "");
    setIsEditingNotes(true);
  }

  function saveNotes() {
    onUpdateNotes(notesDraft.trim());
    setIsEditingNotes(false);
  }

  async function copyAddress() {
    if (!spot.address) return;
    try {
      await navigator.clipboard.writeText(spot.address);
      toast.success("住所をコピーしました");
    } catch {
      toast.error("コピーに失敗しました");
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-xl border bg-white p-2 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg dark:bg-zinc-900">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
          {order + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{spot.name}</p>
          {spot.address && (
            <button
              type="button"
              onClick={copyAddress}
              title="タップして住所をコピー"
              className="block w-full text-left text-[11px] leading-snug break-words text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              {spot.address}
              <Copy className="ml-1 inline h-2.5 w-2.5 align-text-bottom" />
            </button>
          )}
        </div>
        {!readOnly && (
          order === 0 ? (
            <HintBubble
              id="add-to-trip"
              message="このスポットを旅行の行程に追加できます。追加したい旅行と日付を選んでください。"
            >
              <AddToTripDialog
              spotId={spot.id}
              spotName={spot.name}
              spotLat={spot.lat}
              spotLng={spot.lng}
            />
            </HintBubble>
          ) : (
            <AddToTripDialog
                spotId={spot.id}
                spotName={spot.name}
                spotLat={spot.lat}
                spotLng={spot.lng}
              />
          )
        )}
        {!readOnly && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("mt-0.5 h-7 w-7 shrink-0", spot.notes && "text-indigo-600 dark:text-indigo-400")}
            onClick={() => (isEditingNotes ? setIsEditingNotes(false) : startEditing())}
          >
            <StickyNote className="h-4 w-4" />
          </Button>
        )}
        {!readOnly && (
          <AlertDialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
            <AlertDialogTrigger
              render={<Button type="button" variant="ghost" size="icon" className="mt-0.5 h-7 w-7 shrink-0" />}
            >
              <X className="h-4 w-4" />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>「{spot.name}」を削除しますか？</AlertDialogTitle>
                <AlertDialogDescription>
                  このリストからスポットを削除します。この操作は取り消せません。
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
        )}
      </div>

      {!isEditingNotes && spot.notes && (
        readOnly ? (
          <p className="rounded-md bg-zinc-50 px-2 py-1.5 text-left text-xs whitespace-pre-wrap text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {spot.notes}
          </p>
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className="cursor-text rounded-md bg-zinc-50 px-2 py-1.5 text-left text-xs whitespace-pre-wrap text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            {spot.notes}
          </button>
        )
      )}

      {!readOnly && isEditingNotes && (
        <div className="flex flex-col gap-1.5">
          <Textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="このスポットについてのメモ"
            className="min-h-16"
            autoFocus
          />
          <div className="flex justify-end gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditingNotes(false)}>
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
