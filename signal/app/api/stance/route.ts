// FILE: app/api/stance/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import path from "path";
import fs from "fs";
import { allowSyntheticData, missingDataResponse } from "@/lib/dataMode";
export const dynamic = "force-dynamic";

function synth() {
  const topics = [0, 1, 2, 3, 4, 5, 6, 7];
  const base = new Date("2024-07-23");
  const result = [];

  const profiles: Record<number, [number, number, number]> = {
    0: [0.45, 0.35, 0.20],
    1: [0.70, 0.20, 0.10],
    2: [0.50, 0.30, 0.20],
    3: [0.25, 0.35, 0.40],
    4: [0.40, 0.40, 0.20],
    5: [0.35, 0.30, 0.35],
    6: [0.30, 0.35, 0.35],
    7: [0.55, 0.30, 0.15],
  };

  for (const tid of topics) {
    const [basePro, baseNeutral, baseCon] = profiles[tid] ?? [0.4, 0.4, 0.2];
    for (let w = 0; w < 32; w++) {
      const d = new Date(base);
      d.setDate(d.getDate() + w * 7);
      const isoWeek = `${d.getFullYear()}-W${String(Math.ceil(w % 52) + 1).padStart(2, "0")}`;
      const noise = () => (Math.random() - 0.5) * 0.08;
      const pro = Math.max(0.05, Math.min(0.95, basePro + noise()));
      const con = Math.max(0.05, Math.min(0.95, baseCon + noise()));
      const neutral = Math.max(0.01, Math.min(0.9, baseNeutral + noise()));
      const total = pro + neutral + con;

      result.push({
        week: isoWeek,
        topic_id: tid,
        pro: parseFloat((pro / total).toFixed(3)),
        neutral: parseFloat((neutral / total).toFixed(3)),
        con: parseFloat((con / total).toFixed(3)),
        n: Math.round(50 + Math.random() * 300),
      });
    }
  }

  return result;
}

export async function GET(req: NextRequest) {
  const{searchParams}=new URL(req.url);
  const topicId=searchParams.get("topic_id");
  const fp=path.join(process.cwd(),"public","data","stance_series.json");
  if (!fs.existsSync(fp) && !allowSyntheticData()) {
    return missingDataResponse("/api/stance", ["public/data/stance_series.json"]);
  }

  let data=fs.existsSync(fp)?JSON.parse(fs.readFileSync(fp,"utf-8")):synth();
  if(topicId!==null){const id=parseInt(topicId,10);data=data.filter((d:{topic_id:number})=>d.topic_id===id);}
  return NextResponse.json(data);
}