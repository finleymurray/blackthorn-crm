"use client";

import * as React from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { simulateInboundEmail } from "@/app/(app)/support/actions";

export function SimulateInboundButton({ label }: { label?: string }) {
  const [pending, start] = React.useTransition();
  const { toast } = useToast();
  const run = () =>
    start(async () => {
      const r = await simulateInboundEmail();
      if (r && !r.ok) toast({ kind: "error", title: "Could not simulate", description: r.error });
    });
  if (label) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={run} loading={pending}>
        <Zap /> {label}
      </Button>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" onClick={run} loading={pending} aria-label="Simulate an inbound email">
          <Zap />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Simulate an inbound email from a guest</TooltipContent>
    </Tooltip>
  );
}
