import { withSession } from "@/lib/session";
import { connection } from "next/server";
import { getBrandContext, listBrands } from "@/lib/db";
import { json, serverError } from "@/lib/api";
import { todayIST } from "@/lib/checks/text-utils";

export const GET = withSession(async () => {
  await connection();
  try {
    const [ctx, brands] = await Promise.all([getBrandContext(), listBrands()]);
    return json({ ...ctx, brands, today: todayIST(), ai_enabled: !!process.env.GEMINI_API_KEY });
  } catch (e) {
    return serverError(e, "brand");
  }
}, "brand");
