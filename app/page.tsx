import type { Metadata } from "next";
import {
  ArrowUpRight,
  ArrowRight,
  Instagram,
  Aperture,
  Camera,
  CalendarDays,
  CheckCircle2,
} from "lucide-react";
import "./landing.css";
export const metadata: Metadata = {
  title: "CAMNOVA Rentals — Your vision. Our gear.",
  description:
    "Bring your next shoot to life with CAMNOVA Rentals. Explore cameras, lenses and filmmaking equipment, check your dates and request your rental online.",
  robots: { index: true, follow: true },
};
const instagram = "https://www.instagram.com/camnovarentals/";
const categories = [
  {
    name: "Cameras",
    line: "Make every frame count.",
    image: "cam.webp",
    number: "01",
  },
  {
    name: "Lenses",
    line: "A new perspective changes everything.",
    image: "g24.webp",
    number: "02",
  },
  {
    name: "Gimbals & more",
    line: "Keep your story moving.",
    image: "rs5.webp",
    number: "03",
  },
];
export default function Home() {
  return (
    <div className="cn-home">
      <a className="cn-skip" href="#main">
        Skip to content
      </a>
      <header className="cn-nav">
        <a href="/" aria-label="CAMNOVA Rentals home">
          <img
            src="/storefront/wordmark-white.png"
            alt="CAMNOVA Rentals"
            width="190"
            height="60"
          />
        </a>
        <nav aria-label="Main navigation">
          <a href="#idea">The idea</a>
          <a href="#gear">Our gear</a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <a className="cn-button" href="/rentals">
          Book now <ArrowUpRight size={18} />
        </a>
      </header>
      <main id="main">
        <section className="cn-hero" aria-labelledby="hero-title">
          <div className="cn-hero-copy">
            <p className="cn-kicker">
              <span /> FOR THE PEOPLE BEHIND THE FRAME
            </p>
            <h1 id="hero-title">
              BIG IDEAS.
              <br />
              RIGHT GEAR.
              <br />
              <em>YOUR STORY.</em>
            </h1>
            <p className="cn-intro">
              From the first spark to the final shot. Rent the equipment you
              need to bring your vision to life with CAMNOVA.
            </p>
            <div className="cn-hero-actions">
              <a className="cn-button" href="/rentals">
                Book now <ArrowUpRight size={20} />
              </a>
              <a className="cn-text-link" href="#idea">
                Meet CAMNOVA <ArrowRight size={18} />
              </a>
            </div>
            <p className="cn-hero-foot">
              Photography · Films · Content · Your next big thing
            </p>
          </div>
          <div className="cn-hero-visual">
            <div className="cn-disc" aria-hidden="true" />
            <span className="cn-frame cn-frame-top" aria-hidden="true" />
            <span className="cn-frame cn-frame-bottom" aria-hidden="true" />
            <span className="cn-visual-label">FOCUS ON WHAT YOU CREATE.</span>
            <img
              className="cn-main-camera"
              src="/storefront/cam.webp"
              alt="Sony mirrorless camera body"
              width="700"
              height="650"
              fetchPriority="high"
            />
            <div className="cn-visual-caption">
              <Aperture size={29} />
              <span>
                YOUR VISION.
                <br />
                <strong>OUR GEAR.</strong>
              </span>
            </div>
            <span className="cn-coordinate" aria-hidden="true">
              CAMNOVA / RENTALS / 001
            </span>
          </div>
        </section>
        <div className="cn-strip" aria-hidden="true">
          <span>LESS LIMITS.</span>
          <Aperture />
          <span>MORE POSSIBILITIES.</span>
          <Aperture />
          <span>LET’S CREATE.</span>
          <Aperture />
        </div>
        <section id="idea" className="cn-idea cn-section">
          <div>
            <p className="cn-kicker">01 / THE CAMNOVA IDEA</p>
            <h2>
              THE IDEA IS YOURS.
              <br />
              THE POSSIBILITIES
              <br />
              <em>ARE SHARED.</em>
            </h2>
          </div>
          <div className="cn-idea-copy">
            <p className="cn-lead">
              Great stories begin with a different way of seeing.
            </p>
            <p>
              CAMNOVA is about putting creative possibilities within reach. A
              camera to capture it. A lens to see it differently. The right
              tools to turn “what if” into your next shoot.
            </p>
            <p>
              We’re here for photographers, filmmakers and content creators.
              Whether it’s a personal project, a brand film or a moment worth
              keeping, choose the gear for your idea — and make it your own.
            </p>
            <a className="cn-text-link" href="/rentals">
              Find your next setup <ArrowUpRight size={18} />
            </a>
          </div>
        </section>
        <section id="gear" className="cn-gear cn-section">
          <div className="cn-section-heading">
            <div>
              <p className="cn-kicker">02 / TOOLS FOR YOUR VISION</p>
              <h2>
                BUILD YOUR
                <br />
                <em>NEXT SHOT.</em>
              </h2>
            </div>
            <a className="cn-text-link" href="/rentals">
              Explore the store <ArrowUpRight size={18} />
            </a>
          </div>
          <div className="cn-gear-grid">
            {categories.map((c) => (
              <a className="cn-gear-card" href="/rentals" key={c.name}>
                <div className="cn-card-top">
                  <span>{c.number} / RENTAL GEAR</span>
                  <ArrowUpRight size={22} />
                </div>
                <img
                  src={`/storefront/${c.image}`}
                  alt={`${c.name} rental equipment`}
                  width="400"
                  height="340"
                  loading="lazy"
                />
                <div>
                  <h3>{c.name}</h3>
                  <p>{c.line}</p>
                </div>
              </a>
            ))}
          </div>
          <p className="cn-gear-note">
            Explore the store for our current equipment, rates and availability
            for your dates.
          </p>
        </section>
        <section id="how-it-works" className="cn-how cn-section">
          <div className="cn-section-heading">
            <div>
              <p className="cn-kicker">03 / FROM IDEA TO ACTION</p>
              <h2>
                YOUR NEXT SHOOT.
                <br />
                <em>THREE SIMPLE STEPS.</em>
              </h2>
            </div>
          </div>
          <div className="cn-steps">
            {[
              {
                icon: CalendarDays,
                title: "Pick your dates.",
                text: "Head to the store and check which equipment is available for your shoot.",
              },
              {
                icon: Camera,
                title: "Build your setup.",
                text: "Add your gear to the cart, sign in or create an account, and send your rental request.",
              },
              {
                icon: CheckCircle2,
                title: "Let’s make it happen.",
                text: "Our team reviews your request and confirms your booking. Follow its status in your customer account.",
              },
            ].map((step, i) => (
              <article key={step.title}>
                <div className="cn-step-icon">
                  <step.icon size={26} />
                  <span>0{i + 1}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
          <p className="cn-how-note">
            A request becomes a reservation once our team confirms it.
          </p>
        </section>
        <section className="cn-social cn-section">
          <div>
            <p className="cn-kicker">STAY IN THE FRAME</p>
            <h2>
              THE STORY
              <br />
              <em>KEEPS GOING.</em>
            </h2>
            <p>
              Follow CAMNOVA Rentals for our gear, creative inspiration and the
              next chapter.
            </p>
            <a
              className="cn-text-link"
              href={instagram}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Instagram size={20} /> @camnovarentals <ArrowUpRight size={18} />
            </a>
          </div>
          <div className="cn-social-mark" aria-hidden="true">
            <Aperture strokeWidth={0.8} />
            <span>
              SEE IT.
              <br />
              FRAME IT.
              <br />
              CREATE IT.
            </span>
          </div>
        </section>
        <section className="cn-final">
          <p className="cn-kicker">THE NEXT FRAME IS YOURS.</p>
          <h2>
            GOT A VISION?
            <br />
            LET’S <em>SHOOT.</em>
          </h2>
          <a className="cn-button cn-button-white" href="/rentals">
            Book now <ArrowUpRight size={22} />
          </a>
        </section>
      </main>
      <footer className="cn-footer">
        <a href="/" aria-label="CAMNOVA Rentals home">
          <img
            src="/storefront/wordmark-white.png"
            alt="CAMNOVA Rentals"
            width="150"
            height="48"
          />
        </a>
        <p>Your vision. Our gear.</p>
        <nav aria-label="Footer navigation">
          <a href="/rentals">Store</a>
          <a href={instagram} target="_blank" rel="noopener noreferrer">
            Instagram <ArrowUpRight size={13} />
          </a>
          <a href="/login">Staff login</a>
        </nav>
      </footer>
    </div>
  );
}
