import { Accessibility, Ban, HandMetal } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function GuestFlags({
  guest,
  size = "sm",
}: {
  guest: { accessibility_needs: string | null; do_not_touch: boolean; banned: boolean; tags?: string[] };
  size?: "sm" | "md";
}) {
  const items: React.ReactNode[] = [];
  if (guest.banned)
    items.push(
      <Badge key="banned" variant="danger">
        <Ban className="size-3" aria-hidden /> Banned
      </Badge>,
    );
  if (guest.accessibility_needs)
    items.push(
      <Badge key="access" variant="info">
        <Accessibility className="size-3" aria-hidden /> Accessibility
      </Badge>,
    );
  if (guest.do_not_touch)
    items.push(
      <Badge key="dnt" variant="warning">
        <HandMetal className="size-3" aria-hidden /> Do not touch
      </Badge>,
    );
  if (size === "md" && guest.tags) {
    for (const t of guest.tags) items.push(<Badge key={`tag-${t}`}>{t}</Badge>);
  }
  if (items.length === 0) return null;
  return <div className={`flex flex-wrap gap-1 ${size === "sm" ? "mt-1" : ""}`}>{items}</div>;
}
