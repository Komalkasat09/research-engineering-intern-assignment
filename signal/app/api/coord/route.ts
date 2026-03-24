// FILE: app/api/coord/route.ts
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { allowSyntheticData, missingDataResponse } from "@/lib/dataMode";
export const dynamic = "force-static";

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function confidenceLabel(score: number): "high" | "medium" | "low" {
  if (score >= 0.72) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

function enrichCoord<T extends { top_pairs?: Array<{ sync_count?: number; avg_gap_min?: number; shared_urls?: string[] }> }>(data: T): T {
  const pairs = (data.top_pairs ?? []).map((p) => {
    const syncSignal = clamp01((Number(p.sync_count ?? 0) - 3) / 12);
    const timingSignal = clamp01(1 - (Number(p.avg_gap_min ?? 30) / 30));
    const urlSignal = clamp01((p.shared_urls?.length ?? 0) / 6);
    const score = clamp01((syncSignal * 0.5) + (timingSignal * 0.3) + (urlSignal * 0.2));
    return {
      ...p,
      confidence_score: Number(score.toFixed(3)),
      confidence_label: confidenceLabel(score),
    };
  });

  return { ...data, top_pairs: pairs };
}

function synth() {
  const accounts=["u/xr_organiser","u/collapsemod","u/greenpost_bot","u/eco_amplify","u/climate_bridge","u/coordpost1","u/coordpost2","u/newsbot_climate","u/xr_media","u/activist_net","u/collapse_daily","u/green_signal","u/cop_tracker","u/ipcc_news","u/climate_alert","u/earth_watch","u/future_earth","u/signal_boost","u/narrative_hub","u/action_net"];
  const months:string[]=[];
  for (let y = 2024; y <= 2025; y++) {
    const maxM = y === 2024 ? 12 : 2;  // up to Feb 2025
    for (let m = (y === 2024 ? 7 : 1); m <= maxM; m++) {
      months.push(`${y}-${String(m).padStart(2, "0")}`);
    }
  }
  const cells=[];
  for(const acc of accounts){
    for(const mo of months){
      const hasActivity=Math.random()<0.35;
      if(hasActivity){cells.push({account:acc,month:mo,count:Math.floor(1+Math.random()*8)});}
    }
  }
  const pairs=accounts.slice(0,10).flatMap((a,i)=>
    accounts.slice(i+1,i+3).map(b=>({
      account_a:a,account_b:b,
      sync_count:Math.floor(3+Math.random()*15),
      avg_gap_min:parseFloat((5+Math.random()*20).toFixed(1)),
      shared_urls:[`https://reddit.com/r/environment/comments/abc${i}`,`https://bbc.com/climate/${i}`],
    }))
  ).sort((a,b)=>b.sync_count-a.sync_count);
  return{accounts,months,cells,top_pairs:pairs};
}

export async function GET() {
  const fp=path.join(process.cwd(),"public","data","coord.json");
  if(fs.existsSync(fp))return NextResponse.json(enrichCoord(JSON.parse(fs.readFileSync(fp,"utf-8"))));
  if (!allowSyntheticData()) {
    return missingDataResponse("/api/coord", ["public/data/coord.json"]);
  }
  return NextResponse.json(enrichCoord(synth()));
}