// FILE: lib/cleanTopicName.ts

/**
 * Converts raw BERTopic labels to human-readable names.
 * BERTopic labels look like: "0_fucks_painting_digital_cat"
 * We strip the ID prefix and clean up the words.
 */

const OVERRIDES: Record<string, string> = {
  "fucks_painting_digital_cat": "general chatter",
  "anarchist_anarchism_ive_socialist": "anarchist / socialist",
  "democrats_election_vote_republicans": "electoral politics",
  "musk_elon_doge_musks": "Musk / DOGE",
  "ukraine_russia_europe_european": "Ukraine / Russia",
  "ice_immigration_migrants_immigrants": "immigration / ICE",
  "tariffs_canada_trade_tariff": "tariffs / trade policy",
  "federal_employees_court_workers": "federal workers / courts",
};

export function cleanTopicName(rawName: string): string {
  const withoutId = rawName.replace(/^\d+_/, "").trim();

  if (!withoutId) return "unnamed topic";

  if (OVERRIDES[withoutId]) return OVERRIDES[withoutId];

  return withoutId
    .split("_")
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
}
