/**
 * wikiEvents.ts — Fetches real-world events from Wikipedia REST API
 * and maps them to the dataset date range for timeline annotation.
 *
 * Strategy:
 *   1. Try the Wikipedia "on this day" feed for key dates and institutions
 *   2. Fall back to our PINNED_EVENTS constant if the API is slow/down
 *   3. Cache results in module scope (survives page navigation in Next.js)
 *
 * The event pins appear as vertical lines on the velocity chart,
 * connecting offline events to online narrative spikes.
 */

export interface WikiEvent {
  date:  string;   // ISO "YYYY-MM-DD"
  title: string;
  description: string;
  url:   string;
  color: string;   // matches topic color closest to that event
}

// Hardcoded key events — shown even if API fails
const PINNED_EVENTS: WikiEvent[] = [
  {
    date:        "2019-12-18",
    title:       "Impeachment of Donald Trump",
    description: "The U.S. House of Representatives votes to impeach President Donald Trump.",
    url:         "https://en.wikipedia.org/wiki/First_impeachment_of_Donald_Trump",
    color:       "#1D9E75",
  },
  {
    date:        "2020-11-03",
    title:       "2020 United States presidential election",
    description: "Election day in the U.S. presidential race, followed by intense legitimacy and counting narratives.",
    url:         "https://en.wikipedia.org/wiki/2020_United_States_presidential_election",
    color:       "#7F77DD",
  },
  {
    date:        "2021-01-06",
    title:       "January 6 United States Capitol attack",
    description: "Violence at the U.S. Capitol reshapes discourse around election legitimacy, security, and institutions.",
    url:         "https://en.wikipedia.org/wiki/January_6_United_States_Capitol_attack",
    color:       "#1D9E75",
  },
  {
    date:        "2021-03-11",
    title:       "American Rescue Plan Act of 2021",
    description: "Major U.S. relief legislation drives policy framing debates on spending, inflation, and welfare.",
    url:         "https://en.wikipedia.org/wiki/American_Rescue_Plan_Act_of_2021",
    color:       "#7F77DD",
  },
  {
    date:        "2022-06-24",
    title:       "Dobbs v. Jackson Women's Health Organization",
    description: "U.S. Supreme Court ruling sparks nationwide protest and major shifts in rights-related political narratives.",
    url:         "https://en.wikipedia.org/wiki/Dobbs_v._Jackson_Women%27s_Health_Organization",
    color:       "#1D9E75",
  },
  {
    date:        "2022-08-16",
    title:       "Inflation Reduction Act",
    description: "U.S. legislation becomes a focal point for fiscal and partisan narrative competition.",
    url:         "https://en.wikipedia.org/wiki/Inflation_Reduction_Act",
    color:       "#7F77DD",
  },
  {
    date:        "2023-10-03",
    title:       "Removal of Kevin McCarthy as Speaker",
    description: "U.S. House leadership ouster amplifies procedural and institutional stability narratives.",
    url:         "https://en.wikipedia.org/wiki/October_2023_removal_of_Kevin_McCarthy",
    color:       "#1D9E75",
  },
];

let _cache: WikiEvent[] | null = null;

/**
 * Returns political and civic events relevant to the dataset window.
 * Tries to enrich with Wikipedia API data, falls back gracefully.
 */
export async function fetchWikiEvents(): Promise<WikiEvent[]> {
  if (_cache) return _cache;

  // Try to fetch additional context from Wikipedia for each pinned event
  // We don't fetch ALL events (too slow) — just enrich our pinned set
  const enriched = await Promise.all(
    PINNED_EVENTS.map(async (evt) => {
      try {
        const [year, month, day] = evt.date.split("-");
        const res = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
            evt.title.replace(/ /g, "_")
          )}`,
          { signal: AbortSignal.timeout(2000) }  // 2s timeout
        );
        if (!res.ok) return evt;
        const data = await res.json();
        return {
          ...evt,
          description: data.extract
            ? data.extract.slice(0, 180) + "…"
            : evt.description,
        };
      } catch {
        return evt;  // API down or slow → use hardcoded description
      }
    })
  );

  _cache = enriched;
  return enriched;
}

/** Convert ISO date string to unix timestamp (ms) for D3 scales */
export function eventToMs(event: WikiEvent): number {
  return new Date(event.date).getTime();
}