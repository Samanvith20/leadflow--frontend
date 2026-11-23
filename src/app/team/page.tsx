"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Mail, UserPlus, Users } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { api, ApiError } from "@/lib/api";

type MemberStatus = "invited" | "active" | "deactivated";
type TeamMember = {
  id: string; name: string; email: string; role: "manager" | "user"; status: MemberStatus;
  is_available: boolean; max_open_leads: number; invited_at: string | null;
};
type Toast = { kind: "success" | "error"; message: string } | null;

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "We could not reach Leadflow. Check that the API is running and try again.";
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [busy, setBusy] = useState("");
  const [showDeactivated, setShowDeactivated] = useState(false);
  const activeUsers = useMemo(() => members.filter((member) => member.status === "active" && member.role === "user"), [members]);
  const invitedMembers = useMemo(() => members.filter((member) => member.status === "invited"), [members]);
  const deactivatedMembers = useMemo(() => members.filter((member) => member.status === "deactivated"), [members]);
  const managers = useMemo(() => members.filter((member) => member.role === "manager"), [members]);

  const notify = useCallback((message: string, kind: "success" | "error") => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      setMembers(await api<TeamMember[]>("/api/v1/team/members", undefined, "GET"));
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { void loadMembers(); }, [loadMembers]);

  async function updateMember(member: TeamMember, body: Record<string, unknown>, success: string) {
    setBusy(member.id);
    try {
      const updated = await api<TeamMember>("/api/v1/team/members/" + member.id, body, "PATCH");
      setMembers((current) => current.map((item) => item.id === updated.id ? updated : item));
      setEditing(null);
      notify(success, "success");
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setBusy("");
    }
  }

  async function memberAction(member: TeamMember, action: "deactivate" | "reactivate" | "resend-invitation", success: string) {
    setBusy(member.id);
    try {
      const updated = await api<TeamMember>("/api/v1/team/members/" + member.id + "/" + action, {});
      setMembers((current) => current.map((item) => item.id === updated.id ? updated : item));
      notify(success, "success");
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setBusy("");
    }
  }

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy("invite");
    try {
      const member = await api<TeamMember>("/api/v1/team/invitations", {
        name: form.get("name"), email: form.get("email"),
        max_open_leads: Number(form.get("maxOpenLeads")),
        is_available: form.get("isAvailable") === "on",
      });
      setMembers((current) => [...current, member]);
      setInviteOpen(false);
      notify("Invitation sent to " + member.email + ".", "success");
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setBusy("");
    }
  }

  return <DashboardShell title="Team" subtitle="Invite your people, manage access, and set lead capacity.">
    {toast && <div className={"app-toast " + toast.kind} role="status">{toast.message}</div>}
    <section className="team-summary">
      <div><Users size={20}/><span><strong>{activeUsers.length}</strong> active teammate{activeUsers.length === 1 ? "" : "s"}</span></div>
      <div><Mail size={20}/><span><strong>{invitedMembers.length}</strong> invitation{invitedMembers.length === 1 ? "" : "s"} pending</span></div>
      <button className="primary-button" onClick={() => setInviteOpen(true)}><UserPlus size={16}/>Invite teammate</button>
    </section>

    {loading ? <p className="profile-loading">Loading your team…</p> : <>
      <section className="team-panel">
        <header className="team-panel-heading"><div><h2>Workspace members</h2><p>Active people can sign in and work on assigned leads.</p></div></header>
        <div className="member-list">
          {managers.map((member) => <MemberRow key={member.id} member={member} busy={busy} />)}
          {activeUsers.map((member) => <MemberRow key={member.id} member={member} busy={busy} onManage={() => setEditing(member)} onDeactivate={() => void memberAction(member, "deactivate", "Member access deactivated.")} />)}
          {members.length === 0 && <p className="team-empty">There are no workspace members yet.</p>}
        </div>
      </section>

      {invitedMembers.length > 0 && <section className="team-panel pending-panel">
        <header className="team-panel-heading"><div><h2>Pending invitations</h2><p>Invited people cannot access Leadflow until they set their password.</p></div></header>
        <div className="member-list">{invitedMembers.map((member) => <MemberRow key={member.id} member={member} busy={busy} onResend={() => void memberAction(member, "resend-invitation", "A new invitation email was sent.")} onDeactivate={() => void memberAction(member, "deactivate", "Invitation cancelled.")} />)}</div>
      </section>}

      {deactivatedMembers.length > 0 && <section className="deactivated-section">
        <button className="deactivated-toggle" onClick={() => setShowDeactivated((current) => !current)}><span>Deactivated members ({deactivatedMembers.length})</span><ChevronDown size={17} className={showDeactivated ? "is-open" : ""} /></button>
        {showDeactivated && <div className="member-list">{deactivatedMembers.map((member) => <MemberRow key={member.id} member={member} busy={busy} onReactivate={() => void memberAction(member, "reactivate", "Member access restored.")} />)}</div>}
      </section>}
    </>}

    {inviteOpen && <div className="wizard-backdrop" role="presentation">
      <section className="team-modal" role="dialog" aria-modal="true" aria-labelledby="invite-title">
        <header><div><p className="eyebrow">TEAM ACCESS</p><h2 id="invite-title">Invite a teammate</h2><p>They will receive a secure link to choose their password.</p></div><button type="button" className="modal-close" onClick={() => setInviteOpen(false)} aria-label="Close">×</button></header>
        <form className="team-form" onSubmit={invite}>
          <label><span>Full name <em>*</em></span><input name="name" autoFocus required placeholder="Asha Kumar" /></label>
          <label><span>Work email <em>*</em></span><input name="email" type="email" autoComplete="email" required placeholder="asha@company.com" /></label>
          <label><span>Maximum open leads <em>*</em></span><input name="maxOpenLeads" type="number" min="0" max="10000" defaultValue="10" required /><small>Leadflow can use this later when suggesting assignments.</small></label>
          <label className="availability-choice"><input name="isAvailable" type="checkbox" defaultChecked /><span><strong>Available for lead assignments</strong><small>Turn this off if this teammate should not receive new leads yet.</small></span></label>
          <footer><button type="button" className="secondary-button" onClick={() => setInviteOpen(false)}>Cancel</button><button className="primary-button" disabled={busy === "invite"}>{busy === "invite" ? "Sending…" : "Send invitation"}</button></footer>
        </form>
      </section>
    </div>}

    {editing && <EditMemberModal member={editing} busy={busy === editing.id} onClose={() => setEditing(null)} onSave={(body) => void updateMember(editing, body, "Member details updated.")} />}
  </DashboardShell>;
}

