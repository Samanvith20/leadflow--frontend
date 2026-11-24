"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthShell } from "@/components/auth-shell";
import { api, ApiError } from "@/lib/api";

const steps = ["business_profile", "qualification", "ai_guidance"] as const;
const stepLabels = ["Business profile", "Priority rules", "AI guidance"];
const commonBuyerSignals = ["Has a clear need", "Has a budget", "Needs help soon", "Shares a business contact"];
const toneOptions = ["Helpful and professional", "Warm and conversational", "Concise and direct", "Premium and consultative"];
const replyGoalOptions = ["Book a consultation", "Arrange a callback", "Collect missing details", "Share clear next steps"];

type OnboardingProgress = {
  current_step: (typeof steps)[number];
  completed_at: string | null;
  organization: {
    industry: string | null;
    business_description: string | null;
    services: string[];
    service_areas: string[];
  };
  qualification: {
    ideal_lead_description: string | null;
    must_have: string[];
    disqualifiers: string[];
  };
  ai_guidance: {
    brand_tone: string | null;
    reply_goal: string | null;
    must_not_claim: string[];
    escalate_when: string[];
  };
};

type TagListFieldProps = {
  label: string;
  hint: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  required?: boolean;
};

function message(error: unknown) {
  return error instanceof ApiError ? error.message : "Could not save your progress. Please try again.";
}

function stepIndex(currentStep: string) {
  return Math.max(0, steps.indexOf(currentStep as (typeof steps)[number]));
}

function RequiredMark() {
  return <span className="required-mark" aria-hidden="true">*</span>;
}

function TagListField({ label, hint, values, onChange, placeholder, required = true }: TagListFieldProps) {
  const [entry, setEntry] = useState("");
  const [entryError, setEntryError] = useState("");

  function addValue() {
    const value = entry.trim().replace(/\s+/g, " ");
    if (!value) return;
    if (value.includes(",")) {
      setEntryError("Add one item at a time. Type it, then select Add.");
      return;
    }
    if (value.length < 2 || value.length > 100) {
      setEntryError("Use between 2 and 100 characters.");
      return;
    }
    if (values.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      setEntryError("That item has already been added.");
      return;
    }

    onChange([...values, value]);
    setEntry("");
    setEntryError("");
  }

  return (
    <fieldset className="tag-field">
      <legend>{label} {required && <RequiredMark />}</legend>
      <p className="form-hint">{hint}</p>
      <div className="tag-list" aria-live="polite">
        {values.map((value) => <span className="tag" key={value.toLocaleLowerCase()}>{value}<button type="button" aria-label={`Remove ${value}`} onClick={() => onChange(values.filter((item) => item !== value))}>×</button></span>)}
      </div>
      <div className="tag-entry">
        <input
          value={entry}
          onChange={(event) => { setEntry(event.target.value); setEntryError(""); }}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addValue(); } }}
          placeholder={placeholder}
        />
        <button type="button" className="secondary-button" onClick={addValue}>Add</button>
      </div>
      {entryError && <p className="field-error" role="alert">{entryError}</p>}
    </fieldset>
  );
}

