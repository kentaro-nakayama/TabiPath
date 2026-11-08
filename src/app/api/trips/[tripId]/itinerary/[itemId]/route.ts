import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { itineraryDays, itineraryItems } from "@/db/schema";
import { getTripRole, hasAtLeastRole } from "@/lib/access";

const updateItemSchema = z.object({
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "時刻の形式が正しくありません")
    .nullable()
    .optional(),
  durationMinutes: z.number().int().min(0).max(1440).nullable().optional(),
  travelMode: z.enum(["walking", "driving", "transit", "bicycling"]).nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tripId: string; itemId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { tripId, itemId } = await params;
  const role = await getTripRole(tripId, userId);
  if (!hasAtLeastRole(role, "editor")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = updateItemSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();

  const [existing] = await db
    .select({ id: itineraryItems.id })
    .from(itineraryItems)
    .innerJoin(itineraryDays, eq(itineraryItems.itineraryDayId, itineraryDays.id))
    .where(and(eq(itineraryItems.id, itemId), eq(itineraryDays.tripId, tripId)))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const updates: Partial<typeof itineraryItems.$inferInsert> = {};
  if ("startTime" in parsed.data) updates.startTime = parsed.data.startTime;
  if ("durationMinutes" in parsed.data) updates.durationMinutes = parsed.data.durationMinutes;
  if ("travelMode" in parsed.data) updates.travelMode = parsed.data.travelMode;

  // 更新対象のカラムが無いまま update を投げるとドライバ側でエラーになる
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "更新する項目がありません" }, { status: 400 });
  }

  const [item] = await db
    .update(itineraryItems)
    .set(updates)
    .where(eq(itineraryItems.id, itemId))
    .returning();

  return NextResponse.json(item);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ tripId: string; itemId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { tripId, itemId } = await params;
  const role = await getTripRole(tripId, userId);
  if (!hasAtLeastRole(role, "editor")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const db = getDb();

  const [item] = await db
    .select({ id: itineraryItems.id })
    .from(itineraryItems)
    .innerJoin(itineraryDays, eq(itineraryItems.itineraryDayId, itineraryDays.id))
    .where(and(eq(itineraryItems.id, itemId), eq(itineraryDays.tripId, tripId)))
    .limit(1);
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await db.delete(itineraryItems).where(eq(itineraryItems.id, itemId));

  return NextResponse.json({ ok: true });
}
