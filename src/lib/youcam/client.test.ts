/**
 * YouCam client tests, driven by a scripted fetch.
 *
 * These run without an API key and without spending units, which matters: the
 * account has 1,000 units and the study needs most of them. Every behaviour
 * that would otherwise only surface by burning budget is pinned here.
 */

import { describe, it, expect, vi } from "vitest";

import { YouCamClient, YouCamError } from "./client";
import { YOUCAM_ERROR_CODES } from "./types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** A fetch that replays a scripted sequence and records what it was called with. */
function scriptedFetch(responses: Array<() => Response>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let index = 0;

  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const next = responses[Math.min(index, responses.length - 1)];
    index++;
    return next();
  }) as unknown as typeof fetch;

  return { impl, calls, callCount: () => index };
}

const UPLOAD_OK = () =>
  jsonResponse({
    status: 200,
    data: {
      files: [
        {
          file_id: "file-abc",
          requests: [
            {
              method: "PUT",
              url: "https://uploads.example.com/presigned",
              headers: { "Content-Type": "image/jpeg" },
            },
          ],
        },
      ],
    },
  });

const PUT_OK = () => new Response(null, { status: 200 });

const TASK_CREATED = () => jsonResponse({ status: 200, data: { task_id: "task-xyz" } });

const TASK_SUCCESS = () =>
  jsonResponse({
    status: 200,
    data: {
      task_status: "success",
      results: {
        output: [
          { type: "texture", ui_score: 68, raw_score: 57.33, mask_urls: ["https://m/1"] },
          { type: "redness", ui_score: 74, raw_score: 61.2 },
        ],
      },
    },
  });

const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

function client(impl: typeof fetch, reserveUnits = 0) {
  return new YouCamClient({ apiKey: "test-key", reserveUnits, fetchImpl: impl });
}

describe("YouCamClient construction", () => {
  it("refuses to construct without an API key", () => {
    expect(() => new YouCamClient({ apiKey: "" })).toThrow(YouCamError);
    expect(() => new YouCamClient({ apiKey: "" })).toThrow(/YOUCAM_API_KEY/);
  });
});

describe("analyzeFrame: the full three-step flow", () => {
  it("uploads, starts a task, polls, and returns scores keyed by concern", async () => {
    const { impl, calls } = scriptedFetch([
      UPLOAD_OK,
      PUT_OK,
      TASK_CREATED,
      TASK_SUCCESS,
    ]);

    const result = await client(impl).analyzeFrame({
      bytes,
      fileName: "frame.jpg",
      contentType: "image/jpeg",
      concerns: ["texture", "redness"],
    });

    expect(result.taskId).toBe("task-xyz");
    expect(result.scores.texture.ui_score).toBe(68);
    expect(result.scores.texture.raw_score).toBeCloseTo(57.33, 5);
    expect(result.scores.redness.ui_score).toBe(74);

    // Step one: reserve a file id.
    expect(calls[0].url).toContain("/s2s/v2.0/file/skin-analysis");
    // Step two: bytes go to the presigned URL, not to the API host.
    expect(calls[1].url).toBe("https://uploads.example.com/presigned");
    expect(calls[1].init?.method).toBe("PUT");
    // Step three: the task references the returned file id.
    expect(calls[2].url).toContain("/s2s/v2.0/task/skin-analysis");
    expect(JSON.parse(String(calls[2].init?.body))).toMatchObject({
      src_file_id: "file-abc",
      dst_actions: ["texture", "redness"],
    });
    // Step four: poll the task by id.
    expect(calls[3].url).toContain("/s2s/v2.0/task/skin-analysis/task-xyz");
  });

  it("sends the API key as a bearer token and never in the URL", async () => {
    const { impl, calls } = scriptedFetch([
      UPLOAD_OK,
      PUT_OK,
      TASK_CREATED,
      TASK_SUCCESS,
    ]);

    await client(impl).analyzeFrame({
      bytes,
      fileName: "frame.jpg",
      contentType: "image/jpeg",
      concerns: ["texture"],
    });

    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key");
    for (const call of calls) {
      expect(call.url).not.toContain("test-key");
    }
  });

  it("keeps polling while the task is running", async () => {
    const running = () =>
      jsonResponse({
        status: 200,
        data: { task_status: "running", polling_interval: 0 },
      });

    const { impl, callCount } = scriptedFetch([
      UPLOAD_OK,
      PUT_OK,
      TASK_CREATED,
      running,
      running,
      TASK_SUCCESS,
    ]);

    const result = await client(impl).analyzeFrame({
      bytes,
      fileName: "frame.jpg",
      contentType: "image/jpeg",
      concerns: ["texture"],
    });

    expect(result.scores.texture.ui_score).toBe(68);
    expect(callCount()).toBe(6);
  });
});

