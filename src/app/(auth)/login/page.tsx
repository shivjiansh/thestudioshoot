import Link from "next/link";
import { GoogleSignIn } from "@/components/auth/GoogleSignIn";
export default function Login() {
  return (
    <main className="auth-page">
      <section
        className="auth-art"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=1200&q=85)",
        }}
      >
        <Link className="brand" href="/">
          ✳ TheStudioShot
        </Link>
        <h1>
          Make every product
          <br />
          <em>camera-ready.</em>
        </h1>
        <span className="eyebrow">AI PRODUCT PHOTOGRAPHY WORKSPACE</span>
      </section>
      <section className="auth-panel">
        <div className="auth-box">
          <span className="eyebrow">WELCOME TO THE STUDIO</span>
          <h2>Your next shoot starts here.</h2>
          <p>
            Sign in to manage image generations, credits, assets, and
            subscriptions.
          </p>
          <GoogleSignIn />
          <p>
            By continuing, you agree to our{" "}
            <Link href="/terms">
              <u>Terms</u>
            </Link>{" "}
            and{" "}
            <Link href="/privacy">
              <u>Privacy Policy</u>
            </Link>
            . Firebase Google authentication must be configured.
          </p>
          <Link className="text-link" href="/">
            Back to website ↗
          </Link>
        </div>
      </section>
    </main>
  );
}
