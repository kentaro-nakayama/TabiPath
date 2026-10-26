"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { APIProvider } from "@vis.gl/react-google-maps";
import { toast } from "sonner";
import { ArrowLeft, List, Loader2, Map as MapIcon } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn, extractErrorMessage } from "@/lib/utils";
import { withDepartureNormalized } from "@/lib/itinerary-departure";
import type { TravelMode } from "@/lib/travel-mode";
import { CustomSpotDialog, type AddressSpotSelection } from "./custom-spot-dialog";
import { DayColumn } from "./day-column";
import { ScheduleConfirmDialog } from "./schedule-confirm-dialog";
import { SpotSearch, type PlaceSelection } from "./spot-search";
import { TravelModeSelect } from "./travel-mode-select";
import { TripMap, type MapPin as MapPinType } from "./trip-map";
import { MembersDialog } from "./members-dialog";
import { HintBubble } from "@/components/onboarding/hint-bubble";
import type { TripDetail } from "@/lib/types";

function reorderDayItems(
  trip: TripDetail,
  dayId: string,
  orderedItemIds: string[],
): TripDetail {
  return {
    ...trip,
    days: trip.days.map((day) => {
      if (day.id !== dayId) return day;
      const itemsById = new Map(day.items.map((item) => [item.id, item]));
      return {
        ...day,
        items: orderedItemIds
          .map((id, index) => {
            const item = itemsById.get(id);
            return item ? { ...item, order: index } : null;
          })
          .filter((item): item is NonNullable<typeof item> => item !== null),
      };
    }),
  };
}

function updateItemTravelMode(
  trip: TripDetail,
  itemId: string,
  travelMode: TravelMode,
): TripDetail {
  return {
    ...trip,
    days: trip.days.map((day) => ({
      ...day,
      items: day.items.map((item) => (item.id === itemId ? { ...item, travelMode } : item)),
    })),
  };
}

async function fetchTrip(tripId: string): Promise<TripDetail> {
  const res = await fetch(`/api/trips/${tripId}`);
  if (!res.ok) throw new Error("旅行の取得に失敗しました");
  return res.json();
}

const dayLabelFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

function formatDayLabel(day: { date: string | null }, index: number): string {
  if (!day.date) return `${index + 1}日目`;
  return dayLabelFormatter.format(new Date(`${day.date}T00:00:00`));
}

