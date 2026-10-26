"use client";

import { useEffect, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { ArrowDown, Bike, Car, Footprints, TrainFront } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TRAVEL_MODES,
  fetchTravelDuration,
  travelDurationIssueLabel,
  travelModeLabel,
  type TravelDurationResult,
  type TravelMode,
} from "@/lib/travel-mode";

const travelModeIcon: Record<TravelMode, typeof Car> = {
  walking: Footprints,
  driving: Car,
  transit: TrainFront,
  bicycling: Bike,
};

export function TravelConnector({
  origin,
  destination,
  travelMode,
  onChangeMode,
  readOnly,
}: {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  travelMode: TravelMode | null;
  onChangeMode: (mode: TravelMode) => void;
  readOnly: boolean;
}) {
  const routesLib = useMapsLibrary("routes");
  // null while the lookup for the current leg is still in flight.
  const [result, setResult] = useState<TravelDurationResult | null>(null);

  // Reset the stale result during render (not in the effect below) whenever
  // the leg being described changes, so we never show a previous leg's
  // duration while the new one is loading or unavailable.
  const legKey = travelMode
    ? `${travelMode}:${origin.lat},${origin.lng}:${destination.lat},${destination.lng}`
    : null;
  const [trackedLegKey, setTrackedLegKey] = useState(legKey);
  if (legKey !== trackedLegKey) {
    setTrackedLegKey(legKey);
    setResult(null);
  }

  useEffect(() => {
    if (!routesLib || !travelMode) return;
    let cancelled = false;
    fetchTravelDuration(routesLib, origin, destination, travelMode).then((next) => {
      if (!cancelled) setResult(next);
    });
    return () => {
      cancelled = true;
    };
    // origin/destination are covered by legKey above; re-running only needs
    // to track the primitive coordinates, not new object identities.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routesLib, travelMode, origin.lat, origin.lng, destination.lat, destination.lng]);

  if (readOnly && !travelMode) return null;

  const statusLabel = !travelMode
    ? "移動手段を選択"
    : !result
      ? "計算中..."
      : result.status === "ok"
        ? `${travelModeLabel[travelMode]}で約${result.text}`
        : travelDurationIssueLabel(result.status, travelMode, "short");

  if (readOnly) {
    const Icon = travelMode ? travelModeIcon[travelMode] : null;
    return (
      <li className="flex list-none items-center gap-1.5 py-0.5 pl-3 text-[11px] text-zinc-500">
        <ArrowDown className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {statusLabel}
      </li>
    );
  }

  return (
    <li className="flex list-none items-center gap-1.5 py-0.5 pl-3">
      <ArrowDown className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
      {TRAVEL_MODES.map((mode) => {
        const Icon = travelModeIcon[mode];
        const active = mode === travelMode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChangeMode(mode)}
            title={travelModeLabel[mode]}
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-zinc-400 transition-colors",
              active
                ? "border-indigo-600 bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"
                : "border-transparent hover:bg-muted",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
      <span className="truncate text-[11px] text-zinc-500">{statusLabel}</span>
    </li>
  );
}
