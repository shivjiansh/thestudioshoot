import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/firebase/admin";
export default async function AdminPage() {
  const user = await currentUser();
  if (!user) return redirect("/login");
  const snap = await db.collection("users").doc(user.uid).get();
  if (snap.data()?.role !== "admin") redirect("/dashboard");
  const [users, subs, jobs, events] = await Promise.all([
    db.collection("users").limit(100).get(),
    db.collection("subscriptions").limit(100).get(),
    db
      .collection("generationJobs")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get(),
    db
      .collection("billingEvents")
      .orderBy("receivedAt", "desc")
      .limit(100)
      .get(),
  ]);
  return (
    <>
      <header className="dash-head">
        <div>
          <span className="eyebrow">RESTRICTED ACCESS</span>
          <h1>Admin overview</h1>
          <p>
            Read-only operational snapshot for the authenticated administrator.
          </p>
        </div>
      </header>
      <div className="metrics">
        {[
          ["Users", users.size],
          ["Subscription records", subs.size],
          ["Recent generation jobs", jobs.size],
          ["Billing events", events.size],
        ].map(([t, n]) => (
          <div className="metric" key={String(t)}>
            <span>{t}</span>
            <strong>{n}</strong>
          </div>
        ))}
      </div>
      <section className="panel">
        <h2 style={{ font: "25px var(--serif)" }}>Recent generation jobs</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Job</th>
                <th>Owner UID</th>
                <th>Status</th>
                <th>Plan</th>
              </tr>
            </thead>
            <tbody>
              {jobs.docs.map((d) => (
                <tr key={d.id}>
                  <td>{d.id.slice(0, 10)}…</td>
                  <td>{String(d.data().uid ?? "").slice(0, 12)}…</td>
                  <td>{String(d.data().status ?? "unknown")}</td>
                  <td>{String(d.data().planId ?? "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Admin access is granted only to the configured `ADMIN_BOOTSTRAP_EMAIL`
          during verified sign-in. No public role assignment is exposed.
        </p>
      </section>
    </>
  );
}
