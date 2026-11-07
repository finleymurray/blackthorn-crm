import Link from "next/link";
import { Ghost } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-10">
      <EmptyState
        icon={Ghost}
        title="Nothing here"
        description="The record you were looking for does not exist or has been removed."
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href="/">Back to the dashboard</Link>
          </Button>
        }
      />
    </div>
  );
}
