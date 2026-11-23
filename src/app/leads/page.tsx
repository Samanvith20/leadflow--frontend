"use client";

import Link from "next/link";
import { ArrowRight, Search, UserRoundPlus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { api, ApiError, type AuthenticatedUserResponse } from "@/lib/api";
import { LeadDetail, LeadListResponse, LeadStatus, LeadSummary, leadName, leadStatusOptions, label, relativeTime } from "@/lib/leads";

type TeamMember = { id: string; name: string; email: string; role: "manager" | "user"; status: "active" | "invited" | "deactivated"; is_available: boolean; max_open_leads: number };
type Toast = { message: string; kind: "success" | "error" } | null;

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "We could not load leads. Check that the API is running and try again.";
}

export default function LeadsPage() {
  const query = useSearchParams();
  const [role, setRole] = useState<"manager" | "user" | null>(null);
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ownership, setOwnership] = useState("all");
  const [selected, setSelected] = useState<LeadDetail | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [busy, setBusy] = useState(false);

  const notify = useCallback((message: string, kind: "success" | "error") => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const openLead = useCallback(async (leadId: string) => {
    try {
      setSelected(await api<LeadDetail>("/api/v1/leads/" + leadId, undefined, "GET"));
    } catch (requestError) {
      notify(errorMessage(requestError), "error");
    }
  }, [notify]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const auth = await api<AuthenticatedUserResponse>("/api/v1/auth/me", undefined, "GET");
      setRole(auth.user.role);
      const list = await api<LeadListResponse>("/api/v1/leads?limit=100", undefined, "GET");
      setLeads(list.items);
      if (auth.user.role === "manager") {
        const team = await api<TeamMember[]>("/api/v1/team/members", undefined, "GET");
        setMembers(team.filter((member) => member.status === "active"));
      }
      const focusedId = query.get("lead");
      if (focusedId) await openLead(focusedId);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [openLead, query]);

  useEffect(() => { void load(); }, [load]);

  const filteredLeads = useMemo(() => leads.filter((lead) => {
    const searchValue = [leadName(lead), lead.contact?.email, lead.contact?.company_name, lead.enquiry_message].filter(Boolean).join(" ").toLowerCase();
    if (search && !searchValue.includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && lead.lead_status !== statusFilter) return false;
    if (role === "manager" && ownership === "unassigned" && lead.assignee) return false;
    if (role === "manager" && ownership === "mine" && lead.assignee?.role !== "manager") return false;
    return true;
  }), [leads, ownership, role, search, statusFilter]);

  async function saveLead(status: LeadStatus, assigneeId: string) {
    if (!selected) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = { lead_status: status };
      if (role === "manager") body.assignee_user_id = assigneeId || null;
      const updated = await api<LeadDetail>("/api/v1/leads/" + selected.id, body, "PATCH");
      setSelected(updated);
      setLeads((current) => current.map((lead) => lead.id === updated.id ? updated : lead));
      notify("Lead updated.", "success");
    } catch (requestError) {
      notify(errorMessage(requestError), "error");
    } finally {
      setBusy(false);
    }
  }

  const isManager = role === "manager";
  const title = isManager ? "Leads" : "My leads";
  const subtitle = isManager ? "Review, assign, and move every enquiry through your team." : "Work through the leads assigned to you.";

  return <DashboardShell title={title} subtitle={subtitle}>
    {toast && <div className={"app-toast " + toast.kind} role="status">{toast.message}</div>}
    {error && <div className="profile-notice error">{error}<button className="text-link" onClick={() => void load()}>Try again</button></div>}
    {loading && <p className="profile-loading">Loading leads…</p>}
    {!loading && !error && <>
      <section className="leads-toolbar">
        <label className="lead-search"><Search size={17}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, company, or enquiry" /></label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{leadStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        {isManager && <select value={ownership} onChange={(event) => setOwnership(event.target.value)}><option value="all">All owners</option><option value="unassigned">Unassigned</option><option value="mine">Assigned to me</option></select>}
      </section>
      {filteredLeads.length === 0 ? <EmptyLeads manager={isManager} hasLeads={leads.length > 0} /> : <section className="lead-list">
        <header className="lead-list-heading"><span>{filteredLeads.length} lead{filteredLeads.length === 1 ? "" : "s"}</span><span>{isManager ? "Workspace lead queue" : "Your assigned queue"}</span></header>
        {filteredLeads.map((lead) => <article className="lead-row" key={lead.id}>
          <span className="lead-avatar">{leadName(lead).split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
          <div className="lead-primary"><strong>{leadName(lead)}</strong><span>{lead.contact?.company_name || lead.contact?.email || lead.contact?.phone_e164 || "Contact details unavailable"}</span><p>{lead.enquiry_message || "No enquiry message was supplied."}</p></div>
          <div className="lead-source"><span>{lead.source.name}</span><small>{relativeTime(lead.updated_at)}</small></div>
          <div className="lead-tags"><span className={"status-pill qualification-" + lead.qualification_status}>{label(lead.qualification_status)}</span><span className={"status-pill lead-" + lead.lead_status}>{label(lead.lead_status)}</span></div>
          <div className="lead-owner">{lead.assignee ? <><span>{lead.assignee.name}</span><small>{lead.assignee.role === "manager" ? "Manager" : "Owner"}</small></> : <span className="unassigned">Unassigned</span>}</div>
          <button className="secondary-button" onClick={() => void openLead(lead.id)}>Open</button>
        </article>)}
      </section>}
    </>}
    {selected && <LeadDrawer lead={selected} manager={isManager} members={members} busy={busy} onClose={() => setSelected(null)} onSave={saveLead} />}
  </DashboardShell>;
}