function MemberRow({ member, busy, onManage, onDeactivate, onReactivate, onResend }: { member: TeamMember; busy: string; onManage?: () => void; onDeactivate?: () => void; onReactivate?: () => void; onResend?: () => void }) {
  return <article className="member-row">
    <span className="member-avatar">{initials(member.name)}</span>
    <div className="member-identity"><strong>{member.name}</strong><span>{member.email}</span></div>
    <div className="member-meta"><span className={"member-status " + member.status}>{member.role === "manager" ? "Manager" : member.status}</span>{member.role === "user" && member.status === "active" && <small>{member.is_available ? "Available" : "Not available"} · {member.max_open_leads} lead capacity</small>}</div>
    <div className="member-actions">
      {onManage && <button className="secondary-button" disabled={busy === member.id} onClick={onManage}>Manage</button>}
      {onResend && <button className="secondary-button" disabled={busy === member.id} onClick={onResend}>Resend invite</button>}
      {onReactivate && <button className="secondary-button" disabled={busy === member.id} onClick={onReactivate}>Reactivate</button>}
      {onDeactivate && <button className="text-danger" disabled={busy === member.id} onClick={onDeactivate}>{member.status === "invited" ? "Cancel invite" : "Deactivate"}</button>}
    </div>
  </article>;
}

function EditMemberModal({ member, busy, onClose, onSave }: { member: TeamMember; busy: boolean; onClose: () => void; onSave: (body: Record<string, unknown>) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave({ name: form.get("name"), max_open_leads: Number(form.get("maxOpenLeads")), is_available: form.get("isAvailable") === "on" });
  }

  return <div className="wizard-backdrop" role="presentation">
    <section className="team-modal" role="dialog" aria-modal="true" aria-labelledby="member-title">
      <header><div><p className="eyebrow">TEAM MEMBER</p><h2 id="member-title">Manage {member.name}</h2><p>Update how this teammate appears and receives work.</p></div><button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button></header>
      <form className="team-form" onSubmit={submit}>
        <label><span>Full name <em>*</em></span><input name="name" defaultValue={member.name} required /></label>
        <label><span>Maximum open leads <em>*</em></span><input name="maxOpenLeads" type="number" min="0" max="10000" defaultValue={member.max_open_leads} required /></label>
        <label className="availability-choice"><input name="isAvailable" type="checkbox" defaultChecked={member.is_available} /><span><strong>Available for lead assignments</strong><small>Unavailable users keep access but are skipped by future automatic assignment.</small></span></label>
        <footer><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button></footer>
      </form>
    </section>
  </div>;
}
