"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { ArrowRight, Aperture, ShieldCheck } from "lucide-react";
export default function Login() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="login">
      <section className="login-story">
        <img src="/logo.png" alt="CAMNOVA Rentals" />
        <div>
          <span className="eyebrow">THE RENTAL WORKSPACE</span>
          <h1>
            Less admin.
            <br />
            More action.
          </h1>
          <p>Keep your bookings, equipment and collections in focus.</p>
        </div>
        <div className="lens-art">
          <Aperture size={260} strokeWidth={0.7} />
        </div>
        <small>Built for the people behind the frame.</small>
      </section>
      <section className="login-form">
        <div>
          <span className="eyebrow">WELCOME BACK</span>
          <h2>
            Your next shoot
            <br />
            starts here.
          </h2>
          <p className="muted">Sign in to your CAMNOVA workspace.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const f = new FormData(e.currentTarget);
              try {
                const r = await signIn("credentials", {
                  email: f.get("email"),
                  password: f.get("password"),
                  redirect: false,
                });
                if (r?.ok) window.location.href = "/workspace";
                else
                  setError(
                    "Unable to sign in. Check your details or try again in 15 minutes.",
                  );
              } catch {
                setError("Unable to connect. Try again.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="username"
                placeholder="you@camnova.com"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="secure">
            <ShieldCheck size={15} />
            Private workspace · Authorized staff only
          </div>
          <p>
            <a href="/rentals">Customer? Browse equipment and rental dates</a>
          </p>
        </div>
      </section>
    </main>
  );
}
