// FILE: app/api/coord/route.ts
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { allowSyntheticData, missingDataResponse } from "@/lib/dataMode";
export const dynamic = "force-static";

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
  if(fs.existsSync(fp))return NextResponse.json(JSON.parse(fs.readFileSync(fp,"utf-8")));
  if (!allowSyntheticData()) {
    return missingDataResponse("/api/coord", ["public/data/coord.json"]);
  }
  return NextResponse.json(synth());
}