function SuggestedSignals({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  return (
    <div className="suggested-signals">
      <span>Common signs of a serious enquiry</span>
      <div>
        {commonBuyerSignals.map((signal) => {
          const selected = values.some((value) => value.toLocaleLowerCase() === signal.toLocaleLowerCase());
          return <button className={selected ? "is-selected" : ""} disabled={selected} key={signal} type="button" onClick={() => onChange([...values, signal])}>{selected ? "✓ " : "+ "}{signal}</button>;
        })}
      </div>
    </div>
  );
}

function ChoiceField({ label, hint, options, value, onChange }: { label: string; hint: string; options: string[]; value: string; onChange: (value: string) => void }) {
  return <fieldset className="choice-field">
    <legend>{label} <RequiredMark /></legend>
    <p className="form-hint">{hint}</p>
    <div className="choice-grid">
      {options.map((option) => <button className={value === option ? "is-selected" : ""} key={option} type="button" onClick={() => onChange(option)}>{value === option && <span aria-hidden="true">✓</span>}{option}</button>)}
    </div>
  </fieldset>;
}

function formValue(form: FormData, field: string) {
  return String(form.get(field) ?? "").trim();
}

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [services, setServices] = useState<string[]>([]);
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const [mustHave, setMustHave] = useState<string[]>([]);
  const [disqualifiers, setDisqualifiers] = useState<string[]>([]);
  const [brandTone, setBrandTone] = useState("Helpful and professional");
  const [replyGoal, setReplyGoal] = useState("Book a consultation");
  const [escalateWhen, setEscalateWhen] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadProgress() {
      try {
        const savedProgress = await api<OnboardingProgress>("/api/v1/onboarding", undefined, "GET");

        if (savedProgress.completed_at) {
          router.replace("/");
          return;
        }

        setProgress(savedProgress);
        setStep(stepIndex(savedProgress.current_step));
        setServices(savedProgress.organization.services);
        setServiceAreas(savedProgress.organization.service_areas);
        setMustHave(savedProgress.qualification.must_have);
        setDisqualifiers(savedProgress.qualification.disqualifiers);
        setBrandTone(savedProgress.ai_guidance.brand_tone ?? "Helpful and professional");
        setReplyGoal(savedProgress.ai_guidance.reply_goal ?? "Book a consultation");
        setEscalateWhen(savedProgress.ai_guidance.escalate_when);
      } catch (loadError) {
        if (loadError instanceof ApiError && loadError.status === 401) {
          router.replace("/login");
          return;
        }
        if (loadError instanceof ApiError && loadError.status === 403) {
          router.replace("/workspace-setup-pending");
          return;
        }
        setError(message(loadError));
      }
    }

    void loadProgress();
  }, [router]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!progress) return;
    const form = new FormData(event.currentTarget);

    if (step === 0) {
      const industry = formValue(form, "industry");
      const description = formValue(form, "description");
      if (industry.length < 2) {
        setError("Enter an industry using at least 2 characters.");
        return;
      }
      if (description.length < 20) {
        setError("Describe your business in at least 20 characters.");
        return;
      }
      if (!services.length) {
        setError("Add at least one service.");
        return;
      }
      if (!serviceAreas.length) {
        setError("Add at least one service area.");
        return;
      }
    }

    if (step === 1 && formValue(form, "ideal").length < 30) {
      setError("Describe your ideal lead in at least 30 characters so qualification has useful context.");
      return;
    }

    if (step === 2 && (!brandTone || !replyGoal)) {
      setError("Choose a reply tone and a goal for the first reply.");
      return;
    }

    setSaving(true);

    try {
      let updated: OnboardingProgress | undefined;

      if (step === 0) {
        updated = await api<OnboardingProgress>("/api/v1/onboarding", {
          current_step: "qualification",
          organization: {
            industry: formValue(form, "industry"),
            business_description: formValue(form, "description"),
            services,
            service_areas: serviceAreas,
          },
        }, "PATCH");
      } else if (step === 1) {
        updated = await api<OnboardingProgress>("/api/v1/onboarding", {
          current_step: "ai_guidance",
          qualification: {
            ideal_lead_description: formValue(form, "ideal"),
            must_have: mustHave,
            disqualifiers,
          },
        }, "PATCH");
      } else if (step === 2) {
        updated = await api<OnboardingProgress>("/api/v1/onboarding", {
          current_step: "ai_guidance",
          ai_guidance: {
            brand_tone: brandTone,
            reply_goal: replyGoal,
            must_not_claim: progress.ai_guidance.must_not_claim,
            escalate_when: escalateWhen,
          },
        }, "PATCH");
        await api("/api/v1/onboarding/complete", {});
        router.replace("/");
        router.refresh();
        return;
      }

      if (updated) {
        setProgress(updated);
        setStep(stepIndex(updated.current_step));
      }
    } catch (saveError) {
      setError(message(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function goBack() {
    if (step === 0) return;
    setError("");
    setSaving(true);
    try {
      const updated = await api<OnboardingProgress>(
        "/api/v1/onboarding",
        { current_step: steps[step - 1] },
        "PATCH",
      );
      setProgress(updated);
      setStep(stepIndex(updated.current_step));
    } catch (backError) {
      setError(message(backError));
    } finally {
      setSaving(false);
    }
  }

  if (!progress) {
    return (
      <AuthShell title="Loading your setup" subtitle="Checking your saved onboarding progress.">
        {error && <p className="form-notice error">{error}</p>}
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set up Leadflow" subtitle={`Step ${step + 1} of 3 · ${stepLabels[step]}`}>
      <form className="auth-form" onSubmit={save}>
        {error && <p className="form-notice error">{error}</p>}

        {step === 0 && <>
          <label><span>Industry <RequiredMark /></span><input name="industry" required minLength={2} maxLength={100} placeholder="Interior design" defaultValue={progress.organization.industry ?? ""} /></label>
          <label><span>Business description <RequiredMark /></span><textarea name="description" required minLength={20} maxLength={4000} placeholder="What does your business do?" defaultValue={progress.organization.business_description ?? ""} /></label>
          <TagListField label="Services" hint="Add one service at a time. For example: SEO, then Website development." values={services} onChange={setServices} placeholder="e.g. SEO" />
          <TagListField label="Service areas" hint="Add each city, region, or country where you serve customers." values={serviceAreas} onChange={setServiceAreas} placeholder="e.g. Hyderabad" />
        </>}

        {step === 1 && <>
          <div className="onboarding-callout">
            <strong>Which enquiries should your team spend time on first?</strong>
            <p>Imagine a new message arrives. Tell us what type of customer and request should be treated as a good opportunity—not just another enquiry.</p>
            <p><b>Example:</b> “Business owners in Hyderabad who want a website or SEO help within the next month.”</p>
          </div>
          <label><span>Who should Leadflow prioritise? <RequiredMark /></span><textarea name="ideal" required minLength={30} maxLength={2000} placeholder="Example: Business owners who need a website or SEO help within the next month." defaultValue={progress.qualification.ideal_lead_description ?? ""} /><span className="form-hint">One clear sentence is enough: who they are and what they need.</span></label>
          <SuggestedSignals values={mustHave} onChange={setMustHave} />
          <TagListField label="What makes an enquiry serious?" required={false} hint="Optional. Add other signs that mean the customer is more likely to buy." values={mustHave} onChange={setMustHave} placeholder="e.g. Has a business website" />
          <TagListField label="What should not be prioritised?" required={false} hint="Optional. Add messages that your team usually does not serve." values={disqualifiers} onChange={setDisqualifiers} placeholder="e.g. Looking for a job" />
        </>}

        {step === 2 && <>
          <div className="onboarding-callout">
            <strong>How should Leadflow draft the first reply?</strong>
            <p>These choices guide suggested replies to new enquiries. In this MVP, replies stay as drafts for your team to review before sending.</p>
          </div>
          <ChoiceField label="How should replies sound?" hint="Choose the style that matches your business." options={toneOptions} value={brandTone} onChange={setBrandTone} />
          <ChoiceField label="What should the first reply achieve?" hint="Choose the main next step you want from a new enquiry." options={replyGoalOptions} value={replyGoal} onChange={setReplyGoal} />
          <TagListField label="Ask a human to help when" required={false} hint="Optional. Add situations that need a team member instead of a standard reply." values={escalateWhen} onChange={setEscalateWhen} placeholder="e.g. They request a custom enterprise quote" />
        </>}

        <div className="onboarding-actions">
          {step > 0 && <button className="secondary-button" type="button" onClick={goBack} disabled={saving}>Back</button>}
          <button className="primary-button" disabled={saving}>{saving ? "Saving…" : step === 2 ? "Finish setup" : "Save and continue"}</button>
        </div>
      </form>
    </AuthShell>
  );
}
