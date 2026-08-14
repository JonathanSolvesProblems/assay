# Devpost submission, field by field

Copy each block into the matching field. Written in first person throughout,
since this is a solo entry.

**Placeholders to fill before submitting** are marked `TODO`. Everything else is
final.

---

## Project name

```
Assay
```

## Elevator pitch

*(200 character limit. This is 172.)*

```
Four products on your shelf are doing nothing. Assay finds which, by measuring the error in YouCam's scores first. The only skin tracker that tells you when it cannot tell.
```

---

## About the project

*(Paste as Markdown. Devpost renders it.)*

```markdown
## Inspiration

I had acne growing up, and I did what everyone with acne does: I tried a lot of
products. The part I remember is not any single one of them, it is never knowing
which was working. You change three things at once, something eventually gets
better or it doesn't, and you carry the whole routine forward because you cannot
tell which part earned its place. So you keep buying.

It is under control now, which is exactly why I can see the problem clearly. I am
using a face wash every morning that advertises 24-hour moisturisation, and I
cannot tell you whether it does anything, which is the same not-knowing I had at
seventeen with lower stakes and the same shrug. The average woman is still holding on to four products that
did not work, spends around $170 a year trying to find ones that do, and one in
nine have been through ten or more failures ([AmLactin / OnePoll, 2,000 American
women aged 35+, February
2022](https://swns-research.medium.com/women-reveal-how-many-failed-skincare-products-theyre-still-holding-onto-f1091f8a7b1f)).
I was that one in nine for years, and the reason was never that the products were
all bad. It was that nothing could measure whether they worked.

The same survey has the detail that bothers me most as an engineer: a product
gets about three weeks to prove itself before people decide. Almost nothing in
skincare acts that fast. Retinoids need four weeks to begin and twelve to assess.
So the standard consumer verdict is being reached before the evidence could
physically exist, which is a measurement problem wearing the costume of a
willpower problem.

The measurement already exists. YouCam's Skin Analysis API scores sixteen skin
outputs from a photograph and it is a good instrument. So I started building the
obvious thing, a tracker that watches those scores over time.

Then I checked whether the scores were stable enough to track. They were not, and
that turned into the project.

## What it does

Assay answers one question: is this product doing anything on my face?

Before it reports anything about your skin, it measures how much the reading moves
when your skin has **not** changed, and turns that into a threshold. A change is
only called real when it clears that threshold.

The output is a verdict in one of six states:

- **Working**, the change clears the noise floor and the trend across sessions agrees
- **Getting worse**, it clears the floor in the wrong direction, reported early because
  an adverse reaction shows up fast
- **Expected flare**, worse, but inside the window where that active is known to purge
- **Not working**, flat, past the point where the ingredient should have done something,
  with enough data to have caught it
- **No evidence yet**, flat, but the study cannot yet resolve an effect this size, with
  the number of further sessions required
- **Cannot measure**, the concern is pinned against the end of the scale, or its error is
  wider than any effect it could show

Separating **not working** from **no evidence yet** is the part almost nothing else
does. Telling someone their retinoid failed at three weeks is not a cautious
result, it is a wrong one, because retinoids do not remodel anything on that
timescale. Assay carries the onset window for each active ingredient and refuses
to render a verdict before it.

## How I built it

Next.js and TypeScript on the front, with the YouCam Skin Analysis API as the
measurement instrument. Every frame is normalised to a fixed size, a fixed JPEG
quality and a fixed crop before it is submitted, because all three of those turned
out to move the score.

The statistics are implemented directly rather than pulled from a package: the
log gamma and incomplete beta functions, Student's t, the standard error of
measurement, the minimal detectable change, an ordinary least squares trend with
inference on the slope, and a power projection that answers "how many more
sessions". The whole claim of the project is that the numbers are defensible, so a
reviewer should be able to read the implementation and check it against a table.
Every expected value in the test suite is hand computed from the definition or
taken from a published table, never from a previous run of the code.

92 tests, none of which touch the network or spend an API unit.

Before trusting any of it I characterised the instrument. Three experiments on a
synthetic face generated with YouCam's own image generator, so no real person had
to be scored to produce those numbers:

| Source of variation | acne | moisture | texture | pore |
| --- | ---: | ---: | ---: | ---: |
| The model itself, byte identical input | 0.00 | 0.00 | 0.00 | 0.00 |
| JPEG quality, q80 to q96 | 2.91 | 0.35 | 0.12 | 2.55 |
| Brightness, plus or minus 8% | 4.86 | 3.87 | 1.96 | 1.52 |
| Cropping the same photograph differently | | | 5.81 | |

The model is perfectly deterministic, which matters more than it sounds: it means
every point of spread between two of your frames is capture variation rather than
the model changing its mind, and that is what licenses the entire method.

Everything else is capture. Re-saving the same photograph at a different
compression level moves the blemish score by 2.91 points. Standing slightly closer
to the camera moves texture by 5.81. A realistic four week treatment effect is
about five points.

## Challenges I ran into

**A frame that satisfies every documented limit can hang forever.** A 2048px,
5.27 MB image is within the published 4096px and 10 MB limits. It was accepted,
charged 12 units, and then never completed, still running after four minutes of
polling. The same face at 1024px returned in four seconds. Every frame is now
normalised before upload.

**The response envelope key is not consistent.** The docs only ever show `data`,
but `credit/feature-cost` returns `result` and `client/credit` returns `results`
with an array of separately expiring grants. Reading `data` yields `undefined`
silently rather than erroring, so the balance check was quietly broken until I
tested it.

**`feature-cost` does not list Skin Analysis at all.** It returns twenty image
editing and hair SKUs, so it cannot be used to budget a skin study. I established
the cost empirically instead: twelve units for a six concern call.

**Face size is a fraction, not a pixel count.** `error_src_face_too_small` at
full frame 1536px, but success at a 70% crop and only 1024px, with a smaller face
in absolute pixels. Upscaling never fixes it. Cropping does.

**My own method was wrong at first.** I estimated the noise floor from frames
taken seconds apart without touching the camera. Those frames cannot see the error
you add by setting the camera back up tomorrow, and since cropping alone moves
texture by 5.81 points, repositioning is the dominant error. The floor is now
estimated between sessions, and it takes whichever error is larger, never the
smaller.

## Accomplishments that I am proud of

Catching the trap in a perfect score. On a face with no visible redness the API
returned exactly 100.00 on every variant, including a full illumination sweep.
Read naively that is a noise floor of zero, the most trustworthy metric on the
panel. It is the opposite: a reading pinned to the top of its range cannot move
upward, so it can never show improvement, and its zero variance is a ceiling
artefact. Reporting a beautifully tight error bar for a measurement that is not
measuring anything would have been the single most misleading thing this app could
do. Assay detects it and declines.

And the number that came out of the real study. Three calibration sessions from
one continuous recording of me sitting still: radiance fell 9.54 points across
fifteen minutes, monotonically, on skin that by construction did not change. The
afternoon light through the window faded and the score followed it. That is the
entire argument for the project, measured on a real face rather than asserted.

Those same fifteen minutes give the cleanest test I can offer, because skin
cannot change in fifteen minutes and therefore there is nothing real in that data
to find. A tracker that shows you a score and compares it to last time would have
reported **ten of the twelve** session-to-session comparisons as a change in my
skin, the largest a 17.0 point swing in redness. Every one would have been false.
Assay reported none of them. That is not the tool being cautious, it is the tool
having measured what this instrument does when nothing happens.

Then the study itself returned a verdict I did not want. Four sessions on a
Dove Men+Care Extra Fresh Body & Face Wash, and texture came back at −7.5
against a floor of ±3.1,
with blemishes at −6.9 against ±6.4. Both read **getting worse**, at moderate
confidence.

The hydration result is the one worth sitting with, because it is the claim the
product actually makes. The label promises 24-hour moisturisation, so I assessed
it on the timescale it set for itself rather than one I chose afterwards: the
humectant window in the catalogue opens at day 1. Moisture came back at −2.1
against a floor of ±2.9, which is **no evidence yet**. That is not a finding that
the product fails, and Assay does not say so. It is the honest and much less
satisfying statement that four sessions on one face cannot resolve an effect this
size, and that anyone claiming otherwise from the same data would be reading
noise. A rinse-off cleanser is a weak intervention by construction, which is
recorded in the study file rather than discovered later.

That is the shape of the commercial problem underneath this project. Advertised
claims are stated in absolute terms, on timescales the seller picks, and the
measurement that would confirm or refute them is not something a buyer has ever
had. Assay is the smallest working version of giving them one. The other four concerns stayed at no
evidence yet and are labelled as such. I am the person who had acne growing up and
built this to find out what works, and the first thing it told me was that
something I bought was not helping. I would rather know, and shipping that result
unedited is the only version of this project worth entering.

## What I learned

That the interesting problem was one layer below where I started. I set out to
build a tracker and found that the thing worth building was the error model
underneath it, because without one a tracker is mostly reporting the weather.

Also that a good instrument and a usable measurement are different things. The
YouCam scores are consistent and the model is deterministic. What is not stable is
the photograph, and almost all of the engineering here is about holding the
photograph still.

## What is next for Assay

The same engine aggregated across subjects is a claims panel. A contract research
lab charges $25,000 to $80,000 for a skincare efficacy study; the machinery to run
one for a few hundred dollars is already here and only needs more people pointing
cameras at themselves. That maps onto the FTC's "competent and reliable scientific
evidence" standard for advertising claims, which is a budget line an order of
magnitude larger than the marketing spend that currently buys virtual try-on
widgets.

Nearer term, two things, both of which come straight out of the measurements
rather than a feature wishlist.

Live stability detection during capture. The error budget says movement is the
largest term in it: re-cropping the same photograph moves texture by 5.81 points,
against a realistic four week treatment effect of about five. Assay already holds
capture until the light is usable, and the same idea applies to the larger error
source, which is holding it until the subject is actually still. Frame to frame
differencing would let the capture screen say hold still and then steady, so the
error is prevented at the source instead of measured afterwards and widening
everybody's floor. I did not ship it for this submission because the capture path
was the one thing that had to work on the morning of the final study session, and
a working measurement was worth more than a better-guided one.

Establishing a real minimal clinically important difference for the scale, through
anchor based studies. The five point threshold Assay uses is currently a product
decision rather than a clinical constant, and it is labelled as such in the app.
```

