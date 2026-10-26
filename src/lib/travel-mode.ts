export type TravelMode = "walking" | "driving" | "transit" | "bicycling";

export const TRAVEL_MODES: TravelMode[] = ["walking", "driving", "transit", "bicycling"];

export const travelModeLabel: Record<TravelMode, string> = {
  walking: "徒歩",
  driving: "車",
  transit: "公共交通機関",
  bicycling: "自転車",
};

/** Maps our storage-friendly mode names to the Google Maps TravelMode enum. */
export const travelModeToGoogle: Record<TravelMode, google.maps.TravelMode> = {
  walking: "WALKING" as google.maps.TravelMode,
  driving: "DRIVING" as google.maps.TravelMode,
  transit: "TRANSIT" as google.maps.TravelMode,
  bicycling: "BICYCLING" as google.maps.TravelMode,
};

/**
 * Why a travel-time lookup produced no number.
 *
 * `unavailable` means Google has no route data for this mode between these
 * points, so retrying never helps: transit anywhere in Japan is excluded from
 * the Directions/Routes APIs, and cycling is only covered in some metros.
 * `error` means the lookup itself failed and may succeed later.
 */
export type TravelDurationResult =
  | { status: "ok"; minutes: number; text: string }
  | { status: "unavailable" }
  | { status: "error" };

/** Resolves the travel duration between two points. */
export async function fetchTravelDuration(
  routesLib: google.maps.RoutesLibrary,
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  mode: TravelMode,
): Promise<TravelDurationResult> {
  try {
    const service = new routesLib.DistanceMatrixService();
    const res = await service.getDistanceMatrix({
      origins: [origin],
      destinations: [destination],
      travelMode: travelModeToGoogle[mode],
    });
    const element = res.rows[0]?.elements[0];
    if (element?.status === "OK" && element.duration) {
      return {
        status: "ok",
        minutes: Math.round(element.duration.value / 60),
        text: element.duration.text,
      };
    }
    if (element?.status === "ZERO_RESULTS") return { status: "unavailable" };
  } catch {
    // Falls through to the generic error below.
  }
  return { status: "error" };
}

/** Explains a lookup that produced no number, so "retry later" isn't implied when it won't help. */
export function travelDurationIssueLabel(
  status: "unavailable" | "error",
  mode: TravelMode,
  /** The connector sits beside the mode icons in a narrow row that truncates, so it asks for "short". */
  variant: "full" | "short" = "full",
): string {
  if (status === "error") return "所要時間を取得できませんでした";
  return variant === "short"
    ? "この地域では取得できません"
    : `この地域では${travelModeLabel[mode]}の所要時間を取得できません`;
}
