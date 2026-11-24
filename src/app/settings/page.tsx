"use client";

import { FormEvent, useEffect, useState } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { api, ApiError } from "@/lib/api";

type WorkspaceProfile = {
  name: string;
  timezone: string;
  organization: { industry: string | null; business_description: string | null; services: string[]; service_areas: string[] };
  qualification: { ideal_lead_description: string | null; must_have: string[]; disqualifiers: string[] };
  ai_guidance: { brand_tone: string | null; reply_goal: string | null; must_not_claim: string[]; escalate_when: string[] };
};

const tones = ["Helpful and professional", "Warm and conversational", "Concise and direct", "Premium and consultative"];
const goals = ["Book a consultation", "Arrange a callback", "Collect missing details", "Share clear next steps"];

const asLines = (values: string[]) => values.join("\n");
const fromLines = (value: FormDataEntryValue | null) => String(value ?? "").split("\n").map((item) => item.trim()).filter(Boolean);
const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const message = (error: unknown) => error instanceof ApiError ? error.message : "Could not save your workspace profile. Please try again.";

function RequiredLabel({ children }: { children: string }) {
  return <span className="profile-label">{children} <em aria-hidden="true">*</em></span>;
}

export default function WorkspaceProfilePage() {
  const [profile, setProfile] = useState<WorkspaceProfile | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<WorkspaceProfile>("/api/v1/workspace/profile", undefined, "GET")
      .then(setProfile)
      .catch((loadError) => setError(message(loadError)));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const organization = {
      industry: text(form, "industry"),
      business_description: text(form, "businessDescription"),
      services: fromLines(form.get("services")),
      service_areas: fromLines(form.get("serviceAreas")),
    };
    const qualification = {
      ideal_lead_description: text(form, "idealLead"),
      must_have: fromLines(form.get("mustHave")),
      disqualifiers: fromLines(form.get("disqualifiers")),
    };
    const ai_guidance = {
      brand_tone: text(form, "brandTone"),
      reply_goal: text(form, "replyGoal"),
      must_not_claim: profile?.ai_guidance.must_not_claim ?? [],
      escalate_when: fromLines(form.get("escalateWhen")),
    };

    if (!text(form, "name") || organization.industry.length < 2 || organization.business_description.length < 20 || !organization.services.length || !organization.service_areas.length || qualification.ideal_lead_description.length < 30 || !ai_guidance.brand_tone || !ai_guidance.reply_goal) {
      setError("Complete all fields marked with * before saving the workspace profile.");
      return;
    }

    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const updated = await api<WorkspaceProfile>("/api/v1/workspace/profile", {
        name: text(form, "name"), timezone: form.get("timezone"), organization, qualification, ai_guidance,
      }, "PATCH");
      setProfile(updated);
      setSuccess("Workspace profile saved. New lead qualification and reply drafts will use this context.");
    } catch (saveError) {
      setError(message(saveError));
    } finally {
      setSaving(false);
    }
  }

  return <DashboardShell title="Workspace profile" subtitle="The business context Leadflow uses to qualify enquiries and draft replies.">
    {!profile && !error && <div className="profile-loading">Loading your saved workspace profile…</div>}
    {error && <p className="profile-notice error" role="alert">{error}</p>}
    {profile && <>
      <nav className="profile-nav" aria-label="Workspace profile sections"><a href="#business">Business details</a><a href="#qualification">Qualification rules</a><a href="#ai-guidance">AI reply guidance</a></nav>
      <form className="profile-form" onSubmit={save}>
        {success && <p className="profile-notice success" role="status">{success}</p>}
        <section className="profile-section" id="business"><header><p className="eyebrow">Business details</p><h2>About your workspace</h2><p>Leadflow uses this information to understand what your business offers.</p></header>
          <div className="profile-grid two"><label><RequiredLabel>Workspace name</RequiredLabel><input name="name" required defaultValue={profile.name} /></label><label><RequiredLabel>Timezone</RequiredLabel><select name="timezone" defaultValue={profile.timezone}><option>Asia/Kolkata</option><option>UTC</option><option>America/New_York</option></select></label></div>
          <label><RequiredLabel>Industry</RequiredLabel><input name="industry" required minLength={2} defaultValue={profile.organization.industry ?? ""} /></label>
          <label><RequiredLabel>Business description</RequiredLabel><textarea name="businessDescription" required minLength={20} defaultValue={profile.organization.business_description ?? ""} /></label>
          <div className="profile-grid two"><label><RequiredLabel>Services</RequiredLabel><textarea name="services" required defaultValue={asLines(profile.organization.services)} /><small>One service per line.</small></label><label><RequiredLabel>Service areas</RequiredLabel><textarea name="serviceAreas" required defaultValue={asLines(profile.organization.service_areas)} /><small>One city, region, or country per line.</small></label></div>
        </section>
        <section className="profile-section" id="qualification"><header><p className="eyebrow">Qualification rules</p><h2>Which enquiries matter most?</h2><p>These rules help Leadflow prioritise enquiries worth your team’s attention.</p></header>
          <label><RequiredLabel>Who should Leadflow prioritise?</RequiredLabel><textarea name="idealLead" required minLength={30} defaultValue={profile.qualification.ideal_lead_description ?? ""} /><small>Describe the customer and the type of help they need.</small></label>
          <div className="profile-grid two"><label>Signs an enquiry is serious<textarea name="mustHave" defaultValue={asLines(profile.qualification.must_have)} /><small>Optional. One signal per line.</small></label><label>Do not prioritise when<textarea name="disqualifiers" defaultValue={asLines(profile.qualification.disqualifiers)} /><small>Optional. One case per line.</small></label></div>
        </section>
        <section className="profile-section" id="ai-guidance"><header><p className="eyebrow">AI reply guidance</p><h2>How should reply drafts behave?</h2><p>These rules guide AI drafts. Your team reviews a draft before it is sent.</p></header>
          <div className="profile-grid two"><label><RequiredLabel>Reply tone</RequiredLabel><select name="brandTone" defaultValue={profile.ai_guidance.brand_tone ?? tones[0]}>{tones.map((tone) => <option key={tone}>{tone}</option>)}</select></label><label><RequiredLabel>What should the first reply help achieve?</RequiredLabel><select name="replyGoal" defaultValue={profile.ai_guidance.reply_goal ?? goals[0]}>{goals.map((goal) => <option key={goal}>{goal}</option>)}</select><small>Choose the useful next action you want from a new enquiry.</small></label></div>
          <label>Escalate to a human when<textarea name="escalateWhen" defaultValue={asLines(profile.ai_guidance.escalate_when)} /><small>Optional. One situation per line.</small></label>
        </section>
        <div className="profile-actions"><button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save workspace profile"}</button></div>
      </form>
    </>}
  </DashboardShell>;
}