describe("error handling", () => {
  it("surfaces a no-face error with guidance the user can act on", async () => {
    const noFace = () =>
      jsonResponse({
        status: 200,
        data: { task_status: "error", error_code: YOUCAM_ERROR_CODES.NO_FACE },
      });

    const { impl } = scriptedFetch([UPLOAD_OK, PUT_OK, TASK_CREATED, noFace]);

    await expect(
      client(impl).analyzeFrame({
        bytes,
        fileName: "frame.jpg",
        contentType: "image/jpeg",
        concerns: ["texture"],
      }),
    ).rejects.toMatchObject({
      code: YOUCAM_ERROR_CODES.NO_FACE,
    });

    const error = new YouCamError("x", YOUCAM_ERROR_CODES.NO_FACE);
    expect(error.userMessage).toContain("No face detected");
  });

  it("rejects an oversized image before spending a request on it", async () => {
    const { impl, callCount } = scriptedFetch([UPLOAD_OK]);
    const huge = new Uint8Array(11 * 1024 * 1024);

    await expect(
      client(impl).analyzeFrame({
        bytes: huge,
        fileName: "huge.jpg",
        contentType: "image/jpeg",
        concerns: ["texture"],
      }),
    ).rejects.toThrow(/10 MB/);

    expect(callCount()).toBe(0);
  });

  it("refuses to mix SD and HD concerns, which the API would reject opaquely", async () => {
    const { impl } = scriptedFetch([UPLOAD_OK, PUT_OK]);

    await expect(
      client(impl).analyzeFrame({
        bytes,
        fileName: "frame.jpg",
        contentType: "image/jpeg",
        concerns: ["texture", "hd_redness"],
      }),
    ).rejects.toMatchObject({ code: YOUCAM_ERROR_CODES.INVALID_PARAMS });
  });

  it("accepts an all-HD concern set", async () => {
    const { impl } = scriptedFetch([UPLOAD_OK, PUT_OK, TASK_CREATED, TASK_SUCCESS]);

    await expect(
      client(impl).analyzeFrame({
        bytes,
        fileName: "frame.jpg",
        contentType: "image/jpeg",
        concerns: ["hd_texture", "hd_redness"],
      }),
    ).resolves.toBeDefined();
  });

  it("requires at least one concern", async () => {
    const { impl } = scriptedFetch([UPLOAD_OK, PUT_OK]);

    await expect(
      client(impl).analyzeFrame({
        bytes,
        fileName: "frame.jpg",
        contentType: "image/jpeg",
        concerns: [],
      }),
    ).rejects.toThrow(/at least one concern/i);
  });

  it("reports a failed presigned upload rather than starting a task anyway", async () => {
    const putFail = () => new Response(null, { status: 403 });
    const { impl, callCount } = scriptedFetch([UPLOAD_OK, putFail]);

    await expect(
      client(impl).analyzeFrame({
        bytes,
        fileName: "frame.jpg",
        contentType: "image/jpeg",
        concerns: ["texture"],
      }),
    ).rejects.toThrow(/Presigned upload failed/);

    expect(callCount()).toBe(2);
  });

  it("explains a non-JSON response instead of throwing a parse error", async () => {
    const html = () => new Response("<html>gateway timeout</html>", { status: 502 });
    // Four 502s exhausts the retry budget.
    const { impl } = scriptedFetch([html, html, html, html, html, html]);

    await expect(
      client(impl).analyzeFrame({
        bytes,
        fileName: "frame.jpg",
        contentType: "image/jpeg",
        concerns: ["texture"],
      }),
    ).rejects.toThrow(/non-JSON response/);
    // Exhausting the 5xx retry ladder costs 1 + 2 + 4 + 8 seconds of backoff by
    // design, so this case needs a budget well past the vitest default.
  }, 30_000);
});

describe("retry behaviour", () => {
  it("retries a rate-limited request and then succeeds", async () => {
    let served = 0;
    const impl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/file/skin-analysis")) {
        served++;
        // Fail the first attempt with 429, succeed on the retry.
        return served === 1 ? jsonResponse({ status: 429 }, 429) : UPLOAD_OK();
      }
      if (url.includes("uploads.example.com")) return PUT_OK();
      if (url.includes("/task/skin-analysis/")) return TASK_SUCCESS();
      return TASK_CREATED();
    }) as unknown as typeof fetch;

    const result = await client(impl).analyzeFrame({
      bytes,
      fileName: "frame.jpg",
      contentType: "image/jpeg",
      concerns: ["texture"],
    });

    expect(served).toBe(2);
    expect(result.scores.texture.ui_score).toBe(68);
  }, 20_000);
});

describe("unit budget guard", () => {
  it("refuses to start an analysis that would breach the reserve", async () => {
    const credit = () => jsonResponse({ status: 200, data: { credit: 20 } });
    const { impl } = scriptedFetch([credit]);

    await expect(
      client(impl, 15).analyzeFrame({
        bytes,
        fileName: "frame.jpg",
        contentType: "image/jpeg",
        concerns: ["texture"],
        estimatedCost: 12,
      }),
    ).rejects.toThrow(/Refusing to spend/);
  });

  it("proceeds when the reserve is respected", async () => {
    const impl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/client/credit"))
        return jsonResponse({ status: 200, data: { credit: 500 } });
      if (url.includes("/file/skin-analysis")) return UPLOAD_OK();
      if (url.includes("uploads.example.com")) return PUT_OK();
      if (url.includes("/task/skin-analysis/")) return TASK_SUCCESS();
      return TASK_CREATED();
    }) as unknown as typeof fetch;

    await expect(
      client(impl, 100).analyzeFrame({
        bytes,
        fileName: "frame.jpg",
        contentType: "image/jpeg",
        concerns: ["texture"],
        estimatedCost: 12,
      }),
    ).resolves.toBeDefined();
  });
});

