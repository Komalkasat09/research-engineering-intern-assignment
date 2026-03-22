import { NextResponse } from "next/server";

// Publication mode is the default: synthetic/demo data is blocked unless
// explicitly enabled for local demos via SIGNAL_ALLOW_SYNTHETIC_DATA=true.
export function allowSyntheticData(): boolean {
  return process.env.SIGNAL_ALLOW_SYNTHETIC_DATA === "true";
}

export function missingDataResponse(route: string, requiredFiles: string[]) {
  return NextResponse.json(
    {
      error: "Required precomputed data is missing",
      route,
      required_files: requiredFiles,
      hint:
        "Run the Python pipeline to generate artifacts, or set SIGNAL_ALLOW_SYNTHETIC_DATA=true for demo-only fallback mode.",
    },
    { status: 503 },
  );
}
