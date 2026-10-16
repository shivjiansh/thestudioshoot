import Link from "next/link";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/firebase/admin";
import { getPlan, API_PLANS } from "@/config/plans";
import { SubscribeButton } from "@/components/billing/SubscribeButton";
import { CancelSubscriptionButton } from "@/components/billing/CancelSubscriptionButton";
export default async function Billing() {
  const user = await currentUser();
  let data: Record<string, unknown> = {};
  let subscriptions: Array<{ id: string; planId: string; billingType: string; status: string }> = [];
  if (user) {
    const [profile, subscriptionSnap] = await Promise.all([
      db.collection("users").doc(user.uid).get(),
      db.collection("subscriptions").where("uid", "==", user.uid).orderBy("createdAt", "desc").limit(10).get(),
    ]);
    data = profile.data() ?? {};
    subscriptions = subscriptionSnap.docs.map((doc) => { const value = doc.data(); return { id: doc.id, planId: String(value.planId ?? ""), billingType: String(value.billingType ?? "consumer"), status: String(value.status ?? "unknown") }; });
  }
  const consumerPlan = getPlan(String(data.planId ?? "free"));
  const apiPlanId = String(data.apiPlanId ?? "");
  const apiPlan = Object.prototype.hasOwnProperty.call(API_PLANS, apiPlanId) && String(data.apiSubscriptionStatus ?? "") === "active" ? API_PLANS[apiPlanId as keyof typeof API_PLANS] : null;
  return <><header className="dash-head"><div><span className="eyebrow">PLAN & PAYMENT</span><h1>Billing</h1><p>Entitlements are sourced from server-side account and verified subscription records.</p></div><Link className="button dark" href="/pricing">Compare plans</Link></header><div className="metrics">{[["Consumer plan",user?consumerPlan.name:"—"],["Monthly price",user?`₹${consumerPlan.priceInr.toLocaleString("en-IN")}`:"—"],["AI credits remaining",user?Number(data.aiCreditsRemaining??0).toLocaleString("en-IN"):"—"],["Exports remaining",user?Number(data.exportsRemaining??100).toLocaleString("en-IN"):"—"]].map(([title,value])=><div className="metric" key={title}><span>{title}</span><strong>{value}</strong><small>{user?String(data.subscriptionStatus??"free"):"Sign in to view"}</small></div>)}</div><section className="panel"><h2 style={{font:"25px var(--serif)"}}>Consumer subscription</h2><p>{consumerPlan.name} · {String(data.subscriptionStatus??"free")}. Your plan defines credits, exports, watermark behavior, and commercial-use entitlement.</p><div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:16}}><SubscribeButton planId="pro" label="Upgrade to Pro"/><SubscribeButton planId="max" label="Choose Max" className="button light"/><SubscribeButton planId="ultra" label="Choose Ultra" className="button light"/></div></section><section className="panel"><h2 style={{font:"25px var(--serif)"}}>Developer API subscription</h2><p>{apiPlan?`${apiPlan.name} · ${String(data.apiSubscriptionStatus??"unknown")}`:"No active Developer API plan"}. Per-call usage is recorded separately; usage metering is not automatic charge collection.</p><div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:16}}><SubscribeButton planId="api-starter" label="API Starter"/><SubscribeButton planId="api-scale" label="API Scale" className="button light"/></div></section><section className="panel"><h2 style={{font:"25px var(--serif)"}}>Subscription history</h2><div className="table-wrap"><table><thead><tr><th>Subscription</th><th>Product</th><th>Plan</th><th>Status</th></tr></thead><tbody>{subscriptions.map(subscription=><tr key={subscription.id}><td>{subscription.id}</td><td>{subscription.billingType}</td><td>{subscription.planId}</td><td>{subscription.status}{["active", "authenticated", "pending", "halted"].includes(subscription.status) && <div style={{marginTop:8}}><CancelSubscriptionButton subscriptionId={subscription.id}/></div>}</td></tr>)}</tbody></table></div>{!subscriptions.length&&<p className="muted-copy">No provider subscription records found.</p>}</section><div className="notice">Razorpay checkout uses a hosted subscription URL. Subscription status and paid entitlements change only after the signed webhook is processed. Invoice retrieval and periodic subscription reconciliation are still release-gate items.</div></>;
}