/**
 * Regression tests for behaviour the live API exhibited on 27 Jul 2026 that the
 * published documentation does not describe. Each of these was a real bug found
 * by calling the service, not by reading about it.
 */
describe("live-API quirks", () => {
  it("reads the v1.0 credit envelope, which uses `results` and not `data`", async () => {
    const { impl } = scriptedFetch([
      () =>
        jsonResponse({
          status: 200,
          results: [
            { id: 1, type: "ApiPaygToken", amount: 1000, expiry: 1792367999000 },
            { id: 2, type: "ApiPaygToken", amount: 40, expiry: 1816732799000 },
          ],
        }),
    ]);

    // Balances arrive as separately-expiring grants; the spendable figure is
    // their sum, not the first bucket.
    await expect(client(impl).getCreditBalance()).resolves.toBe(1040);
  });

  it("reads the feature-cost envelope, which uses `result`", async () => {
    const { impl } = scriptedFetch([
      () =>
        jsonResponse({
          status: 200,
          result: {
            skus: [
              { description: "AI Photo Enhance V1.0", amount: 2, unit: "result_image" },
              {
                description: "AI Object Removal (Standard)",
                amount: 1,
                unit: "result_image",
              },
            ],
          },
        }),
    ]);

    // The list is nested under `skus`, not the documented `features`.
    const costs = await client(impl).getFeatureCosts();
    expect(costs).toHaveLength(2);
    expect(costs[0].amount).toBe(2);
    expect(costs[0].description).toContain("Photo Enhance");
  });

  it("drops the non-concern outputs the service appends to every analysis", async () => {
    // Six concerns were requested; nine entries come back.
    const withExtras = () =>
      jsonResponse({
        status: 200,
        data: {
          task_status: "success",
          results: {
            output: [
              { type: "texture", ui_score: 73, raw_score: 62.907 },
              { type: "redness", ui_score: 99, raw_score: 100 },
              { type: "all" },
              { type: "skin_age" },
              { type: "resize_image", mask_urls: ["https://m/resized.png"] },
            ],
          },
        },
      });

    const { impl } = scriptedFetch([UPLOAD_OK, PUT_OK, TASK_CREATED, withExtras]);

    const result = await client(impl).analyzeFrame({
      bytes,
      fileName: "frame.jpg",
      contentType: "image/jpeg",
      concerns: ["texture", "redness"],
    });

    expect(Object.keys(result.scores).sort()).toEqual(["redness", "texture"]);
    // `resize_image` carries a mask URL, so filtering on masks alone would keep it.
    expect(result.scores.resize_image).toBeUndefined();
    expect(result.scores.skin_age).toBeUndefined();
  });

  it("keeps raw_score, which carries the precision the statistics need", async () => {
    const { impl } = scriptedFetch([UPLOAD_OK, PUT_OK, TASK_CREATED, TASK_SUCCESS]);

    const result = await client(impl).analyzeFrame({
      bytes,
      fileName: "frame.jpg",
      contentType: "image/jpeg",
      concerns: ["texture"],
    });

    // ui_score is an integer presentation value; raw_score is continuous, and a
    // noise floor computed from rounded integers would be badly quantised.
    expect(Number.isInteger(result.scores.texture.ui_score)).toBe(true);
    expect(result.scores.texture.raw_score % 1).not.toBe(0);
  });

  it("surfaces a camelCase errorCode, which some endpoints return", async () => {
    const { impl } = scriptedFetch([
      () =>
        jsonResponse({ status: 404, error: "Not Found", errorCode: "NOT_FOUND" }, 404),
    ]);

    await expect(client(impl).getCreditBalance()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("analyzeSession", () => {
  it("checks the balance once for the session, not once per frame", async () => {
    let creditChecks = 0;
    const impl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/client/credit")) {
        creditChecks++;
        return jsonResponse({ status: 200, data: { credit: 900 } });
      }
      if (url.includes("/file/skin-analysis")) return UPLOAD_OK();
      if (url.includes("uploads.example.com")) return PUT_OK();
      if (url.includes("/task/skin-analysis/")) return TASK_SUCCESS();
      return TASK_CREATED();
    }) as unknown as typeof fetch;

    const frames = [1, 2, 3].map((n) => ({
      bytes,
      fileName: `frame-${n}.jpg`,
      contentType: "image/jpeg",
    }));

    const results = await client(impl, 100).analyzeSession(frames, ["texture"]);

    expect(results).toHaveLength(3);
    expect(creditChecks).toBe(1);
  }, 20_000);
});
