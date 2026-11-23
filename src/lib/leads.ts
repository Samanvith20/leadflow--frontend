export type LeadStatus = "new" | "in_progress" | "contacted" | "closed_won" | "closed_lost";
export type QualificationStatus = "pending" | "hot" | "warm" | "needs_review" | "not_a_fit";

export type LeadSummary = {
  id: string;
  contact: {
    id: string; full_name: string | null; email: string | null; phone_e164: string | null; company_name: string | null;
  } | null;
  source: { id: string; name: string; source_type: string };
  assignee: { id: string; name: string; email: string; role: "manager" | "user" } | null;
  enquiry_message: string | null;
  lead_status: LeadStatus;
  qualification_status: QualificationStatus;
  created_at: string;
  updated_at: string;
};

export type LeadDetail = LeadSummary & {
  custom_fields: Record<string, unknown>;
  qualification_reason: string | null;
  crm_sync_status: string;
};

export type LeadListResponse = { items: LeadSummary[]; total: number; limit: number; offset: number };
export type DashboardData = {
  metrics: { new_leads: number; unassigned_leads: number; awaiting_qualification: number; reply_drafts_waiting_approval: number };
  needs_attention: LeadSummary[];
  recent_activity: Array<{ id: string; action: string; entity_type: string; entity_id: string; metadata: Record<string, unknown>; occurred_at: string }>;
};

export const leadStatusOptions: Array<{ value: LeadStatus; label: string }> = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "contacted", label: "Contacted" },
  { value: "closed_won", label: "Closed won" },
  { value: "closed_lost", label: "Closed lost" },
];

export function label(value: string) {
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export function leadName(lead: LeadSummary) {
  return lead.contact?.full_name || lead.contact?.company_name || lead.contact?.email || "Unnamed enquiry";
}

export function relativeTime(value: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [["day", 86400], ["hour", 3600], ["minute", 60]];
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of units) {
    if (seconds >= size) return formatter.format(-Math.round(seconds / size), unit);
  }
  return "just now";
}
