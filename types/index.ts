export type WorkMode = 'remote' | 'onsite' | 'hybrid';

export type Eligibility = 'open_to_nigeria' | 'region_locked' | 'unclear';

export type ListingStatus = 'open' | 'upcoming' | 'closed';

export interface Listing {
  id: string;
  source: string;
  external_id: string;
  content_hash: string;
  company: string;
  title: string;
  location: string;
  work_mode: WorkMode;
  eligibility: Eligibility;
  duration: string | null;
  intern_type: string | null;
  skills: string[];
  requirements: string | null;
  deadline: string | null;
  start_window: string | null;
  apply_url: string;
  source_url: string;
  first_seen: string;
  last_seen: string;
  status: ListingStatus;
  match_score: number; // 0-100
  match_reason: string;
  flags: string[]; // e.g. ["region_locked", "pay_to_apply", "vague_company", "telegram_contact"]
  description_snippet?: string;
}

export interface Contact {
  name: string;
  role: string;
  email: string | null;
  source_url: string;
}

export interface Company {
  id: string;
  name: string;
  careers_url: string;
  city: string;
  region: string;
  takes_interns: boolean | 'unknown';
  evidence_url?: string;
  contacts: Contact[];
  notes?: string;
  pitch_draft?: string;
}

export type ApplicationStatus = 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected' | 'dismissed';

export interface Application {
  listing_or_company_id: string;
  type: 'listing' | 'company';
  status: ApplicationStatus;
  dates: {
    saved_at?: string;
    applied_at?: string;
    interviewing_at?: string;
    offer_at?: string;
    rejected_at?: string;
    dismissed_at?: string;
  };
  notes: string;
  custom_deadline?: string;
  updated_at: string;
}

export interface UserProfile {
  name: string;
  title: string;
  stage: string;
  location: string;
  availability: string;
  hours_per_week: string;
  internship_summary: string;
  freelance_summary: string;
  level: string;
  core_skills: string[];
  backend_and_tools: string[];
  projects: Array<{
    name: string;
    description: string;
    tech: string[];
    live_url: string;
    repo_url: string;
  }>;
  target: {
    role_types: string[];
    season: string;
    regions: string[];
  };
}

export interface PipelineMeta {
  last_run: string;
  total_listings: number;
  total_companies: number;
  sources: Record<string, {
    count: number;
    error: string | null;
    status: 'success' | 'failed' | 'skipped';
  }>;
}

