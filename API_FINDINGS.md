# YouCam API, findings from integration

Verified against the live service on 27 Jul 2026 with a hackathon account.
Everything below was established by calling the API, not by reading about it.
Several of these contradict or are absent from the published documentation.

## 1. A frame that satisfies every documented limit can hang forever

This is the most expensive finding, and the one most likely to cost another
entrant their submission.

| Frame | Documented limits | Result |
|---|---|---|
| 2048×2048, 5.27 MB | Passes (long side ≤ 4096, size < 10 MB) | **Never completed.** Still `running` after 4 minutes of polling. **12 units debited anyway.** |
| 1024×1024, 167 KB | Passes | `success` in **4 seconds** |

Identical source image, identical concern set. Obeying the documented limits is
not sufficient for the task to complete, and the units are spent regardless.

Assay normalises every frame to a 1024px long edge before upload
(`src/lib/youcam/image.ts`). That is also good measurement practice: a fixed
capture size removes resolution as a source of between-session variance.

## 2. The response envelope key is inconsistent across the same API version

The docs only ever show `data`. Reading only `data` silently yields `undefined`
on the credit endpoints rather than erroring.

| Endpoint | Payload key |
|---|---|
| `/s2s/v2.0/file/skin-analysis` | `data` |
| `/s2s/v2.0/task/skin-analysis/{id}` | `data` |
| `/s2s/v2.0/task/template/cloth` | `data` |
| `/s2s/v2.0/credit/feature-cost` | `result` |
| `/s2s/v1.0/client/credit` | `results` (array) |
| `/s2s/v1.0/file/skin-analysis` | `result` |

Error codes are also inconsistent: mostly `error_code`, but `/s2s/v2.0/credit`
returns `errorCode`.

## 3. `feature-cost` does not list Skin Analysis or Clothes VTO

`GET /s2s/v2.0/credit/feature-cost` returns exactly 20 SKUs, all image-editing
and hair features, nested under `result.skus`: not the documented
`features`, and each entry is `{description, amount, unit, proc_unit,
run_task_url}` rather than `{feature, cost}`.

Skin Analysis and Clothes VTO are both fully functional but absent from the
catalogue, so **the cost endpoint cannot be used to budget a skin study.**

Measured empirically instead: **six SD concerns in one call debits 12 units.**

## 4. Credit is returned as separately-expiring grants

`/s2s/v1.0/client/credit` returns an array, not a scalar:

```json
{ "status": 200, "results": [
  { "type": "ApiPaygToken", "amount": 1000, "expiry": 1792367999000 },
  { "type": "ApiPaygToken", "amount":   40, "expiry": 1816732799000 } ]}
```

The spendable balance is the sum. Reading the first bucket under-reports it.

## 5. Requesting six concerns returns nine outputs

Alongside the requested concerns the service appends `all`, `skin_age` and
`resize_image`. `skin_age` and `all` carry no `ui_score` or `raw_score`;
`resize_image` carries a `mask_urls` entry, so filtering on "has a mask" is not
enough to exclude it. Passing these into a statistics layer injects `undefined`
scores.

## 6. `ui_score` is a non-linear remap of `raw_score`

| Concern | `ui_score` | `raw_score` |
|---|---|---|
| redness | 99 | 100 |
| radiance | 81 | 81.32 |
| moisture | 68 | **45.43** |
| pore | 75 | 66.47 |
| texture | 73 | 62.91 |
| acne | 91 | 94.17 |

`ui_score` is an integer presentation value; the mapping is concern-specific and
clearly non-linear (moisture 45.4 → 68). **Assay computes every statistic
on `raw_score`** and displays `ui_score`. A noise floor derived from rounded
integers would be badly quantised, and quantisation would masquerade as
precision.

I measured the remap before I read the reason for it, and the documentation is
franker than I expected. Perfect Corp describe `ui_score` as "a psychological
motivator," deliberately adjusted upward from the raw value because "consumers
generally prefer positive evaluations regarding their skin health."

That is a defensible product decision and I am not criticising it. It is also
the single clearest argument for this project. The number a skincare app shows
you is, by design and by the vendor's own account, kinder than the measurement
underneath it. My table above puts a size on that kindness: **moisture reads
45.4 and displays 68**, a 22.6 point upward adjustment on the one concern a
hydrating product is supposed to move. An app that scored progress on the
displayed number would be reading an encouragement as evidence, twice over,
once from the motivational remap and once from the noise floor that nobody
measures. Assay reads `raw_score` for exactly this reason.

