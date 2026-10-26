import { useEffect, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { addMinutesToTime } from "@/lib/itinerary-time";
import { fetchTravelDuration, type TravelMode } from "@/lib/travel-mode";

type PreviousSpot = {
  startTime: string | null;
  durationMinutes: number | null;
  spot: { lat: number; lng: number };
};

/**
 * Computes the travel time from the previous spot, and — when the previous
 * spot has a start time set — a suggested start time for this one (its stay
 * end time plus that travel time).
 */
export function useSuggestedStartTime(
  enabled: boolean,
  previous: PreviousSpot | null,
  destination: { lat: number; lng: number } | null,
  travelMode: TravelMode | null,
): {
  suggested: string | null;
  travelMinutes: number | null;
  isLoading: boolean;
  /** Set when no duration could be resolved; see `TravelDurationResult`. */
  issue: "unavailable" | "error" | null;
} {
  const routesLib = useMapsLibrary("routes");
  const [travelMinutes, setTravelMinutes] = useState<number | null>(null);
  const [issue, setIssue] = useState<"unavailable" | "error" | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Reset per-leg state during render (not in the effect below) so a stale
  // duration from a different leg never leaks into this one.
  const legKey =
    enabled && previous && destination && travelMode
      ? `${previous.spot.lat},${previous.spot.lng}:${destination.lat},${destination.lng}:${travelMode}`
      : null;
  const [trackedLegKey, setTrackedLegKey] = useState(legKey);
  if (legKey !== trackedLegKey) {
    setTrackedLegKey(legKey);
    setTravelMinutes(null);
    setIssue(null);
    setIsLoading(legKey !== null);
  }

  useEffect(() => {
    if (!enabled || !routesLib || !destination || !travelMode || !previous) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off the async fetch below; loading state can't be derived at render time
    setIsLoading(true);
    fetchTravelDuration(routesLib, previous.spot, destination, travelMode).then((result) => {
      if (cancelled) return;
      setTravelMinutes(result.status === "ok" ? result.minutes : null);
      setIssue(result.status === "ok" ? null : result.status);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // Deliberately depend on primitives (not the previous/destination object
    // identities, which are recreated every render) to avoid refetching on
    // every render; legKey above already resets state when any of these change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    routesLib,
    destination?.lat,
    destination?.lng,
    travelMode,
    previous?.spot.lat,
    previous?.spot.lng,
  ]);

  const suggested =
    previous?.startTime != null && travelMinutes != null
      ? addMinutesToTime(previous.startTime, (previous.durationMinutes ?? 0) + travelMinutes)
      : null;

  return { suggested, travelMinutes, isLoading, issue };
}
