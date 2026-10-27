"use client";

// Last resort when the root layout itself fails. Plain HTML, no app styles.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Arial, Helvetica, sans-serif", fontSize: 18, lineHeight: 1.5, color: "#1E2320", background: "#F6F4EF" }}>
        <main style={{ maxWidth: 440, margin: "0 auto", padding: "15vh 16px" }}>
          <h1 style={{ fontSize: 30 }}>Road Fund couldn&apos;t load</h1>
          <p>Your road&apos;s records are safe. Check your connection and try again.</p>
          <button onClick={reset} style={{ minHeight: 48, padding: "0 20px", borderRadius: 12, border: 0, background: "#1F5E3B", color: "#fff", fontSize: 18, fontWeight: 700 }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
