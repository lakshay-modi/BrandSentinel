import { connection } from "next/server";
import { getBrandContext } from "@/lib/db";
import { fail, json } from "@/lib/api";
import { todayIST } from "@/lib/checks/text-utils";

export async function GET() {
  await connection();
  try {
    const ctx = await getBrandContext();
    return json({ ...ctx, today: todayIST(), ai_enabled: !!process.env.GEMINI_API_KEY });
  } catch (e) {
    return fail(String(e instanceof Error ? e.message : e), 500);
  }
}
