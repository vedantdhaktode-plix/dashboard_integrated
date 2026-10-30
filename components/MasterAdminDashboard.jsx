"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, LogOut, Workflow } from "lucide-react";

const VIEWS = {
  studio: {
    label: "Workflow studio",
    src: "/content-studio/studio.html",
  },
  tracker: {
    label: "AI tracker",
    src: "/content-studio/index.html",
  },
};

export default function MasterAdminDashboard() {
  const [view, setView] = useState("tracker");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function signOut() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <main className="master-admin-shell">
      <header className="master-admin-bar">
        <div className="master-admin-identity">
          <span className="master-admin-mark">MA</span>
          <span>
            <strong>Master Admin</strong>
            <small>Plix Content Studio</small>
          </span>
        </div>

        <nav className="master-admin-view-switcher" aria-label="Master Admin dashboards">
          <button
            type="button"
            className={view === "studio" ? "active" : ""}
            aria-pressed={view === "studio"}
            onClick={() => setView("studio")}
          >
            <Workflow size={15} />
            Workflow studio
          </button>
          <button
            type="button"
            className={view === "tracker" ? "active" : ""}
            aria-pressed={view === "tracker"}
            onClick={() => setView("tracker")}
          >
            <BarChart3 size={15} />
            AI tracker
          </button>
        </nav>

        <button type="button" className="master-admin-logout" onClick={signOut} disabled={loading}>
          <LogOut size={15} />
          {loading ? "Signing out…" : "Sign out"}
        </button>
      </header>

      <iframe
        key={view}
        className="master-admin-frame"
        src={VIEWS[view].src}
        title={VIEWS[view].label}
      />
    </main>
  );
}