function EmptyLeads({ manager, hasLeads }: { manager: boolean; hasLeads: boolean }) {
  if (hasLeads) return <div className="leads-empty"><Search size={22}/><strong>No matching leads</strong><p>Try clearing search or changing a filter.</p></div>;
  return <div className="leads-empty"><UserRoundPlus size={23}/><strong>{manager ? "No leads yet" : "No leads assigned to you yet"}</strong><p>{manager ? "Leads will appear here as soon as an active source sends a valid enquiry." : "When a Manager assigns you a lead, it will appear here with its enquiry details."}</p>{manager && <Link href="/sources">Set up a source <ArrowRight size={14}/></Link>}</div>;
}

function LeadDrawer({ lead, manager, members, busy, onClose, onSave }: { lead: LeadDetail; manager: boolean; members: TeamMember[]; busy: boolean; onClose: () => void; onSave: (status: LeadStatus, assigneeId: string) => void }) {
  const [status, setStatus] = useState<LeadStatus>(lead.lead_status);
  const [assigneeId, setAssigneeId] = useState(lead.assignee?.id || "");
  return <div className="lead-drawer-backdrop" role="presentation">
    <aside className="lead-drawer" role="dialog" aria-modal="true" aria-labelledby="lead-detail-title">
      <header><div><p className="eyebrow">LEAD DETAILS</p><h2 id="lead-detail-title">{leadName(lead)}</h2><p>{lead.source.name} · Received {relativeTime(lead.created_at)}</p></div><button className="modal-close" onClick={onClose} aria-label="Close"><X size={19}/></button></header>
      <div className="lead-drawer-content">
        <section><h3>Contact</h3><dl className="lead-info"><div><dt>Email</dt><dd>{lead.contact?.email || "Not provided"}</dd></div><div><dt>Phone</dt><dd>{lead.contact?.phone_e164 || "Not provided"}</dd></div><div><dt>Company</dt><dd>{lead.contact?.company_name || "Not provided"}</dd></div></dl></section>
        <section><h3>Enquiry</h3><p className="enquiry-message">{lead.enquiry_message || "No enquiry message was supplied."}</p></section>
        <section className="lead-actions-form"><h3>Next step</h3><label>Lead status<select value={status} onChange={(event) => setStatus(event.target.value as LeadStatus)}>{leadStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>{manager && <label>Assign to<select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}><option value="">Unassigned</option>{members.map((member) => <option value={member.id} key={member.id}>{member.name}{member.is_available ? "" : " — unavailable"}</option>)}</select></label>}</section>
        {lead.qualification_reason && <section><h3>Qualification note</h3><p className="enquiry-message">{lead.qualification_reason}</p></section>}
        {Object.keys(lead.custom_fields).length > 0 && <section><h3>Additional information</h3><dl className="lead-info">{Object.entries(lead.custom_fields).map(([key, value]) => <div key={key}><dt>{label(key)}</dt><dd>{String(value)}</dd></div>)}</dl></section>}
      </div>
      <footer><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy} onClick={() => onSave(status, assigneeId)}>{busy ? "Saving…" : "Save changes"}</button></footer>
    </aside>
  </div>;
}
