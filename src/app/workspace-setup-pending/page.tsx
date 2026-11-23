import Link from "next/link";

import { AuthShell } from "@/components/auth-shell";

export default function WorkspaceSetupPendingPage() {
  return (
    <AuthShell
      title="Workspace setup is in progress"
      subtitle="A workspace manager needs to finish the initial setup before team members can work with leads."
      footer={<Link href="/login">Back to sign in</Link>}
    >
      <p className="form-notice success">
        Your account is ready. Please ask your workspace manager to complete setup.
      </p>
    </AuthShell>
  );
}
