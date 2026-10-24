"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#f7f3ec",
          color: "#241f2b",
          fontFamily: "Georgia, serif",
          display: "grid",
          placeItems: "center",
          padding: "2rem",
        }}
      >
        <style>
          {`@media (prefers-color-scheme: dark) {
            body { background: #121212 !important; color: #f6f3ee !important; }
            button { background: #efe6ff !important; color: #24182f !important; }
          }`}
        </style>
        <main style={{ maxWidth: "36rem" }}>
          <h1 style={{ fontSize: "2.5rem", fontWeight: 500, marginBottom: "0.75rem" }}>awarely.ai needs a refresh</h1>
          <p style={{ lineHeight: 1.6, marginBottom: "1.5rem" }}>
            This page ran into a problem. Trying again may restore it. If you stored entries on this device, they are
            not deleted by this screen.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              minHeight: "2.75rem",
              border: 0,
              borderRadius: "999px",
              background: "#3f345c",
              color: "#fbf8f4",
              padding: "0.5rem 1.25rem",
              font: "inherit",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
