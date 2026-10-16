import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clock3,
  Image as ImageIcon,
  ShieldCheck,
  Sparkles,
  Upload,
  WandSparkles,
  Download,
  Layers3,
  Zap,
} from "lucide-react";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
const photos = [
  ["Cosmetics", "photo-1596462502278-27bfdc403348"],
  ["Jewelry", "photo-1611652022419-a9419f74343d"],
  ["Perfumes", "photo-1541643600914-78b084683601"],
  ["Skincare", "photo-1608248543803-ba4f8c70ae0b"],
  ["Accessories", "photo-1584917865442-de89df76afd3"],
];
const styles = [
  ["Minimal", "photo-1601049541289-9b1b7bbbfe19"],
  ["Luxury", "photo-1523275335684-37898b6baf30"],
  ["Natural", "photo-1608248543803-ba4f8c70ae0b"],
  ["Lifestyle", "photo-1541643600914-78b084683601"],
  ["Editorial", "photo-1586495777744-4413f21062fa"],
  ["Festive", "photo-1611652022419-a9419f74343d"],
];
const url = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=82`;
export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">AI PRODUCT PHOTOGRAPHY STUDIO</span>
            <h1>
              Stunning Product Photos <em>in One Click.</em>
            </h1>
            <p>
              Create premium product imagery for cosmetics, jewelry, perfumes,
              and more. Make every product look ready for its close-up—without
              booking a studio or coordinating a production day.
            </p>
            <div className="hero-actions">
              <Link className="button dark" href="/studio">
                Create your first shoot <ArrowRight size={15} />
              </Link>
              <span>
                <ShieldCheck size={15} /> Start with a free account
              </span>
            </div>
            <div className="hero-stats">
              {[
                [ImageIcon, "Studio-quality", "visuals"],
                [Sparkles, "100+ styles", "to explore"],
                [Clock3, "Faster creative", "turnaround"],
                [Check, "More time", "to create"],
              ].map(([Icon, title, sub]: any) => (
                <div key={title}>
                  <span>
                    <Icon size={17} />
                  </span>
                  <strong>{title}</strong>
                  <small>{sub}</small>
                </div>
              ))}
            </div>
          </div>
          <div
            className="hero-art"
            style={{
              backgroundImage: `url(${url("photo-1594035910387-fea47794261f")})`,
            }}
          >
            <span className="scribble">
              Turn your
              <br />
              product
              <br />
              <em>into art.</em> ↗
            </span>
            <span className="art-caption">THE ART OF THE EVERYDAY · 01/06</span>
          </div>
        </section>
        <section className="section dark-section">
          <div className="section-heading">
            <span className="eyebrow">MADE FOR MODERN BRANDS</span>
            <h2>
              Premium visuals for <em>every product.</em>
            </h2>
            <p>
              From product pages to paid ads, build a consistent visual world
              around what you sell.
            </p>
          </div>
          <div className="category-grid">
            {photos.map(([name, id]) => (
              <Link href="/studio" className="category" key={name}>
                <img
                  src={url(id)}
                  alt={`${name} product photography`}
                  loading="lazy"
                />
                <span>{name} ↗</span>
              </Link>
            ))}
          </div>
        </section>
        <section className="section">
          <div className="section-heading">
            <span className="eyebrow">SIMPLE. FAST. POWERFUL.</span>
            <h2>
              From product photo to <em>campaign-ready.</em>
            </h2>
            <p>
              A practical workflow for founders, e-commerce teams, and creative
              studios.
            </p>
          </div>
          <div className="steps">
            {[
              [
                Upload,
                "01",
                "Upload your product",
                "Start with a clean photo from your phone or camera.",
              ],
              [
                WandSparkles,
                "02",
                "Choose your direction",
                "Describe the mood, scene, and lighting you want.",
              ],
              [
                Download,
                "03",
                "Generate & export",
                "Review the result and download when ready.",
              ],
            ].map(([Icon, n, title, desc]: any) => (
              <article className="step" key={n}>
                <span className="number">{n}</span>
                <Icon size={24} />
                <h3>{title}</h3>
                <p>{desc}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="before-after">
          <div
            className="ba-image"
            style={{
              backgroundImage: `url(${url("photo-1541643600914-78b084683601")})`,
            }}
          >
            <span>PRODUCT INPUT</span>
          </div>
          <div
            className="ba-image"
            style={{
              backgroundImage: `url(${url("photo-1594035910387-fea47794261f")})`,
            }}
          >
            <span>ART-DIRECTED SCENE</span>
          </div>
          <div className="ba-copy">
            <span className="eyebrow">A MORE CREATIVE WORKFLOW</span>
            <h2>
              Studio quality <em>without the studio.</em>
            </h2>
            <p>
              Explore product scenes without coordinating a full production day.
              Refine your direction and iterate on the visual story.
            </p>
            <ul>
              {[
                "Studio, lifestyle, catalog, and social modes",
                "Product-focused compositions",
                "Plan-aware usage and credit controls",
                "Secure, account-owned asset library",
              ].map((x) => (
                <li key={x}>
                  <Check size={15} />
                  {x}
                </li>
              ))}
            </ul>
            <Link className="text-link" href="/features">
              Explore features →
            </Link>
          </div>
        </section>
        <section className="section">
          <div className="section-heading">
            <span className="eyebrow">YOUR BRAND, YOUR MOOD</span>
            <h2>
              Endless creative <em>possibilities.</em>
            </h2>
            <p>
              Choose a style as a starting point, then tailor the prompt to your
              product.
            </p>
          </div>
          <div className="style-grid">
            {styles.map(([name, id], i) => (
              <Link href="/studio" className="style-card" key={name}>
                <img
                  src={url(id)}
                  alt={`${name} photography style`}
                  loading="lazy"
                />
                <span>0{i + 1}</span>
                <strong>{name}</strong>
              </Link>
            ))}
          </div>
        </section>
        <section className="benefits">
          {[
            [Layers3, "No studio required"],
            [Sparkles, "Multiple creative modes"],
            [ImageIcon, "Preview every result"],
            [ShieldCheck, "Server-enforced plans"],
            [Zap, "A faster creative loop"],
          ].map(([Icon, label]: any) => (
            <div key={label}>
              <Icon size={22} />
              <span>{label}</span>
            </div>
          ))}
        </section>
        <section className="section">
          <div className="section-heading">
            <span className="eyebrow">BUILT FOR THE WORK</span>
            <h2>
              More time making. <em>Less time coordinating.</em>
            </h2>
            <p>
              Designed for small teams that want to explore more creative
              directions.
            </p>
          </div>
          <div className="review-grid">
            {[
              "A clearer way to explore visual directions for our next product launch.",
              "We can test more scenes without coordinating a new production day.",
              "Keeping creative experiments in one workspace makes iteration simpler.",
            ].map((q, i) => (
              <article className="review" key={q}>
                <span>★★★★★</span>
                <blockquote>“{q}”</blockquote>
                <small>
                  Illustrative sample quote {i + 1} — replace with a verified
                  customer testimonial.
                </small>
              </article>
            ))}
          </div>
        </section>
        <section className="pricing-teaser">
          <div className="section-heading">
            <span className="eyebrow">CLEAR PLANS. VISIBLE LIMITS.</span>
            <h2>
              Choose your creative <em>capacity.</em>
            </h2>
            <p>
              AI credits, export allowances, and resolution entitlements are
              separate resources.
            </p>
          </div>
          <div className="teaser-grid">
            {[
              ["Free", "₹0", "0 AI credits · 100 exports"],
              ["Pro", "₹999", "8,000 credits · 1,000 exports"],
              ["Max", "₹2,799", "25,000 credits · 3,000 exports"],
              ["Ultra", "₹7,999", "75,000 credits · 10,000 exports"],
            ].map(([n, p, d]) => (
              <article key={n}>
                <strong>{n}</strong>
                <h3>
                  {p}
                  <small>/ month</small>
                </h3>
                <p>{d}</p>
                <Link href="/pricing">View plan →</Link>
              </article>
            ))}
          </div>
          <p className="fine-print">
            Ultra’s 4K entitlement depends on verified model/upscaling support.
            Pricing in INR; applicable taxes may apply.
          </p>
        </section>
        <section className="final-cta">
          <div>
            <span className="eyebrow">
              YOUR NEXT GREAT CREATIVE STARTS HERE
            </span>
            <h2>
              Give your products the <em>spotlight they deserve.</em>
            </h2>
            <p>
              Start with an account, explore the workspace, and connect your AI
              provider when ready.
            </p>
          </div>
          <Link className="button light" href="/studio">
            Open TheStudioShot <ArrowRight size={15} />
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
