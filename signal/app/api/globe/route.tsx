// FILE: app/api/globe/route.ts
/**
 * GET /api/globe
 * Returns geospatial event data for the 3D globe visualization.
 * Each point is a real-world political or civic event
 * with lat/lon, date, intensity, and topic affiliation.
 *
 * In production this would pull from GDELT or ACLED APIs.
 * For the demo, returns a curated political event set.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-static";

interface GlobeEvent {
  id:        string;
  lat:       number;
  lon:       number;
  date:      string;
  title:     string;
  type:      "cop" | "protest" | "disaster" | "report" | "policy";
  intensity: number;   // 1-10, drives sphere size
  topic_id:  number;
  color:     string;
}

const EVENTS: GlobeEvent[] = [
  // Elections and institutional milestones
  { id:"us_2020_election", lat:38.9072, lon:-77.0369, date:"2020-11-03", title:"US Presidential Election", type:"cop", intensity:10, topic_id:0, color:"#1D9E75" },
  { id:"capitol_attack", lat:38.8899, lon:-77.0091, date:"2021-01-06", title:"Capitol attack", type:"cop", intensity:10, topic_id:8, color:"#E24B4A" },
  { id:"georgia_runoff", lat:33.7490, lon:-84.3880, date:"2021-01-05", title:"Georgia Senate runoffs", type:"cop", intensity:8, topic_id:0, color:"#1D9E75" },
  { id:"midterms_2022", lat:38.9072, lon:-77.0369, date:"2022-11-08", title:"US Midterm Elections", type:"cop", intensity:9, topic_id:0, color:"#1D9E75" },
  { id:"speaker_removal", lat:38.8951, lon:-77.0364, date:"2023-10-03", title:"US House Speaker removed", type:"cop", intensity:8, topic_id:7, color:"#639922" },

  // Protests and civil action
  { id:"george_floyd_protests", lat:44.9778, lon:-93.2650, date:"2020-05-26", title:"George Floyd protests begin", type:"protest", intensity:10, topic_id:5, color:"#D4537E" },
  { id:"dc_womens_march_2022", lat:38.9072, lon:-77.0369, date:"2022-10-08", title:"Women's March demonstrations", type:"protest", intensity:7, topic_id:5, color:"#D4537E" },
  { id:"la_labor_action", lat:34.0522, lon:-118.2437, date:"2023-03-15", title:"Large labor rally in Los Angeles", type:"protest", intensity:6, topic_id:9, color:"#5DCAA5" },
  { id:"newyork_protests_2023", lat:40.7128, lon:-74.0060, date:"2023-04-04", title:"Manhattan courthouse protests", type:"protest", intensity:7, topic_id:8, color:"#E24B4A" },

  // Policy and court decisions
  { id:"rescue_plan", lat:38.9072, lon:-77.0369, date:"2021-03-11", title:"American Rescue Plan signed", type:"policy", intensity:8, topic_id:1, color:"#7F77DD" },
  { id:"infrastructure_law", lat:38.9072, lon:-77.0369, date:"2021-11-15", title:"Infrastructure Investment and Jobs Act", type:"policy", intensity:7, topic_id:1, color:"#7F77DD" },
  { id:"dobbs_decision", lat:38.8897, lon:-77.0044, date:"2022-06-24", title:"Dobbs decision", type:"policy", intensity:10, topic_id:2, color:"#BA7517" },
  { id:"ira_signed", lat:38.9072, lon:-77.0369, date:"2022-08-16", title:"Inflation Reduction Act signed", type:"policy", intensity:8, topic_id:1, color:"#7F77DD" },

  // Media and narrative-shaping moments
  { id:"fox_dominion_settlement", lat:40.7128, lon:-74.0060, date:"2023-04-18", title:"Dominion v. Fox settlement", type:"report", intensity:7, topic_id:3, color:"#D85A30" },
  { id:"twitter_files_wave", lat:37.7749, lon:-122.4194, date:"2022-12-03", title:"Twitter Files reporting wave", type:"report", intensity:7, topic_id:3, color:"#D85A30" },
  { id:"special_counsel_appointment", lat:38.9072, lon:-77.0369, date:"2022-11-18", title:"Special counsel appointed", type:"report", intensity:6, topic_id:6, color:"#378ADD" },

  // International politics
  { id:"uk_snap_election_discourse", lat:51.5074, lon:-0.1278, date:"2019-12-12", title:"UK general election", type:"cop", intensity:7, topic_id:4, color:"#888780" },
  { id:"berlin_energy_protests", lat:52.5200, lon:13.4050, date:"2022-10-08", title:"Berlin cost-of-living protests", type:"protest", intensity:6, topic_id:4, color:"#888780" },
  { id:"paris_pension_protests", lat:48.8566, lon:2.3522, date:"2023-03-23", title:"Paris pension reform protests", type:"protest", intensity:8, topic_id:4, color:"#888780" },
];

export async function GET() {
  return NextResponse.json(EVENTS);
}