---

## Built with

*(Comma separated, up to 25 tags.)*

```
youcam-api, perfect-corp, skin-analysis-api, ai-image-generator, typescript, next.js, react, tailwindcss, node.js, sharp, ffmpeg, vitest, vercel, statistics, computer-vision, rest-api
```

---

## "Try it out" links

```
https://assay-lime.vercel.app
https://github.com/JonathanSolvesProblems/assay
```

---

## App Status

```
New
```

## What date did you start this project? (MM-DD-YY)

```
07-27-26
```

## If Existing, explain what you updated during the submission period.

*(Leave blank. This is a new project.)*

---

## Text description explaining the features, functionality, and consumer or retail value

```
Assay tells a shopper whether a skincare product is actually working on their own
face, using the YouCam Skin Analysis API as a measurement instrument rather than as
a scoring widget.

The consumer problem is concrete. The average woman spends around $170 a year on
skincare that turns out not to work and is holding four products that never
delivered, with no way to tell which four. Skin scores exist, but a score reported
without its error cannot support that decision.

Assay measures the instrument's error first. It takes several captures where the
skin cannot have changed, derives a standard error of measurement and a minimal
detectable change for that person on that device, and only reports a change that
clears it. Below that threshold it returns "not enough evidence yet" along with the
number of further sessions needed, rather than an encouraging number.

It also knows what it is looking at. Each active ingredient carries the timescale
on which it can physically act, so a retinoid is never called a failure at three
weeks, and a temporary flare inside a known purge window is distinguished from an
adverse reaction. Concerns whose measurement error is wider than any effect they
could show are marked unmeasurable instead of being given a confident verdict.

The retail value is twofold. For a shopper it converts an ongoing subscription into
a decision with evidence behind it, which is worth roughly the cost of the products
they would otherwise keep buying. For a brand or retailer, the same engine
aggregated across subjects is a claims substantiation panel: the efficacy study a
contract research lab charges $25,000 to $80,000 for, run for a few hundred, which
is the evidence standard the FTC expects behind an advertising claim.

Everything the app displays comes from a real capture. The study data in the
repository is a genuine prospective n-of-1 study, and no readings are generated or
seeded.
```

