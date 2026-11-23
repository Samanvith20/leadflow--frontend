import Link from "next/link";
import type { ReactNode } from "react";
import "./auth.css";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return <main className="auth-page"><section className="auth-panel"><Link className="auth-brand" href="/"><span className="brand-mark">L</span>Leadflow</Link><div className="auth-copy"><h1>{title}</h1><p>{subtitle}</p></div>{children}{footer && <div className="auth-footer">{footer}</div>}</section><aside className="auth-aside"><div><p className="eyebrow">Lead operations, simplified</p><h2>Every genuine enquiry gets the right next step.</h2><p>Collect, qualify, assign, and follow up from one calm workspace.</p></div><div className="auth-feature"><span>01</span><p>Secure intake from website forms, Meta, and trusted webhooks.</p></div></aside></main>;
}
