import type { ItineraryItem } from "@/lib/types";

/**
 * The first spot of each day is that day's departure point: it has a
 * departure time rather than a stay, so any stay duration left on it (for
 * instance from before it was dragged to the top) is ignored for display and
 * for scheduling math.
 */
export function withDepartureNormalized(items: ItineraryItem[]): ItineraryItem[] {
  return items.map((item, index) =>
    index === 0 && item.durationMinutes != null ? { ...item, durationMinutes: null } : item,
  );
}