Source: [Inputs and Outputs](https://docs.perfectcorp.com/reference/ai_skin_analysis/section/overview/inputs-and-outputs)

## 7. Masks are real, pixel-aligned, and per-concern

Returned as RGBA PNGs at exactly the input resolution (1024×1024 in, 1024×1024
out), named `{uuid}_{concern}_output.png`. Content differs by concern type:

- `moisture`, dense heatmap (channel means 13/68/101/60)
- `texture`, `pore`, sparse localised findings (channel means ≈ 0.4–2)
- `radiance`, near-uniform tint, varying alpha
- `redness` at score 99/100, **entirely empty**, correctly, because nothing was
  detected

### Why this did not become split-face analysis

Pixel alignment makes a left/right split at the facial midline geometrically
possible, and a split-face design is dermatology's gold standard for controlling
confounds. It was scoped as a stretch goal and **deliberately dropped.**

Mask density per hemiface is a *different quantity* from the API's `raw_score`,
and it would be a new measurement with no validation behind it. Shipping an
unvalidated measurement inside a project whose entire argument is measurement
rigour would undermine the thing being argued. The masks are used as visual
evidence of *where* a change occurred instead.

## 8. Latency and limits, as observed

- Skin analysis at 1024px: **~4 seconds** end to end
- Text-to-image (`youcam-image-v2`): ~10 seconds
- Rate limits (5 QPS, 250 requests / 300 s per token) were never approached;
  the client queues requests at a 240 ms minimum spacing regardless
- Presigned upload URLs are S3 accelerate endpoints with a 7200 s expiry
- Result URLs also expire in 7200 s, so masks must be fetched promptly or
  re-polled from the task

## 9. The model is deterministic, measured, not assumed

Run `scripts/experiment-reliability.mjs`. Raw output in `experiments/reliability.json`.

Assay estimates the standard error of measurement from the spread across
replicate frames within a session, and attributes all of that spread to capture
variation. That attribution is only valid if the model returns the same answer
for the same input. Perfect Corp does not publish this, so it was measured.

**Byte-identical input, analysed three times:**

| concern | range | SD |
|---|---|---|
| texture, redness, moisture, acne, pore, radiance | 0.000 | **0.000** |

The model is fully deterministic. Every point of within-session spread is
therefore capture variation, pose, distance, illumination, and none of it is
model noise. This is what licenses the whole method.

### The error budget

Because model noise is zero, the remaining error can be decomposed by source.
Same face, same framing, one variable changed at a time:

| Source of variation | acne | moisture | texture | pore | radiance |
|---|---|---|---|---|---|
| Model (identical bytes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| JPEG quality q80 → q96 | 2.91 | 0.35 | 0.12 | 2.55 | 0.11 |
| Brightness ±8% | **4.86** | 3.87 | 1.96 | 1.52 | 0.69 |

Two consequences:

1. **Re-encoding alone moves acne by 2.9 points.** The pixels are visually
   indistinguishable; only the compression differs. Assay encodes every
   frame at a fixed quality (88) for exactly this reason, varying it would
   inject error that looks like a result.
2. **An 8% brightness change moves acne by 4.9 points and moisture by 3.9.**
   That is roughly the difference between a window and a lamp, it is barely
   perceptible to a person, and it is larger than most real one-week treatment
   effects. A tracker comparing today's score to yesterday's, with no error
   model, is mostly reporting the weather.

### Redness is saturated, not stable

Redness returned 100.00 on nearly every variant, including all three
illumination levels. **Its zero variance is a ceiling artefact and must not be
read as robustness.** A metric pinned at the top of its range cannot show
movement in either direction, so on this face it carries no information at all.
Assay flags a concern as saturated when its calibration readings sit at
the scale boundary, rather than reporting an impressively tight noise floor for
a measurement that is not measuring anything.

## 10. Face size is a fraction of the frame, not a pixel count

`error_src_face_too_small` is not about resolution. Measured on the same source
photograph:

| Crop | Output size | Face size in pixels | Result |
|---|---|---|---|
| Full centre square | 1536 x 1536 | ~555 px | **rejected** |
| Centre 70% | 1024 x 1024 | ~528 px | accepted |

The rejected frame contained the *larger* face in absolute pixels. Upscaling
never fixes this error; cropping in does. Assay crops to a fixed 70%
window with an upward bias before downscaling.

Rejected frames **cost no units**: the balance was unchanged across an
`error_src_face_too_small`. Framing slightly too tight is a cheap mistake;
framing too loose is a free one.

## 11. The crop itself moves the score, by more than a treatment effect

The most consequential finding for anyone building longitudinal tracking on this
API. One video frame, two crops of the same face:

| Crop of the same frame | texture `raw_score` |
|---|---|
| Left square, 1080 x 1080 | 86.70 |
| Tighter 820 window resized to 1024 | 92.51 |

**5.81 points of difference, from cropping alone.** The skin is identical: the
same instant of the same photograph. For comparison, a realistic four-week
treatment effect is around five points.

Two consequences, both of which shape this whole project:

1. The crop geometry has to be **frozen for the life of a study**. Assay
   applies one fixed rule (`CROP_FRACTION`, `CROP_TOP_BIAS` in
   `scripts/capture.mjs`) and never varies it per session. Re-cropping between
   sessions would manufacture effects larger than the ones being measured.
2. It means **framing distance is itself a measurement variable**. Standing
   slightly closer to the camera on day 4 than on day 0 is not a neutral act;
   it moves the number by more than the product does.

This is the strongest single argument for why a skin score reported without a
noise floor cannot support a claim.

## 12. A score can drift ten points in fifteen minutes with the skin unchanged

Measured on a real subject, not a synthetic one. Three calibration sessions were
sampled from separate windows of a single continuous nineteen-minute recording:
same person, same camera, same seat, same clothes, no product applied, no
opportunity for skin to change.

Session means:

| Concern | 2 min | 8.7 min | 15 min | Floor (MDC95) |
|---|---|---|---|---|
| moisture | 87.8 | 88.0 | 86.1 | **±2.9** |
| texture | 96.3 | 97.6 | 95.4 | **±3.1** |
| pore | 92.9 | 92.8 | 94.4 | ±4.0 |
| acne | 92.8 | 96.5 | 92.3 | ±6.4 |
| radiance | 93.0 | 89.5 | **83.4** | ±13.4 |
| redness | 75.8 | 71.7 | **88.7** | ±24.6 |

**Radiance fell 9.54 points across fifteen minutes**, monotonically, on skin that
by construction did not change. The recording ran into late afternoon, so the
daylight through the window was fading, and the score followed it.

Redness drifted 12.86 points over the same window, and its full range across the
three sessions was 17.0. Those are two different statistics and only the first is
the drift; the range is quoted separately here rather than folded into the drift
figure, because a project about not overstating a number does not get to overstate
its own.

A tracker without an error model, comparing a Monday reading against a Tuesday
reading, would report both of those as progress or decline. They are the room.

The practical consequence for this study is that the six concerns split cleanly:

- **moisture (±2.9) and texture (±3.1) are measurable.** A hydrating product can
  move hydration by five to fifteen points, comfortably clear of the floor.
- **pore (±4.0) and acne (±6.4) are marginal.**
- **radiance (±13.4) and redness (±24.6) cannot support a verdict** under these
  capture conditions, and Assay will decline to give one rather than report a
  change it cannot stand behind.

Publishing that split is the point. Knowing which of your metrics are capable of
answering the question is worth more than a confident answer from one that is not.

## 13. Undocumented required parameters

`POST /s2s/v2.0/task/text-to-image/youcam` requires both `model` and `prompt`.
The only accepted `model` value is `youcam-image-v2`; the API helpfully returns
the valid enum on a bad value, which is the fastest way to discover payload
shapes across this API generally.

## 14. The task endpoint reports its failure code in a different field

A failed upload returns the reason in `error_code`. A failed *task* returns it
in `error`, as a bare code string, and leaves `error_code` unset:

```json
{ "task_status": "error", "error": "error_large_face_angle" }
```

Reading `error_code` alone therefore yields `undefined` for every analysis
failure, which is the class of failure a person actually hits: turned head,
face too small, no face. Assay had a complete message map keyed on those codes
and none of it ever fired, so a real user mid-capture was shown the raw
identifier `error_large_face_angle` instead of an instruction.

This is the same shape as finding 2, where the success envelope key varies
between `data`, `result` and `results` across endpoints of one API version.
Read both fields.
