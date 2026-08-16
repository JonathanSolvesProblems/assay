/**
 * How many API units are left, and therefore whether a live capture can run.
 *
 * The capture UI sends one frame per request, so the analyse route can only
 * ever see the cost of the frame in front of it. That meant a session could
 * spend units on the first frames and then fail on the last one, which wastes
 * real money and leaves the visitor with a half-finished session.
 *
 * This lets the client ask before it starts, so a session that cannot complete
 * is never begun. Reading the balance costs nothing.
 */

import { NextResponse } from "next/server";

import { createYouCamClient } from "@/lib/youcam/client";
import { MEASURED_SKIN_ANALYSIS_COST } from "@/lib/youcam/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // A caller-supplied key is checked instead of the server's, so the page can
  // tell a visitor whether *their* balance funds a session. Read per request,
  // never logged or stored.
  const supplied = new URL(request.url).searchParams.get("apiKey")?.trim() ?? "";

  if (!supplied && !process.env.YOUCAM_API_KEY) {
    return NextResponse.json({ balance: null, canCapture: false, perFrame: null });
  }

  try {
    const balance = await createYouCamClient(supplied).getCreditBalance();
    return NextResponse.json({
      balance,
      perFrame: MEASURED_SKIN_ANALYSIS_COST,
      // A null balance means the endpoint did not report one, which is not the
      // same as zero; in that case the capture is allowed and the analyse route
      // stays the backstop.
      canCapture: balance === null || balance >= MEASURED_SKIN_ANALYSIS_COST * 3,
    });
  } catch {
    // Failing open is right for the server's own key, where a transient lookup
    // glitch should not block a capture the analyse route would have allowed.
    // It is wrong for a key the visitor just pasted: there the lookup failing is
    // the evidence that the key does not work, and enabling the button would
    // start a session doomed to fail on the first frame.
    return NextResponse.json({
      balance: null,
      canCapture: !supplied,
      perFrame: null,
      keyRejected: Boolean(supplied),
    });
  }
}
