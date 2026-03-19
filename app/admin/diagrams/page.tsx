"use client";

import { useState, useEffect, useRef } from "react";
import DiagramEditor from "./components/DiagramEditor";

const MAX_ATTEMPTS = 5;
const COOLDOWN_SECONDS = 30;

export default function DiagramsAdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem("admin-authed") === "true") {
      setAuthed(true);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startCooldown() {
    setCooldownRemaining(COOLDOWN_SECONDS);
    timerRef.current = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setFailCount(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cooldownRemaining > 0) return;
    if (password === process.env.NEXT_PUBLIC_ADMIN_KEY) {
      sessionStorage.setItem("admin-authed", "true");
      setAuthed(true);
    } else {
      const newCount = failCount + 1;
      setFailCount(newCount);
      setError(true);
      if (newCount >= MAX_ATTEMPTS) {
        startCooldown();
      }
    }
  }

  if (authed) {
    return <DiagramEditor />;
  }

  const locked = cooldownRemaining > 0;

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col items-center gap-4"
      >
        <h1 className="text-lg font-medium text-foreground">Admin Access</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(false);
          }}
          placeholder="Enter password"
          autoFocus
          disabled={locked}
          className="h-10 w-64 rounded-md border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
        {locked ? (
          <p className="text-sm text-destructive">
            Too many attempts. Try again in {cooldownRemaining}s.
          </p>
        ) : (
          error && (
            <p className="text-sm text-destructive">
              Incorrect password
              {failCount >= 2 && failCount < MAX_ATTEMPTS
                ? ` (${MAX_ATTEMPTS - failCount} attempt${MAX_ATTEMPTS - failCount === 1 ? "" : "s"} remaining)`
                : ""}
            </p>
          )
        )}
        <button
          type="submit"
          disabled={locked}
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Enter
        </button>
      </form>
    </div>
  );
}