---

## URL to your code repository

```
https://github.com/JonathanSolvesProblems/assay
```

---

## Was there a moment during the hackathon where the API surprised you, in a good or frustrating way?

```
Two, and they pulled in opposite directions.

The frustrating one: a 2048px, 5.27 MB frame is inside every documented limit,
long side under 4096 and file size under 10 MB. It was accepted, it charged 12
units, and then it simply never finished. Still "running" after four minutes of
polling. The identical face resized to 1024px came back in four seconds. Obeying
the documented limits is not sufficient for a task to complete, and the units are
spent either way. I now normalise every frame before upload.

The good one, and it is the reason the project works at all: the model is
perfectly deterministic. I sent byte identical input three times and got a standard
deviation of exactly 0.000 across all six concerns. That is not a small detail. My
whole method estimates measurement error from the spread between replicate frames
and attributes it to capture variation, and that attribution is only valid if the
model returns the same answer for the same input. Perfect Corp does not publish
this anywhere I could find, so I measured it, and it licensed everything built on
top.

A smaller surprise worth passing on: face size is enforced as a fraction of the
frame, not a pixel count. A full frame at 1536px was rejected as
error_src_face_too_small while a 70% crop at 1024px passed, with a smaller face in
absolute pixels. Upscaling never helps. Cropping does. Also, rejected frames cost
nothing, which makes framing too tight a cheap mistake to test for.
```

