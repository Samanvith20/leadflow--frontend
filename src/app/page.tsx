"use client";

import Link from "next/link";
import { Activity, ArrowRight, ClipboardCheck, Inbox, type LucideIcon, UserRoundCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { api, ApiError } from "@/lib/api";
import { DashboardData, leadName, relativeTime } from "@/lib/leads";

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "We could not load the overview. Check that the API is running and try again.";
}

function activityText(action: string, metadata: Record<string, unknown>) {
  const person = typeof metadata.contact_name === "string" ? metadata.contact_name : "A lead";
  if (action === "lead.received") return { title: "New lead received", detail: person + " from " + (metadata.source_name || "a source") };
  if (action === "lead.assigned") return { title: "Lead assignment changed", detail: "A teammate was assigned to a lead" };
  if (action === "lead.status_changed") return { title: "Lead status updated", detail: "Moved to " + String(metadata.lead_status || "a new status").replaceAll("_", " ") };
  return { title: action.replaceAll(".", " "), detail: "Workspace activity" };
}

export default function OverviewPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      setData(await api<DashboardData>("/api/v1/dashboard", undefined, "GET"));
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const metrics: Array<[string, number, string, LucideIcon]> = data ? [
    ["New leads", data.metrics.new_leads, "Ready for a first response", Inbox],
    ["Unassigned", data.metrics.unassigned_leads, "Need an owner", UserRoundCheck],
    ["Awaiting qualification", data.metrics.awaiting_qualification, "Needs review", ClipboardCheck],
    ["Reply drafts", data.metrics.reply_drafts_waiting_approval, "Awaiting approval", Activity],
  ] : [];

  return <DashboardShell title="Lead operations" subtitle="See what needs attention and keep enquiries moving.">
    {error && <div className="profile-notice error">{error}<button className="text-link" onClick={() => void load()}>Try again</button></div>}
    {!data && !error && <p className="profile-loading">Loading your overview…</p>}
    {data && <>
      <section className="metrics">
        {metrics.map(([title, count, note, Icon]) => <article className="metric-card dynamic-metric" key={String(title)}><span className="metric-icon"><Icon size={17}/></span><span className="metric-label">{title}</span><strong>{count}</strong><span className="metric-note">{note}</span></article>)}
      </section>
      <div className="content-grid">
        <section className="panel">
          <div className="panel-heading"><div><h2>Needs attention</h2><p>New, unassigned, or review-required enquiries.</p></div><Link className="text-link" href="/leads">View all <ArrowRight size={14}/></Link></div>
          {data.needs_attention.length > 0 ? <div className="priority-list">{data.needs_attention.map((lead) => <Link className="priority-row" href={"/leads?lead=" + lead.id} key={lead.id}><span className="lead-avatar">{leadName(lead).split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div className="lead-summary"><strong>{leadName(lead)}</strong><span>{lead.source.name} · {lead.assignee ? "Assigned to " + lead.assignee.name : "Unassigned"}</span></div><span className={"status-pill qualification-" + lead.qualification_status}>{lead.qualification_status.replaceAll("_", " ")}</span><time>{relativeTime(lead.updated_at)}</time></Link>)}</div> : <EmptyOverview />}
        </section>
        <section className="panel">
          <div className="panel-heading"><div><h2>Recent activity</h2><p>Important changes in this workspace.</p></div></div>
          {data.recent_activity.length > 0 ? <ol className="activity-list">{data.recent_activity.map((event) => { const copy = activityText(event.action, event.metadata); return <li key={event.id}><span className="activity-dot blue"/><div><strong>{copy.title}</strong><p>{copy.detail} · {relativeTime(event.occurred_at)}</p></div></li>; })}</ol> : <div className="empty-activity"><Activity size={19}/><p>Activity will appear when leads arrive, are assigned, or change status.</p></div>}
        </section>
      </div>
    </>}
  </DashboardShell>;
}

function EmptyOverview() {
  return <div className="dashboard-empty"><Inbox size={21}/><div><strong>Your lead inbox is clear</strong><p>New enquiries will appear here after an active source sends them to Leadflow.</p><Link href="/sources">View sources <ArrowRight size={14}/></Link></div></div>;
}
