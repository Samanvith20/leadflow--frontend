"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { api, ApiError } from "@/lib/api";

function message(error: unknown) {
  return error instanceof ApiError ? error.message : "We could not reach Leadflow. Check that the API is running and try again.";
}

export function AcceptInvitationForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("confirmPassword")) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await api<{ message: string }>("/api/v1/team/invitations/accept", {
        token,
        password: form.get("password"),
      });
      setSuccess(result.message);
      window.setTimeout(() => router.replace("/login"), 1500);
    } catch (requestError) {
      setError(message(requestError));
    } finally {
      setLoading(false);
    }
  }

  return <AuthShell title="Join your team" subtitle="Choose a password to activate your Leadflow account." footer={<Link href="/login">Already activated? Sign in</Link>}>
    <form className="auth-form" onSubmit={submit}>
      {(error || !token) && <p className="form-notice error" role="alert">{error || "This invitation link is missing its token."}</p>}
      {success && <p className="form-notice success" role="status">{success}</p>}
      <label>New password<input name="password" type="password" autoComplete="new-password" minLength={12} required disabled={!token || Boolean(success)} placeholder="At least 12 characters" /></label>
      <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} required disabled={!token || Boolean(success)} placeholder="Repeat your password" /></label>
      <button className="primary-button auth-submit" disabled={!token || loading || Boolean(success)}>{loading ? "Activating…" : "Activate account"}</button>
    </form>
  </AuthShell>;
}
