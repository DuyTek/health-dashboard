# Key Product Decisions

> Owned by `feat/health-data-dashboard`. Keep in sync with the code (see `.claude/CLAUDE.md`).

## The user

**Daniel Park, 38, project manager in Seattle.** He sits 8–9 hours a day. At his
July check-up his blood pressure was 136/87, and his doctor suggested lifestyle
changes and a re-check in three months instead of medication. He weighs about
86 kg (BMI ~27.6), sleeps badly when he stays up on screens, and in his own words
wants to _"get my blood pressure back to normal without medication, lose about
5 kg, and stop feeling wiped out every afternoon."_

He started a lunchtime walking routine on 10 Sep 2026, about six weeks before
"today" (22 Oct 2026). The 90-day dataset (`src/data`) tells that story:

- Steps rise ~40% after the routine starts, and active minutes and HRV go up.
- Resting heart rate, weight (-3 kg) and blood pressure ease down slowly. BP is
  improving but still above 120/80.
- Sleep stays the weak spot (~6 h 45 m), and late Friday/Saturday bedtimes cost him
  about 40 minutes of sleep.
- Protein stays well below his 120 g target.
- Real-world gaps: the watch isn't worn some nights, meals aren't always logged
  (less often at weekends), he weighs in about 5 days a week, and he takes about
  3 BP readings a week.

What he cares about is **"Is what I'm doing working, and what should I do next?"**
He isn't trying to read raw sensor data.

## What the dashboard shows, and why

In priority order, top to bottom on mobile:

1. **Greeting, date, and his own motivation.** This anchors everything to his
   goal and makes the "as of" date explicit, because all the data is relative to
   it.
2. **Today at a glance:** steps, last night's sleep, resting HR, weight and BP.
   These five map directly to his three goals (BP, weight, energy). Each shows a
   delta against his own 7-day average, not a population norm, coloured by
   whether that change is _good for that metric_ (lower RHR, weight and BP are
   good). Readings not taken today say when they were last taken, so a
   Wednesday BP reading isn't mistaken for today's.
3. **What to focus on:** deterministic, rule-based insights, warnings first.
   This is the "so what" layer: what needs attention (sleep, protein), what's
   working (steps up, BP and RHR trending down, weight down), and useful context
   (late bedtimes cost him 39 min of sleep; BP is still above 120/80, so he
   should share the trend at his follow-up). The rules are pure functions
   (`src/lib/health/insights.ts`), so every number is traceable, and they are
   the same facts the AI assistant receives.
4. **Goals:** progress from his baseline toward each target, with a status
   (Achieved / On track / Needs attention / No data). Progress is measured from
   where he started, not from zero: going from 136 to 131 mmHg toward 125 is 45%
   of the way, and that motivates more than "105% of target". The basis (7-day
   average or latest reading) is shown so the number is unambiguous.
5. **Trends:** a 7/30/90-day range toggle over tabs (Activity, Sleep, Heart,
   Weight, Nutrition). This is where he goes to explore. It sits below the
   summary layers because most visits only need the first three.
6. **Recent activities:** the last 10 sessions with duration, distance, calories
   and average HR, plus 7-day totals. This confirms the routine is actually
   happening.

On desktop, Insights and Goals move to a right rail beside Trends, so the
"what to do" stays visible while he explores the charts.

## Visualizations

| Metric          | Chart                                          | Why                                                                                                                             |
| --------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Steps           | Bars + dashed goal line                        | Daily totals are discrete amounts, and the goal line makes hits and misses obvious.                                             |
| Active minutes  | Bars + goal line                               | Same reasoning as steps.                                                                                                        |
| Sleep           | Stacked bars (deep / REM / light) + 7.5 h goal | Shows total and composition in one mark. Deep sleep is the darkest segment.                                                     |
| Resting HR, HRV | Two small line charts side by side             | Different units, so no dual axis: a second y-scale invites false correlations.                                                  |
| Blood pressure  | Two lines (systolic solid, diastolic dashed)   | Same unit (mmHg), so one axis works. Dots mark the actual readings (~3/week), and nulls are connected rather than plotted as 0. |
| Weight          | Line with dots + goal line                     | Slow trend with sparse readings. A zoomed y-domain makes a 3 kg change visible.                                                 |
| Protein         | Bars + 120 g goal line                         | This is the open warning, so it gets its own chart.                                                                             |
| Calories        | Stacked bars by macro (kcal)                   | Shows intake and where it comes from without needing a calorie target he doesn't have.                                          |

- At 90 days, bar charts become 90 slivers, so rows are **aggregated into ISO
  weekly averages** (`aggregateWeekly`), and the card says so.
