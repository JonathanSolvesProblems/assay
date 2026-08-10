/**
 * Analyse one capture session.
 *
 * The browser posts frames here; only this route talks to YouCam. The API key
 * is a bearer credential with spend attached, so it stays on the server and is
 * never shipped to the client under any circumstances.
 */

import { NextResponse } from "next/server";

import { createYouCamClient, YouCamError } from "@/lib/youcam/client";
import { MEASURED_SKIN_ANALYSIS_COST } from "@/lib/youcam/types";
import { DEFAULT_CONCERNS, type ConcernId } from "@/lib/domain/concerns";
import { SAFE_UPLOAD_BYTES } from "@/lib/youcam/image";

export const runtime = "nodejs";
/**
 * Frames run serially and each takes a few seconds, so a three-frame session
 * lands around 20 to 30 seconds. Capped at 60 because that is the ceiling for a
 * serverless function on Vercel's Hobby tier; asking for more does not fail the
 * build, it just never gets honoured, and the request would be killed mid-session
 * after the units had already been spent.
 */
export const maxDuration = 60;

/**
 * Five frames would exceed the 60 second budget on a slow analysis. The capture
 * UI sends three.
 */
const MAX_FRAMES = 4;

export async function POST(request: Request) {
  if (!process.env.YOUCAM_API_KEY) {
    return NextResponse.json(
      { error: "The server has no YouCam API key configured." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const files = form.getAll("frames").filter((f): f is File => f instanceof File);

  if (files.length < 2) {
    return NextResponse.json(
      {
        error:
          "A session needs at least two frames. The spread between frames taken seconds apart is what measures the instrument's error, with one frame there is nothing to measure it from.",
      },
      { status: 400 },
    );
  }

  if (files.length > MAX_FRAMES) {
    return NextResponse.json(
      { error: `At most ${MAX_FRAMES} frames per session.` },
      { status: 400 },
    );
  }

  const requested = form.get("concerns");
  const concerns: ConcernId[] =
    typeof requested === "string" && requested.length > 0
      ? (requested.split(",").filter(Boolean) as ConcernId[])
      : DEFAULT_CONCERNS;

  for (const file of files) {
    if (file.size > SAFE_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `A frame is ${(file.size / 1024 / 1024).toFixed(1)} MB. Frames must be normalised before upload, oversized images stall the analyser while still consuming units.`,
        },
        { status: 400 },
      );
    }
  }

  const client = createYouCamClient();

  try {
    const balance = await client.getCreditBalance();
    const estimate = files.length * MEASURED_SKIN_ANALYSIS_COST;

    if (balance !== null && balance < estimate) {
      return NextResponse.json(
        {
          error: `Not enough units: this session needs about ${estimate} and ${balance} remain.`,
        },
        { status: 402 },
      );
    }

    const frames = await Promise.all(
      files.map(async (file, index) => ({
        bytes: new Uint8Array(await file.arrayBuffer()),
        fileName: `frame-${index}.jpg`,
        contentType: file.type || "image/jpeg",
      })),
    );

    const results = await client.analyzeSession(frames, concerns);

    // Collapse per-frame results into per-concern arrays, which is the shape the
    // statistics layer consumes. raw_score, not ui_score: the latter is a
    // rounded non-linear remap and a noise floor built from integers would be
    // quantised rather than precise.
    const readings: Record<string, number[]> = {};
    for (const result of results) {
      for (const [concern, output] of Object.entries(result.scores)) {
        (readings[concern] ??= []).push(output.raw_score);
      }
    }

    return NextResponse.json({
      readings,
      frameCount: frames.length,
      taskIds: results.map((r) => r.taskId),
      unitsBefore: balance,
      unitsAfter: await client.getCreditBalance(),
      capturedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof YouCamError) {
      // userMessage turns documented failure codes into something a person
      // mid-capture can act on, rather than an opaque string.
      return NextResponse.json(
        { error: error.userMessage, code: error.code },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed." },
      { status: 500 },
    );
  }
}
