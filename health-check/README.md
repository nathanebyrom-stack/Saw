# Website Health Check (working build)

Turns Nova's Health Check prototype (v4.8, the Vellmoor sample) into a page that checks a real website.
Type an address, the engine measures the site from outside, and the report redraws from the result.

## What's here

| Path | What it is |
|---|---|
| `prototype/original-v4.8.html` | Nova's prototype, untouched. The page is built from this. |
| `build.mjs` | Applies the changes to the prototype and writes `dist/index.html`. Each change must match exactly once, so it fails loudly if the prototype moves on. |
| `web/` | The additions: form markup, styles, the page controller, plus the browser test and a local stand-in for the engine. |
| `engine/engine.ts` | The checker. Plain web APIs, so the same file runs on Supabase and under Node. Scoring thresholds are all in `RUBRIC`. |
| `engine/index.ts` | The Supabase Edge Function wrapper: routes, rate limits, storage in `hc_reports`. |
| `engine/test/` | Two local test sites (one poor, one good) and the engine test. |
| `dist/index.html` | The built page. Works as a normal web page and as a Claude artifact. |

## Run it

```bash
node build.mjs                                              # build the page
node --no-warnings engine/test/run.mjs                      # engine tests
NODE_PATH=$(npm root -g) node --no-warnings web/test-page.mjs   # browser tests (needs Playwright)
```

## How a check reaches the engine

- **On a website** the page calls the Edge Function directly: `POST {url}` starts a run and returns an id, `GET ?id=` reads it.
- **Inside a Claude artifact** pages can't call other sites, so the page uses the viewer's Supabase connector: it inserts a `queued`
  row into `hc_reports`, a database trigger asks the Edge Function to run it, and the page reads the row back.

## What is and isn't measured

Scored automatically (15 of 18): headline (rules only), spec page, machine list, tap to call, phone layout, page weight, server speed,
quote form, reply promise, case studies, certificates, page titles, HTTPS, platform, chat and booking.

Clarity of offer is scored by rules (what, who for, where, how focused), capped at 8 because rules can't judge quality.
The site's sector is read from its words; spec page and machine list apply only to sites that read as manufacturers.

Not measured, shown as such and left out of every total: hero photo (needs judgement), local listing (checked by hand),
and spec page and machine list on non-manufacturer sites. Mobile load time (LCP) needs a Google PageSpeed Insights key
(`PSI_API_KEY` on the function).

## Not yet reviewed

- The scoring rules in `RUBRIC` are a first draft. Ruby and Leo have not seen them.
- Strings marked `[v5]` are new and have not been through Maya, Edie, Quinn, humanize or the slop gate.
- Enquiry capture is still off, as in v4.8, until the privacy notice section is live.

## Deploying the engine

The Saw repository is public, so the deployed Edge Function imports the engine straight from a pinned commit
instead of uploading it. To deploy a new engine version:

1. Commit and push `engine/engine.ts`, and note the commit hash.
2. Deploy `engine/index.ts` as the `health-check` function (JWT verification off), with its import line changed from
   `"./engine.ts"` to `"https://raw.githubusercontent.com/nathanebyrom-stack/Saw/<commit>/health-check/engine/engine.ts"`.

Live now: engine 1.1.0 from commit `1dfca48`.
