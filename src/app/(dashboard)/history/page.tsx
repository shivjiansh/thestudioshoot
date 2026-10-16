import Link from "next/link";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/firebase/admin";
export default async function History() {
  let jobs: any[] = [];
  let signed = false;
  try {
    const u = await currentUser();
    if (u) {
      signed = true;
      const s = await db
        .collection("generationJobs")
        .where("uid", "==", u.uid)
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();
      jobs = s.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        created:
          d.data().createdAt?.toDate?.().toLocaleString("en-IN") ?? "Recent",
      }));
    }
  } catch {}
  return (
    <>
      <header className="dash-head">
        <div>
          <span className="eyebrow">JOB RECORDS</span>
          <h1>Generation history</h1>
          <p>Generation statuses associated with your account.</p>
        </div>
        <Link className="button dark" href="/studio">
          New generation
        </Link>
      </header>
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Job</th>
                <th>Prompt</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td>{j.id.slice(0, 8)}…</td>
                  <td>{String(j.prompt ?? "").slice(0, 60)}</td>
                  <td>{j.status}</td>
                  <td>{j.created}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {jobs.length === 0 && (
          <div className="empty">
            <h3>No jobs yet</h3>
            <p>
              {signed
                ? "Start a generation to create a job record."
                : "Sign in to view your private job history."}
            </p>
            <Link className="button dark" href={signed ? "/studio" : "/login"}>
              {signed ? "Open Studio" : "Sign in"}
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
