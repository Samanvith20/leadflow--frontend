"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { API_URL, api, ApiError } from "@/lib/api";

type Field = {
  id: string;
  key: string;
  label: string;
  field_type: string;
  required: boolean;
  maps_to: string;
};

type Source = {
  id: string;
  name: string;
  public_id: string;
  status: "active" | "paused" | "archived";
  configuration: { field_definitions?: Field[] };
};

type CreatedSource = Source & { webhook_url: string; webhook_secret: string | null };
type ToastKind = "success" | "error";
type Toast = { message: string; kind: ToastKind } | null;

const fieldCatalog: Field[] = [
  { id: "name", key: "full_name", label: "Full name", field_type: "Text", required: true, maps_to: "contact.full_name" },
  { id: "email", key: "email", label: "Email", field_type: "Email", required: true, maps_to: "contact.email" },
  { id: "message", key: "message", label: "Requirement", field_type: "Text", required: true, maps_to: "lead.enquiry_message" },
  { id: "phone", key: "phone", label: "Phone number", field_type: "Phone", required: false, maps_to: "contact.phone_e164" },
  { id: "company", key: "company_name", label: "Company name", field_type: "Text", required: false, maps_to: "contact.company_name" },
  { id: "budget", key: "budget", label: "Budget", field_type: "Number", required: false, maps_to: "lead.custom_fields" },
  { id: "timeline", key: "timeline", label: "Preferred start date", field_type: "Date", required: false, maps_to: "lead.custom_fields" },
];

const defaultFields = () => fieldCatalog.slice(0, 3).map((field) => ({ ...field }));
const apiFieldType = (fieldType: string) => fieldType === "Text" ? "string" : fieldType.toLowerCase();
const errorMessage = (error: unknown) => error instanceof ApiError ? error.message : "Could not complete that action. Please try again.";

function toKey(label: string) {
  return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "custom_answer";
}

function sampleValue(field: Field) {
  if (field.key === "email") return "name@example.com";
  if (field.key === "phone") return "+91 98765 43210";
  if (field.key === "budget") return 50000;
  if (field.key === "timeline") return "2026-12-01";
  if (field.key === "message") return "I would like to know more about your service.";
  if (field.key === "company_name") return "Example company";
  return "Example answer";
}