- All charts use the shadcn `ChartContainer` with theme `var(--chart-N)` colors,
  a shared tooltip, and legends wherever there are two or more series.
- Every chart has a one-line caption (e.g. "Avg 8,446 a day, last 30 days ·
  goal 8,000"). It is also the accessible summary of the `<figure>`.
- Animations are off. The charts are meant to be read, not watched, and range
  switches don't re-animate.

## UX states

- **Loading:** a skeleton that mirrors the final layout (KPI row, rail cards,
  chart card) so nothing jumps, with an sr-only `role="status"` message. The
  fetch is simulated (600 ms) in the Redux thunk, so this is a real code path.
- **Error:** a destructive `Alert` with the error message and a **Try again**
  button that re-dispatches the load.
- **Empty:** with no days at all, a friendly empty card. Per chart, "No data for
  this period." Per list, empty messages for goals, insights and activities. KPI
  tiles show "No reading" with a dash.
- **Missing data inside a range:** shown as gaps (bars) or connected lines
  (sparse metrics), never as zeros. A "stale data" insight appears if sleep,
  weight or BP hasn't been logged in 4+ days.
- **Responsive:** mobile-first. The KPI grid goes 2 → 3 → 5 columns. Insights and
  Goals come before Trends on mobile and move to a right rail at `lg`. The tab
  list scrolls horizontally if it can't fit.
- **Accessibility:** semantic headings and regions, and `<figure>` with
  captions for charts. Deltas use arrows plus sr-only "better/worse than your
  7-day average" text, so meaning never depends on color alone. Progress bars
  have `aria-valuetext`. The range toggle is a radio group with descriptive
  labels ("last 90 days").

## What I deliberately left out

- **Mood, calories burned, water and HRV as KPI tiles.** They're tracked, and
  the assistant can use them, but they don't map to his goals. Showing them all
  at the top would dilute what matters. Water appears as an insight. HRV
  appears in the Heart tab.
- **A single "health score."** It's opaque, and it hides which lever to pull.
- **Population benchmarks and percentiles.** Comparing him with himself is more
  actionable and less discouraging.
- **Editing goals, logging data, device sync, auth, settings.** These are out of
  scope for a read-only insight dashboard.
- **Date pickers and custom ranges.** Three presets cover the questions he asks
  ("this week / this month / since I started").
- **LLM-generated insights on the dashboard.** The dashboard insights are rules,
  so they're instant, free, testable and can't hallucinate. Open-ended questions
  go to the assistant.

## Assumptions

- The brief's persona and dataset were not attached, so the persona and data are
  fictional and seeded (mulberry32, fixed seed, fixed `asOf` 2026-10-22). Every
  run, test and server call sees identical data.
- "Today" is the dataset's `asOf`, not the wall clock. That's why there's no
  time-of-day greeting.
- The sleep record on date D is the night ending on the morning of D. A bedtime
  before noon means after midnight.
- Health thresholds are general guidance, not personal medical advice: 7 h
  sleep, 150 active min/week, 120/80 mmHg, ~2 L water.
- A goal is **on track** if it's at least 70% of the way from baseline to target,
  or if its 30-day trend is moving toward the target.

## Limitations

- Static, synthetic data. No real device or API integration. The "fetch" is a
  simulated delay.
- Trend detection compares the last 30 days with the prior 30 using per-metric
  dead-bands (e.g. ±3% for steps, ±0.5% for weight, ±1.5% for BP). It is not a
  statistical test, and noisy metrics can flip near the threshold.
- Weekly aggregation averages whatever days exist, so a week with two logged
  meals counts the same as a full week.
- Chart colors come from the base (neutral/grayscale) shadcn theme. Series are
  told apart by lightness, legends, and dashes for BP rather than by hue.
- Charts are not keyboard-explorable point by point. The caption and the
  insights carry the key numbers instead.

## Tradeoffs

- **Precomputed summary over ad-hoc chart math:** `buildHealthSummary` is one
  pure function shared with the assistant. That guarantees the dashboard and AI
  quote the same numbers, at the cost of computing metrics the UI doesn't show.
- **Rules over ML/LLM for insights:** they're predictable and testable, but they
  only cover patterns I wrote rules for.
- **Tabs over one long scroll of charts:** less scrolling and a calmer page, but
  cross-metric comparison (e.g. sleep vs RHR) means switching tabs.
- **Weekly bars at 90 days:** readable, but they lose day-level detail (daily
  values are still available at 30 days).
- **Full dataset in Redux:** simple, and 90 days is small, but it wouldn't scale
  to years of minute-level data without a paged API.
