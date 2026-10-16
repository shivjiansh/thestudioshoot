import Link from "next/link";
import { ExportButton } from "@/components/assets/ExportButton";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/firebase/admin";

type GalleryAsset = { id: string; prompt: string; previewUrl: string };
export default async function Gallery() {
  let assets: GalleryAsset[] = [];
  let signedIn = false;
  try {
    const user = await currentUser();
    if (user) {
      signedIn = true;
      const snapshot = await db
        .collection("generatedAssets")
        .where("uid", "==", user.uid)
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();
      assets = snapshot.docs.map((doc) => ({
        id: doc.id,
        prompt: String(doc.data().prompt ?? "Generated image"),
        previewUrl: `/api/assets/${doc.id}/preview`,
      }));
    }
  } catch {
    /* The page renders a useful empty state if storage/database configuration is unavailable. */
  }
  return (
    <>
      <header className="dash-head">
        <div>
          <span className="eyebrow">YOUR CREATIVE LIBRARY</span>
          <h1>Gallery</h1>
          <p>
            Private assets saved to your account. Preview images are
            watermarked; exports follow your plan.
          </p>
        </div>
        <Link className="button dark" href="/studio">
          New generation
        </Link>
      </header>
      {!signedIn && (
        <div className="notice">
          Sign in to load your private gallery.{" "}
          <Link href="/login">
            <u>Sign in</u>
          </Link>
        </div>
      )}
      {assets.length === 0 ? (
        <div className="empty">
          <h3>Your gallery is ready</h3>
          <p>Completed generations will appear here.</p>
          <Link className="button dark" href={signedIn ? "/studio" : "/login"}>
            {signedIn ? "Create image" : "Sign in"}
          </Link>
        </div>
      ) : (
        <div className="teaser-grid">
          {assets.map((asset) => (
            <article className="doc-card" key={asset.id}>
              <img
                src={asset.previewUrl}
                alt={asset.prompt}
                style={{ width: "100%", height: 220, objectFit: "cover" }}
                loading="lazy"
              />
              <p>{asset.prompt}</p>
              <ExportButton
                assetId={asset.id}
                filename={`thestudioshot-${asset.id}.png`}
              />
            </article>
          ))}
        </div>
      )}
    </>
  );
}