function requestContract(source: Source | CreatedSource) {
  const data = Object.fromEntries((source.configuration.field_definitions ?? []).map((field) => [field.key, sampleValue(field)]));
  return `POST ${API_URL}/api/v1/webhooks/${source.public_id}

Headers
Content-Type: application/json
X-Leadflow-Timestamp: <current time in seconds>
X-Leadflow-Signature: v1=<signature calculated by your backend>

Body
${JSON.stringify({ event_id: "unique-id-for-this-submission", data }, null, 2)}`;
}

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [sourceType, setSourceType] = useState("website_form");
  const [sourceName, setSourceName] = useState("");
  const [fields, setFields] = useState<Field[]>(defaultFields);
  const [customField, setCustomField] = useState("");
  const [createdSource, setCreatedSource] = useState<CreatedSource | null>(null);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState<Toast>(null);

  const availableFields = useMemo(
    () => fieldCatalog.filter((field) => !fields.some((selected) => selected.id === field.id)),
    [fields],
  );
  const activeSources = sources.filter((source) => source.status === "active").length;
  const visibleSources = sources.filter((source) => source.status !== "archived");
  const archivedSources = sources.filter((source) => source.status === "archived");

  function showToast(message: string, kind: ToastKind) {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 3500);
  }

  function resetWizard() {
    setStep(1);
    setSourceType("website_form");
    setSourceName("");
    setFields(defaultFields());
    setCustomField("");
    setCreatedSource(null);
    setBusy("");
  }

  function openWizard() {
    resetWizard();
    setIsOpen(true);
  }

  function discard() {
    resetWizard();
    setIsOpen(false);
    showToast("Source setup discarded. Nothing was saved.", "success");
  }

  useEffect(() => {
    void api<Source[]>("/api/v1/sources", undefined, "GET")
      .then(setSources)
      .catch((error) => showToast(errorMessage(error), "error"));
  }, []);

  function addField(id: string) {
    const field = fieldCatalog.find((candidate) => candidate.id === id);
    if (field && !fields.some((selected) => selected.id === id)) {
      setFields((current) => [...current, { ...field }]);
    }
  }

  function addCustomField() {
    const label = customField.trim();
    const key = toKey(label);
    if (!label) {
      showToast("Enter the name of the field you want to add.", "error");
      return;
    }
    if (fields.some((field) => field.key === key)) {
      showToast("A field with that name already exists.", "error");
      return;
    }
    setFields((current) => [...current, {
      id: `custom-${key}`,
      key,
      label,
      field_type: "Text",
      required: false,
      maps_to: "lead.custom_fields",
    }]);
    setCustomField("");
  }

  function hasMinimumFields() {
    const hasMessage = fields.some((field) => field.maps_to === "lead.enquiry_message");
    const hasReachableContact = fields.some((field) => field.maps_to === "contact.email" || field.maps_to === "contact.phone_e164");
    return hasMessage && hasReachableContact;
  }

  function goToConnectionStep() {
    if (!hasMinimumFields()) {
      showToast("Keep a Requirement field and at least Email or Phone number so your team can reply.", "error");
      return;
    }
    setStep(4);
  }

  async function saveSource() {
    setBusy("create");
    try {
      const source = await api<CreatedSource>("/api/v1/sources", {
        name: sourceName.trim(),
        source_type: sourceType,
        configuration: {
          field_definitions: fields.map(({ id, field_type, ...field }) => ({ ...field, field_type: apiFieldType(field_type) })),
          unknown_field_policy: "reject",
        },
      });
      setSources((current) => [source, ...current]);
      setCreatedSource(source);
      showToast("Source saved. Copy the connection details now.", "success");
    } catch (error) {
      showToast(errorMessage(error), "error");
    } finally {
      setBusy("");
    }
  }

  function nextStep() {
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!sourceName.trim()) {
        showToast("Enter a name for this form.", "error");
        return;
      }
      setStep(3);
      return;
    }
    goToConnectionStep();
  }

  async function updateStatus(source: Source, status: Source["status"]) {
    setBusy(source.id);
    try {
      const updated = await api<Source>(`/api/v1/sources/${source.id}`, { status }, "PATCH");
      setSources((current) => current.map((item) => item.id === source.id ? updated : item));
      showToast(status === "archived" ? "Source archived." : `Source ${status}.`, "success");
    } catch (error) {
      showToast(errorMessage(error), "error");
    } finally {
      setBusy("");
    }
  }

  function finish() {
    resetWizard();
    setIsOpen(false);
    showToast("Source setup complete.", "success");
  }

  return (
    <DashboardShell title="Sources" subtitle="Connect the places where enquiries come from.">
      {toast && <div className={`app-toast ${toast.kind}`} role="status">{toast.message}</div>}
      <div className="sources-toolbar">
        <div><strong>{activeSources} active source{activeSources === 1 ? "" : "s"}</strong><p>Keep one active source so Leadflow can receive enquiries.</p></div>
        <button className="primary-button" onClick={openWizard}>Add source</button>
      </div>

      <section className="source-list">
        {visibleSources.map((source) => <article className="source-card" key={source.id}>
          <header><div><h2>{source.name}</h2><p><span className={`source-status ${source.status}`}>{source.status === "active" ? "Active" : "Inactive"}</span> · {source.status === "active" ? "Receives enquiries now" : "Does not receive enquiries"}</p></div></header>
          <div className="source-fields"><strong>This form collects</strong><div>{(source.configuration.field_definitions ?? []).map((field) => <span key={field.key}>{field.label}{field.required ? " *" : ""}</span>)}</div></div>
          <details className="connection-details">
            <summary>View connection instructions</summary>
            <p>The secret is only displayed when the source is created. If it is lost, create a new source and update your website backend with its new details.</p>
            <label>Webhook URL<input readOnly value={`${API_URL}/api/v1/webhooks/${source.public_id}`} /></label>
            <pre><code>{requestContract(source)}</code></pre>
          </details>
          <div className="source-card-actions">
            {source.status === "active" && <button className="text-danger" disabled={busy === source.id} onClick={() => updateStatus(source, "archived")}>Archive source</button>}
            {source.status === "paused" && <button className="secondary-button" disabled={busy === source.id} onClick={() => updateStatus(source, "active")}>Make active</button>}
          </div>
        </article>)}
      </section>
      {archivedSources.length > 0 && <details className="archived-sources">
        <summary>Archived sources ({archivedSources.length})</summary>
        <p>Archived sources do not receive enquiries and are hidden from the normal list. Restore one only if you need to use it again.</p>
        <div className="source-list">
          {archivedSources.map((source) => <article className="source-card archived-card" key={source.id}>
            <header><div><h2>{source.name}</h2><p><span className="source-status archived">Archived</span> · Does not receive enquiries</p></div></header>
            <div className="source-fields"><strong>This form collected</strong><div>{(source.configuration.field_definitions ?? []).map((field) => <span key={field.key}>{field.label}{field.required ? " *" : ""}</span>)}</div></div>
            <div className="source-card-actions"><button className="secondary-button" disabled={busy === source.id} onClick={() => updateStatus(source, "active")}>Unarchive source</button></div>
          </article>)}
        </div>
      </details>}

      {isOpen && <div className="wizard-backdrop" role="presentation">
        <section className="source-wizard" role="dialog" aria-modal="true" aria-labelledby="source-wizard-title">
          <header>
            <div><p className="eyebrow">Step {step} of 4</p><h2 id="source-wizard-title">{step === 1 ? "Choose source type" : step === 2 ? "Name this source" : step === 3 ? "Choose form fields" : "Review and save"}</h2></div>
            <button className="modal-close" type="button" onClick={createdSource ? finish : discard} aria-label="Close">×</button>
          </header>
          {step === 1 && <div className="wizard-content">
            <p>Select where these enquiries will come from.</p>
            <label className="wizard-label">Source type<select value={sourceType} onChange={(event) => setSourceType(event.target.value)}><option value="website_form">Website form</option><option disabled>Meta Lead Ads — coming later</option><option disabled>WhatsApp — coming later</option></select></label>
          </div>}
          {step === 2 && <div className="wizard-content">
            <p>Use a name your team will recognise in Leadflow.</p>
            <label className="wizard-label"><span>Form name <em>*</em></span><input autoFocus value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="Website enquiries" /></label>
          </div>}
          {step === 3 && <div className="wizard-content">
            <p>These are only the fields this source sends. Remove anything your form does not collect, or add your own question.</p>
            <div className="field-builder">
              {fields.map((field) => <div className="friendly-field" key={field.id}><div><strong>{field.label}</strong><span>{field.field_type}</span></div><label className="required-toggle"><input type="checkbox" checked={field.required} onChange={(event) => setFields((current) => current.map((item) => item.id === field.id ? { ...item, required: event.target.checked } : item))} />Required</label><button className="text-danger" type="button" onClick={() => setFields((current) => current.filter((item) => item.id !== field.id))}>Remove</button></div>)}
              {availableFields.length > 0 && <div className="add-field-options"><strong>Add a common field</strong><div>{availableFields.map((field) => <button type="button" key={field.id} onClick={() => addField(field.id)}>+ {field.label}</button>)}</div></div>}
              <div className="custom-field"><strong>Add your own field</strong><div><input value={customField} onChange={(event) => setCustomField(event.target.value)} placeholder="For example: Project location" /><button type="button" className="secondary-button" onClick={addCustomField}>Add field</button></div></div>
              <p><strong>Leadflow needs:</strong> Requirement, plus Email or Phone number, so your team can respond.</p>
            </div>
          </div>}
          {step === 4 && <div className="wizard-content connection-step">
            {!createdSource && <><p>Everything is ready. Nothing has been saved yet. Click the button below to save this source and reveal its one-time webhook URL and secret.</p><div className="security-explainer"><strong>Before you save</strong><p>You will need access to your website backend to store the secret safely. It must never be placed in browser code.</p></div></>}
            {createdSource && <><p><strong>Your source has been saved.</strong> Copy these details into your website backend now. The secret will not be shown again.</p><label className="wizard-label">Webhook URL<input readOnly value={`${API_URL}${createdSource.webhook_url}`} /></label><label className="wizard-label">Webhook secret<input readOnly value={createdSource.webhook_secret ?? ""} /></label><div className="security-explainer"><strong>Where does this secret go?</strong><p>Save it in your website backend environment variables. Your backend uses it to sign each request; it never sends the secret itself and it must not go into browser code.</p></div><details className="connection-details" open><summary>How your developer connects the form</summary><p>Any backend language can do this. Send an HTTP POST to the URL with the headers and JSON body below.</p><pre><code>{requestContract(createdSource)}</code></pre><dl className="header-explanations"><div><dt>Content-Type</dt><dd>Says the request body is JSON data.</dd></div><div><dt>Timestamp</dt><dd>Says when the request was made. Leadflow rejects old copied requests.</dd></div><div><dt>Signature</dt><dd>Proof made by your backend using the secret, timestamp, and exact request data. The secret itself is never sent.</dd></div></dl></details></>}
          </div>}
          <footer className="wizard-actions">
            {step > 1 && step < 4 && <button type="button" className="secondary-button" onClick={() => setStep((current) => current - 1)}>Back</button>}
            {step < 4 && <button type="button" className="secondary-button" onClick={discard}>Discard</button>}
            {step === 4 && !createdSource && <><button type="button" className="secondary-button" onClick={() => setStep(3)}>Back</button><button type="button" className="secondary-button" onClick={discard}>Discard</button></>}
            {step < 3 && <button type="button" className="primary-button" onClick={nextStep}>Next</button>}
            {step === 3 && <button type="button" className="primary-button" disabled={busy === "create"} onClick={nextStep}>{busy === "create" ? "Saving…" : "Save and show connection"}</button>}
            {step === 4 && !createdSource && <button type="button" className="primary-button" disabled={busy === "create"} onClick={() => void saveSource()}>{busy === "create" ? "Saving…" : "Save source and reveal details"}</button>}
            {step === 4 && createdSource && <button type="button" className="primary-button" onClick={finish}>I saved the details</button>}
          </footer>
        </section>
      </div>}
    </DashboardShell>
  );
}