---

## Are there industries or use cases you think Perfect Corp.'s API could serve that nobody is talking about yet?

```
Claims substantiation. Right now the API is sold as a conversion widget, paid for
out of a marketing budget. The same scores, captured under a controlled protocol
with an error model on top, are an instrument, and that opens a different and much
larger budget line.

A skincare efficacy study through a contract research lab costs $25,000 to $80,000
and takes 4 to 12 weeks. That price exists because instrumental measurement,
corneometry, profilometry and the rest, requires a clinic. A brand that could run a
panel of 30 people at home, with a documented minimal detectable change and per
concern effect sizes with confidence intervals, would be producing exactly the kind
of evidence the FTC's "competent and reliable scientific evidence" standard expects
behind an advertising claim, for two orders of magnitude less. Indie brands
currently cannot afford that at all, so they make softer claims or unsupported
ones.

The prerequisite is publishing reliability figures. Nobody can build a
claims-grade product on a score whose test-retest reliability is unknown. Shipping
an official per concern SEM, and flagging when a reading is saturated against the
end of the scale, would turn the API from a feature into an instrument.

Two adjacent ones. Dermatology teletriage, where the useful output is not a
diagnosis but whether a lesion or an inflammation has genuinely changed since the
last photograph, which is the same minimal detectable change problem. And adverse
reaction monitoring for a brand post launch, where you want to detect the cohort
whose redness is trending the wrong way before it becomes a recall, and where the
value is in a reliable negative as much as a positive.
```

---

## Where did you hit a wall technically? How did you work around it?

```
The wall was that my own noise floor was wrong, and it was wrong in the direction
that flatters the product.

I was estimating measurement error from replicate frames taken seconds apart
without touching the camera. That captures sensor and micro-pose noise and nothing
else. Then I ran an experiment that cropped one photograph two different ways and
scored both: the texture score moved 5.81 points on identical pixels, larger than a
realistic four week treatment effect.

Which meant that setting the camera back up tomorrow is not a neutral act, it is
probably the largest single source of error in the whole pipeline, and my floor
could not see it at all. Every verdict would have been over-confident, and
repositioning noise would have been reported as product efficacy. That is precisely
the failure the project exists to prevent, so it was not something I could ship
around.

The fix was to estimate the floor between sessions rather than within them.
Calibration is now several sessions separated in time, so the spread across their
means carries the drift that accumulates between sittings rather than only the
noise inside one. I want to be exact about how far that goes, because it is the
boundary of the claim. The three calibration sessions here are sampled from
separate windows of one continuous recording, so they capture pose, distance and
expression drift but not the error of physically taking the camera down and
setting it back up. The floor is a lower bound, and the consequence cuts against
me rather than for me: an underestimated floor makes verdicts fire more readily
than they should. A teardown between sessions would widen every band and make
every verdict harder to earn. That limitation is recorded in the study data file
itself, not only in the writeup. Writing that surfaced a second problem: with only three sessions the
between-session estimate is itself very noisy and can land below what the frames
support, which would claim precision the data does not contain. So the floor takes
whichever of the two errors is larger, never the smaller. Both are lower bounds on
the truth, and the larger lower bound is the defensible one.

Smaller walls, all found by calling the API rather than reading about it: the
response envelope key varies between data, result and results across endpoints of
the same version, so reading data silently yields undefined on the credit
endpoints. The feature-cost catalogue does not list Skin Analysis, so a study
cannot be budgeted from it and I measured the cost empirically at 12 units per six
concern call. And requesting six concerns returns nine outputs, three of which
carry no score and would inject undefined values straight into the statistics.
```

---

## Share a link to any social posts about your project

```
TODO or leave blank
```

---

## Pre-submission checklist

- [ ] Deployed URL is live and the API key is set in the host's environment
- [ ] Repo is public, `README.md` explains how to run it, `.env.example` present
- [ ] Demo video is on YouTube, public, no login, 1 to 3 minutes
- [ ] Video shows the deployed site running, not slides
- [ ] Video says which YouCam API is used
- [ ] No copyrighted music in the video
- [ ] Screenshots attached, at least the home page with the instrument table and a
      verdict card
- [ ] Thumbnail image at 3:2, under 5 MB
- [ ] Topic selected: **Skin AI**
- [ ] `TODO` placeholders above all replaced
