export type WorkMode = 'remote' | 'onsite' | 'hybrid' | 'unknown';

export type Eligibility = 'open' | 'locked' | 'unclear';

export type ListingStatus = 'open' | 'upcoming' | 'closed';

export interface ScoreBreakdown {
  experience_value: number; // 35% weight
  attainability: number;    // 35% weight
  paid_score: number;       // 20% weight
  timing_fit: number;       // 10% weight
}

export interface EvidencePhrases {
  work_mode_quote: string;
  nigeria_eligibility_quote: string;
}

export interface Listing {
  id: string;
  source: string;
  external_id: string;
  content_hash: string;
  company: string;
  title: string;
  location: string;
  city_country?: string;
  work_mode: WorkMode;
  nigeria_eligibility: Eligibility;
  eligibility: 'open_to_nigeria' | 'region_locked' | 'unclear'; // backward compatible alias
  lagos_onsite: boolean;
  is_internship: boolean;
  is_software_engineering: boolean;
  duration: string | null;
  duration_weeks: number | null;
  intern_type: string | null;
  skills: string[];
  required_skills: string[];
  requirements: string | null;
  deadline: string | null;
  start_window: string | null;
  apply_url: string;
  source_url: string;
  first_seen: string;
  last_seen: string;
  status: ListingStatus;
  paid: boolean | 'unknown';
  stipend_text: string | null;
  seniority_required: string;
  experience_value: number;
  attainability: number;
  confidence: number;
  evidence: EvidencePhrases;
  final_score: number; // 0-100
  match_score: number; // alias to final_score
  match_reason: string;
  score_breakdown: ScoreBreakdown;
  flags: string[];
  description_snippet?: string;
  is_unverified?: boolean;
}

export interface RejectedListing {
  title: string;
  company: string;
  url: string;
  source: string;
  location: string;
  reason: string;
  reason_code: string;
  snippet?: string;
  rejected_at: string;
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
  status?: 'verified' | 'possible';
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

export interface Program {
  id: string;
  name: string;
  official_url: string;
  type: string;
  stipend: string;
  application_window: string;
  eligibility_note: string;
  dates_status: string;
  recommended_prep: string;
  tags: string[];
}

export interface OpeningSoonItem {
  id: string;
  company_or_program: string;
  title: string;
  category: 'program' | 'company' | 'fellowship';
  typical_open_month: string;
  reminder_date: string;
  claim_source: string;
  claim_source_title: string;
  careers_url: string;
  recheck_frequency: 'weekly';
  last_rechecked: string;
  status: 'upcoming' | 'verify' | 'open';
  notes: string;
  eligibility_summary: string;
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
  skills: string[];
  core_skills: string[];
  backend_and_tools: string[];
  links: {
    portfolio: string;
    github: string;
    linkedin: string;
  };
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
  gemini_status: string;
  total_listings_fetched: number;
  stage_a_passed: number;
  stage_c_passed: number;
  check_eligibility_count?: number;
  total_rejected: number;
  rejected_counts: Record<string, number>;
  sources: Record<string, {
    count: number;
    error: string | null;
    status: 'success' | 'failed' | 'skipped';
  }>;
}
