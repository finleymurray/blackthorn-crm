"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-10">
      <ErrorState
        title="This page could not be loaded"
        description={
          error.message?.includes("DATABASE_URL")
            ? "The database connection is not configured. Check DATABASE_URL in your environment."
            : "An unexpected error occurred. Try again, and if it keeps happening let the admin know."
        }
        action={
          <Button variant="secondary" size="sm" onClick={reset}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
