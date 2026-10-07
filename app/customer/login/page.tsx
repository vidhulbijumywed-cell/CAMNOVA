"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import "../../customer-portal.css";
export default function CustomerLogin() {
  const [register, setRegister] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="portal portal-auth">
      <a href="/rentals">
        <img src="/logo.png" alt="CAMNOVA Rentals" />
      </a>
      <div className="portal-auth-card">
        <span className="portal-eyebrow">YOUR NEXT SHOOT STARTS HERE</span>
        <h1>{register ? "Create your customer account" : "Welcome back"}</h1>
        <p>
          Check availability, choose your gear and keep track of your rental
          requests.
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            const form = new FormData(event.currentTarget);
            const email = String(form.get("email")),
              password = String(form.get("password"));
            try {
              if (register) {
                const response = await fetch("/api/customer/register", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    email,
                    password,
                    name: form.get("name"),
                    phone: form.get("phone"),
                  }),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
              }
              const result = await signIn("customer", {
                email,
                password,
                redirect: false,
              });
              if (!result?.ok)
                throw new Error(
                  "Unable to sign in. Check your details or try again in 15 minutes.",
                );
              window.location.href = "/rentals";
            } catch (error) {
              setError(
                error instanceof Error ? error.message : "Unable to connect",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {register && (
            <>
              <label>
                Full name
                <input
                  name="name"
                  required
                  maxLength={100}
                  autoComplete="name"
                />
              </label>
              <label>
                Phone or WhatsApp
                <input
                  name="phone"
                  type="tel"
                  required
                  maxLength={25}
                  autoComplete="tel"
                />
              </label>
            </>
          )}
          <label>
            Email address
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="username"
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              required
              minLength={register ? 12 : undefined}
              maxLength={128}
              autoComplete={register ? "new-password" : "current-password"}
            />
          </label>
          {register && (
            <small>
              Use at least 12 characters. Keep your password in a password
              manager.
            </small>
          )}
          {error && (
            <p className="portal-error" role="alert">
              {error}
            </p>
          )}
          <button className="portal-button" disabled={busy}>
            {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
          </button>
        </form>
        <button
          className="portal-link"
          onClick={() => {
            setRegister(!register);
            setError("");
          }}
          disabled={busy}
        >
          {register
            ? "Already have an account? Sign in"
            : "New here? Create an account"}
        </button>
        <a href="/rentals">Back to the catalogue</a>
      </div>
    </main>
  );
}
