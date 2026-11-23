"use client";

import Link from "next/link";
import { Bell, ChevronDown, CircleHelp, Gauge, Inbox, Search, Settings, SlidersHorizontal, Users } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api, ApiError, authenticatedDestination, type AuthenticatedUserResponse } from "@/lib/api";

const managerNavigation = [
  ["Overview", "/", Gauge],
  ["Leads", "/leads", Inbox],
  ["Sources", "/sources", SlidersHorizontal],
  ["Team", "/team", Users],
  ["Workspace profile", "/settings", Settings],
] as const;
const userNavigation = [["My leads", "/leads", Inbox]] as const;

export function DashboardShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<"manager" | "user" | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api<AuthenticatedUserResponse>("/api/v1/auth/me", undefined, "GET")
      .then((result) => {
        const destination = authenticatedDestination(result);
        if (destination !== "/" && path !== destination) {
          router.replace(destination);
          return;
        }
        if (!cancelled) {
          setRole(result.user.role);
          setReady(true);
        }
      })
      .catch((error) => {
        if (!cancelled) router.replace(error instanceof ApiError && error.status === 403 ? "/workspace-setup-pending" : "/login");
      });
    return () => { cancelled = true; };
  }, [path, router]);

  if (!ready || role === null) return <main className="page-content"><p className="subheading">Checking your workspace access…</p></main>;

  const navigation = role === "manager" ? managerNavigation : userNavigation;
  const accountLabel = role === "manager" ? "Manager" : "User";

  return <main className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href={role === "manager" ? "/" : "/leads"}><span className="brand-mark">L</span>Leadflow</Link>
      <nav className="main-nav">
        {navigation.map(([label, href, Icon]) => <Link className={"nav-item" + (path === href ? " is-active" : "")} href={href} key={href}><Icon size={18}/>{label}</Link>)}
      </nav>
      <div className="sidebar-footer">
        <Link className={"nav-item" + (path === "/help" ? " is-active" : "")} href="/help"><CircleHelp size={18}/>Help</Link>
        <div className="account-card"><span className="avatar">SR</span><div><strong>Samanvith Reddy</strong><span>{accountLabel}</span></div><ChevronDown size={16}/></div>
      </div>
    </aside>
    <section className="workspace">
      <header className="topbar">
        <button className="workspace-picker"><span className="workspace-initial">D</span>Demo workspace<ChevronDown size={16}/></button>
        <div className="topbar-actions"><button className="icon-button"><Search size={19}/></button><button className="icon-button has-notification"><Bell size={19}/></button></div>
      </header>
      <div className="page-content">
        <div className="page-heading"><div><p className="eyebrow">{role === "user" ? "MY WORK" : path === "/" ? "Overview" : "Workspace"}</p><h1>{title}</h1><p className="subheading">{subtitle}</p></div></div>
        {children}
      </div>
    </section>
  </main>;
}