export function TripWorkspace({
  tripId,
  initial,
  googleMapsApiKey,
}: {
  tripId: string;
  initial: TripDetail;
  googleMapsApiKey: string;
}) {
  const queryClient = useQueryClient();
  const queryKey = ["trip", tripId];

  const { data } = useQuery({
    queryKey,
    queryFn: () => fetchTrip(tripId),
    initialData: initial,
  });

  const [selectedDayId, setSelectedDayId] = useState<string | null>(
    initial.days[0]?.id ?? null,
  );
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [clickToAdd, setClickToAdd] = useState(false);
  const [pendingLatLng, setPendingLatLng] = useState<{
    lat: number;
    lng: number;
    address: string | null;
  } | null>(null);
  const [pendingName, setPendingName] = useState("");
  const [pendingCustomNotes, setPendingCustomNotes] = useState("");
  const [pendingCustomTravelMode, setPendingCustomTravelMode] = useState<TravelMode>("driving");
  const [pendingPlace, setPendingPlace] = useState<PlaceSelection | null>(null);
  const [pendingPlaceNotes, setPendingPlaceNotes] = useState("");
  const [pendingPlaceTravelMode, setPendingPlaceTravelMode] = useState<TravelMode>("driving");
  const [pendingSchedule, setPendingSchedule] = useState<{
    dayId: string;
    spotId: string;
    spotLat: number;
    spotLng: number;
    travelMode: TravelMode | null;
  } | null>(null);

  const readOnly = data.myRole === "viewer";
  const selectedDay = data.days.find((d) => d.id === selectedDayId) ?? data.days[0] ?? null;
  // The day's first spot is its departure point, so it never contributes a
  // stay duration to the next spot's suggested start time.
  // Memoized so `pins` below keeps a stable identity across renders.
  const selectedDayItems = useMemo(
    () => withDepartureNormalized(selectedDay?.items ?? []),
    [selectedDay?.items],
  );
  const hasPreviousItem = selectedDayItems.length > 0;
  const previousItem = selectedDayItems[selectedDayItems.length - 1] ?? null;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey });
  }

  const addItem = useMutation({
    mutationFn: async ({
      dayId,
      spotId,
      travelMode,
      startTime,
      durationMinutes,
    }: {
      dayId: string;
      spotId: string;
      travelMode?: TravelMode | null;
      startTime?: string | null;
      durationMinutes?: number | null;
    }) => {
      const res = await fetch(`/api/trips/${tripId}/itinerary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itineraryDayId: dayId,
          spotId,
          travelMode,
          startTime,
          durationMinutes,
        }),
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res, "行程への追加に失敗しました"));
      return res.json();
    },
    onSuccess: () => invalidate(),
    onError: (err) => toast.error(err instanceof Error ? err.message : "行程への追加に失敗しました"),
  });

  const createSpot = useMutation({
    mutationFn: async (input: {
      name: string;
      address?: string | null;
      lat: number;
      lng: number;
      googlePlaceId?: string;
      notes?: string;
    }) => {
      const res = await fetch(`/api/trips/${tripId}/spots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res, "スポットの作成に失敗しました"));
      return res.json();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "スポットの作成に失敗しました"),
  });

  const updateSpotNotes = useMutation({
    mutationFn: async ({ spotId, notes }: { spotId: string; notes: string }) => {
      const res = await fetch(`/api/trips/${tripId}/spots/${spotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes || null }),
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res, "メモの保存に失敗しました"));
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast.success("メモを保存しました");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "メモの保存に失敗しました"),
  });

  const updateItemSchedule = useMutation({
    mutationFn: async ({
      itemId,
      startTime,
      durationMinutes,
    }: {
      itemId: string;
      startTime: string | null;
      durationMinutes: number | null;
    }) => {
      const res = await fetch(`/api/trips/${tripId}/itinerary/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startTime, durationMinutes }),
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res, "時刻の保存に失敗しました"));
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast.success("時刻を保存しました");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "時刻の保存に失敗しました"),
  });

  const updateTravelMode = useMutation({
    mutationFn: async ({ itemId, travelMode }: { itemId: string; travelMode: TravelMode }) => {
      const res = await fetch(`/api/trips/${tripId}/itinerary/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ travelMode }),
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res, "移動手段の保存に失敗しました"));
      return res.json();
    },
    onMutate: async ({ itemId, travelMode }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TripDetail>(queryKey);
      if (previous) {
        queryClient.setQueryData<TripDetail>(
          queryKey,
          updateItemTravelMode(previous, itemId, travelMode),
        );
      }
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error(err instanceof Error ? err.message : "移動手段の保存に失敗しました");
    },
  });

  const reorder = useMutation({
    mutationFn: async ({
      dayId,
      orderedItemIds,
    }: {
      dayId: string;
      orderedItemIds: string[];
    }) => {
      const res = await fetch(`/api/trips/${tripId}/itinerary/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itineraryDayId: dayId, orderedItemIds }),
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res, "並び替えに失敗しました"));
    },
    onMutate: async ({ dayId, orderedItemIds }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TripDetail>(queryKey);
      if (previous) {
        queryClient.setQueryData<TripDetail>(
          queryKey,
          reorderDayItems(previous, dayId, orderedItemIds),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error("並び替えに失敗しました");
    },
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await fetch(`/api/trips/${tripId}/itinerary/${itemId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res, "削除に失敗しました"));
    },
    onSuccess: () => {
      invalidate();
      toast.success("削除しました");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "削除に失敗しました"),
  });

  function handlePlaceSelect(place: PlaceSelection) {
    if (!selectedDay) {
      toast.error("先に日程を追加してください");
      return;
    }
    setPendingPlace(place);
    setPendingPlaceNotes("");
    setPendingPlaceTravelMode("driving");
  }

  async function handleConfirmPlace() {
    if (!pendingPlace || !selectedDay) return;
    const spot = await createSpot.mutateAsync({
      ...pendingPlace,
      notes: pendingPlaceNotes.trim() || undefined,
    });
    setPendingPlace(null);
    setPendingPlaceNotes("");
    setPendingSchedule({
      dayId: selectedDay.id,
      spotId: spot.id,
      spotLat: spot.lat,
      spotLng: spot.lng,
      travelMode: hasPreviousItem ? pendingPlaceTravelMode : null,
    });
  }

  async function handleConfirmCustomSpot() {
    if (!pendingLatLng || !selectedDay || !pendingName.trim()) return;
    const spot = await createSpot.mutateAsync({
      name: pendingName.trim(),
      address: pendingLatLng.address ?? undefined,
      lat: pendingLatLng.lat,
      lng: pendingLatLng.lng,
      notes: pendingCustomNotes.trim() || undefined,
    });
    setPendingLatLng(null);
    setPendingName("");
    setPendingCustomNotes("");
    setClickToAdd(false);
    setPendingSchedule({
      dayId: selectedDay.id,
      spotId: spot.id,
      spotLat: spot.lat,
      spotLng: spot.lng,
      travelMode: hasPreviousItem ? pendingCustomTravelMode : null,
    });
  }

  async function handleAddressSelect(input: AddressSpotSelection) {
    if (!selectedDay) {
      toast.error("先に日程を追加してください");
      return;
    }
    const spot = await createSpot.mutateAsync(input);
    setPendingSchedule({
      dayId: selectedDay.id,
      spotId: spot.id,
      spotLat: spot.lat,
      spotLng: spot.lng,
      travelMode: hasPreviousItem ? (input.travelMode ?? null) : null,
    });
  }

  async function handleConfirmSchedule(schedule: {
    startTime: string | null;
    durationMinutes: number | null;
  }) {
    if (!pendingSchedule) return;
    await addItem.mutateAsync({
      dayId: pendingSchedule.dayId,
      spotId: pendingSchedule.spotId,
      travelMode: pendingSchedule.travelMode,
      ...schedule,
    });
    setPendingSchedule(null);
    toast.success("行程に追加しました");
  }

  const pins: MapPinType[] = useMemo(
    () =>
      selectedDayItems.map((item, index) => ({
        id: item.id,
        order: index,
        lat: item.spot.lat,
        lng: item.spot.lng,
        name: item.spot.name,
      })),
    [selectedDayItems],
  );

  const content = (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden md:flex-row">
      <div className="flex items-start justify-between gap-2 border-b p-4 md:hidden">
        <div className="flex items-start gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-1 h-8 w-8 shrink-0"
            nativeButton={false}
            render={<Link href="/trips" />}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold leading-tight">{data.name}</h1>
            {(data.startDate || data.endDate) && (
              <p className="text-[15px] text-zinc-500">
                {data.startDate ?? "?"} 〜 {data.endDate ?? "?"}
              </p>
            )}
          </div>
        </div>
        <MembersDialog resourceType="trips" resourceId={tripId} resourceLabel="旅行" myRole={data.myRole} />
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-1 border-b p-2 md:hidden">
        <Button
          type="button"
          variant={mobileView === "list" ? "default" : "ghost"}
          size="sm"
          onClick={() => setMobileView("list")}
        >
          <List className="h-4 w-4" />
          行程
        </Button>
        <Button
          type="button"
          variant={mobileView === "map" ? "default" : "ghost"}
          size="sm"
          onClick={() => setMobileView("map")}
        >
          <MapIcon className="h-4 w-4" />
          地図
        </Button>
      </div>

      <div className="relative flex min-h-0 flex-1 md:flex-row">
        <aside
          className={cn(
            "absolute inset-0 z-10 min-h-0 flex-col overflow-hidden bg-background md:static md:z-auto md:flex md:w-[456px] md:flex-none md:shrink-0 md:border-r",
            mobileView === "list" ? "flex" : "hidden",
          )}
        >
          <div className="flex shrink-0 flex-col gap-4 p-4 pb-0">
            <div className="hidden items-start justify-between gap-2 md:flex">
              <div className="flex items-start gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="-ml-1 h-8 w-8 shrink-0"
                  nativeButton={false}
                  render={<Link href="/trips" />}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h1 className="text-lg font-semibold leading-tight">{data.name}</h1>
                  {(data.startDate || data.endDate) && (
                    <p className="text-[15px] text-zinc-500">
                      {data.startDate ?? "?"} 〜 {data.endDate ?? "?"}
                    </p>
                  )}
                </div>
              </div>
              <MembersDialog resourceType="trips" resourceId={tripId} resourceLabel="旅行" myRole={data.myRole} />
            </div>

            <div className="flex flex-wrap gap-2">
              {data.days.map((day, index) => (
                <Button
                  key={day.id}
                  size="sm"
                  variant={day.id === selectedDay?.id ? "default" : "outline"}
                  className={cn(
                    day.id === selectedDay?.id &&
                      "bg-[rgb(76,71,205)] hover:bg-[rgb(65,60,174)]",
                  )}
                  onClick={() => setSelectedDayId(day.id)}
                >
                  {formatDayLabel(day, index)}
                </Button>
              ))}
            </div>

            {!readOnly && selectedDay && (
              <HintBubble
                id="add-spot"
                message="Googleマップでスポットを検索するか、自分でスポットを追加して行程に加えられます。"
                className="flex flex-col gap-2"
              >
                <SpotSearch onSelect={handlePlaceSelect} />
                <CustomSpotDialog
                  hasPreviousItem={hasPreviousItem}
                  onChooseMapClick={() => {
                    setClickToAdd(true);
                    setMobileView("map");
                  }}
                  onAddressSelect={handleAddressSelect}
                />
                {clickToAdd && (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300">
                    <span>地図をクリックしてスポットを追加してください</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-indigo-700 hover:text-indigo-800 dark:text-indigo-300"
                      onClick={() => setClickToAdd(false)}
                    >
                      キャンセル
                    </Button>
                  </div>
                )}
              </HintBubble>
            )}
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="p-4">
              {selectedDay ? (
                <DayColumn
                  day={selectedDay}
                  readOnly={readOnly}
                  onReorder={(orderedItemIds) =>
                    reorder.mutate({ dayId: selectedDay.id, orderedItemIds })
                  }
                  onRemoveItem={(itemId) => removeItem.mutate(itemId)}
                  onUpdateSpotNotes={(spotId, notes) => updateSpotNotes.mutate({ spotId, notes })}
                  onUpdateSchedule={(itemId, schedule) =>
                    updateItemSchedule.mutate({ itemId, ...schedule })
                  }
                  onUpdateTravelMode={(itemId, travelMode) =>
                    updateTravelMode.mutate({ itemId, travelMode })
                  }
                />
              ) : (
                <p className="text-sm text-zinc-500">まだ日程がありません。</p>
              )}
            </div>
          </ScrollArea>
        </aside>

        <main className="relative min-h-0 flex-1">
          <TripMap
            pins={pins}
            onMapClick={
              clickToAdd
                ? (lat, lng, address) => {
                    setPendingLatLng({ lat, lng, address });
                    setPendingCustomTravelMode("driving");
                  }
                : undefined
            }
            onPoiClick={!readOnly && selectedDay ? handlePlaceSelect : undefined}
          />
        </main>
      </div>

      <Dialog
        open={pendingLatLng !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingLatLng(null);
            setPendingName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>独自スポットを追加</DialogTitle>
            {pendingLatLng?.address && (
              <DialogDescription>{pendingLatLng.address}</DialogDescription>
            )}
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="custom-spot-name">スポット名</Label>
              <Input
                id="custom-spot-name"
                value={pendingName}
                onChange={(e) => setPendingName(e.target.value)}
                placeholder="例: 隠れた展望スポット"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="custom-spot-notes">メモ（任意）</Label>
              <Textarea
                id="custom-spot-notes"
                value={pendingCustomNotes}
                onChange={(e) => setPendingCustomNotes(e.target.value)}
                placeholder="このスポットについてのメモ"
              />
            </div>
            {hasPreviousItem && (
              <TravelModeSelect
                value={pendingCustomTravelMode}
                onChange={setPendingCustomTravelMode}
              />
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={handleConfirmCustomSpot}
              disabled={!pendingName.trim() || createSpot.isPending || addItem.isPending}
            >
              {(createSpot.isPending || addItem.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              追加する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingPlace !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingPlace(null);
            setPendingPlaceNotes("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingPlace?.name}</DialogTitle>
            {pendingPlace?.address && (
              <DialogDescription>{pendingPlace.address}</DialogDescription>
            )}
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="place-spot-notes">メモ（任意）</Label>
              <Textarea
                id="place-spot-notes"
                value={pendingPlaceNotes}
                onChange={(e) => setPendingPlaceNotes(e.target.value)}
                placeholder="このスポットについてのメモ"
                autoFocus
              />
            </div>
            {hasPreviousItem && (
              <TravelModeSelect
                value={pendingPlaceTravelMode}
                onChange={setPendingPlaceTravelMode}
              />
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={handleConfirmPlace}
              disabled={createSpot.isPending || addItem.isPending}
            >
              {(createSpot.isPending || addItem.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              行程に追加する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScheduleConfirmDialog
        open={pendingSchedule !== null}
        previousItem={previousItem}
        destination={
          pendingSchedule ? { lat: pendingSchedule.spotLat, lng: pendingSchedule.spotLng } : null
        }
        travelMode={pendingSchedule?.travelMode ?? null}
        isPending={addItem.isPending}
        onConfirm={handleConfirmSchedule}
      />
    </div>
  );

  if (!googleMapsApiKey) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-zinc-100 text-sm text-zinc-500 dark:bg-zinc-900">
        Google Maps APIキーが設定されていません。
      </div>
    );
  }

  return <APIProvider apiKey={googleMapsApiKey}>{content}</APIProvider>;
}
