import { connection } from "next/server";
import { getBrandContext } from "@/lib/db";
import { json, serverError } from "@/lib/api";
import { todayIST } from "@/lib/checks/text-utils";

export async function GET() {
  await connection();
  try {
    const ctx = await getBrandContext();
    return json({ ...ctx, today: todayIST(), ai_enabled: !!process.env.GEMINI_API_KEY });
  } catch (e) {
    return serverError(e, "brand");
  }
}
