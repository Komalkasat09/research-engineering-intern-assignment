// ── Core data types ───────────────────────────────────────────────────────────

export interface TopicCluster {
  id:         number;
  name:       string;
  top_words:  string[];
  count:      number;
  color:      string;
  centroid_x: number;
  centroid_y: number;
}

export interface DatasetMeta {
  total_posts:    number;
  date_start:     string;
  date_end:       string;
  subreddits:     number;
  unique_authors: number;
  topic_count:    number;
}

export interface VelocityPoint {
  week:       string;   // "2022-W03"
  topic_id:   number;
  velocity:   number;
  post_count: number;
}

export interface StancePoint {
  week:     string;
  topic_id: number;
  pro:      number;
  neutral:  number;
  con:      number;
  n:        number;
}

export interface GraphNode {
  id:         string;
  label:      string;
  type:       "account" | "subreddit";
  weight:     number;   // PageRank
  topic_id:   number;
  post_count: number;
  community:  number;
}

export interface GraphLink {
  source: string;
  target: string;
  weight: number;
  type:   string;
}

export interface GlobeEvent {
  id:        string;
  lat:       number;
  lon:       number;
  date:      string;
  title:     string;
  type:      "cop" | "protest" | "disaster" | "report" | "policy";
  intensity: number;
  topic_id:  number;
  color:     string;
}

export interface CoordCell {
  account: string;
  month:   string;
  count:   number;
}

export interface CoordPair {
  account_a:   string;
  account_b:   string;
  sync_count:  number;
  avg_gap_min: number;
  shared_urls: string[];
}

// ── Live Injection API Types ───────────────────────────────────────────────

export interface RedditPost {
  title:       string;
  selftext:    string;
  subreddit:   string;
  author:      string;
  score:       number;
  created_utc: number;
  url:         string;
}

export interface ClusterAssignment {
  cluster:         string;
  cluster_id:      number;
  confidence:      number;
  is_new_narrative: boolean;
  reasoning:       string;
}

export interface InjectedPost extends RedditPost {
  assignment: ClusterAssignment;
}

export interface LiveInjectResponse {
  posts:      InjectedPost[];
  query:      string;
  total:      number;
  timestamp:  string;
}
