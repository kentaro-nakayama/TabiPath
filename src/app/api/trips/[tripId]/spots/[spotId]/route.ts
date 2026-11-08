import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { spots } from "@/db/schema";
import { getTripRole, hasAtLeastRole } from "@/lib/access";

// 部分更新: 送られてきたキーのみ更新する（/api/spots/[spotId] と同じ扱い）
const updateSpotSchema = z.object({
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tripId: string; spotId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { tripId, spotId } = await params;
  const role = await getTripRole(tripId, userId);
  if (!hasAtLeastRole(role, "editor")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = updateSpotSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();

  const updates: Partial<typeof spots.$inferInsert> = {};
  if ("notes" in parsed.data) updates.notes = parsed.data.notes || null;

  // 更新対象のカラムが無いまま update を投げるとドライバ側でエラーになる
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "更新する項目がありません" }, { status: 400 });
  }

  const [spot] = await db
    .update(spots)
    .set(updates)
    .where(and(eq(spots.id, spotId), eq(spots.tripId, tripId)))
    .returning();

  if (!spot) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json(spot);
}
