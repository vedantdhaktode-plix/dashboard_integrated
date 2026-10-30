import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import UnifiedDashboard from "@/components/UnifiedDashboard";
import MasterAdminDashboard from "@/components/MasterAdminDashboard";
import { getState } from "@/lib/store/unified-store";

export const dynamic = "force-dynamic";

export default async function Page() {
  const sessionUser = await getServerSession();
  if (!sessionUser) {
    redirect("/login");
  }

  if (sessionUser.role === "master_admin") {
    return <MasterAdminDashboard />;
  }

  const state = await getState();

  return (
    <UnifiedDashboard
      initialTasks={state.tasks || []}
      initialUsers={state.users || []}
      initialNotifications={state.notifications || []}
      sessionUser={sessionUser}
    />
  );
}
