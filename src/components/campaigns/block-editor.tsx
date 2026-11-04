"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Heading, Image as ImageIcon, Minus, MousePointerClick, Plus, Text, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { EmailBlock } from "@/lib/messaging/email-blocks";
import { MERGE_FIELDS } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";

const BLOCK_META = {
  heading: { label: "Heading", icon: Heading },
  text: { label: "Text", icon: Text },
  image: { label: "Image", icon: ImageIcon },
  button: { label: "Button", icon: MousePointerClick },
  divider: { label: "Divider", icon: Minus },
} as const;

function newId() {
  return Math.random().toString(36).slice(2, 9);
}

export function newBlock(type: EmailBlock["type"]): EmailBlock {
  const id = newId();
  switch (type) {
    case "heading":
      return { id, type, text: "Heading" };
    case "text":
      return { id, type, text: "Hi {{first_name}},\n\n" };
    case "image":
      return { id, type, src: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=1200", alt: "Describe the image" };
    case "button":
      return { id, type, text: "Book now", href: "https://blackthornscreampark.co.uk/tickets" };
    case "divider":
      return { id, type };
  }
}

export function MergeFieldMenu({ onInsert, disabled }: { onInsert: (token: string) => void; disabled?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} className="text-muted">
          <Plus /> Merge field
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
        {MERGE_FIELDS.map((f) => (
          <DropdownMenuItem key={f.key} onSelect={() => onInsert(`{{${f.key}}}`)}>
            <span className="flex-1">{f.label}</span>
            <span className="text-[11px] text-muted">{`{{${f.key}}}`}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Inserts a token at the caret of a textarea or input, falling back to appending. */
export function insertAtCaret(el: HTMLTextAreaElement | HTMLInputElement | null, value: string, token: string): string {
  if (!el) return value + token;
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  return value.slice(0, start) + token + value.slice(end);
}

export function BlockEditor({ blocks, onChange, readOnly }: { blocks: EmailBlock[]; onChange: (b: EmailBlock[]) => void; readOnly?: boolean }) {
  const refs = React.useRef<Record<string, HTMLTextAreaElement | HTMLInputElement | null>>({});
  const update = (id: string, patch: Partial<EmailBlock>) => onChange(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as EmailBlock) : b)));
  const remove = (id: string) => onChange(blocks.filter((b) => b.id !== id));
  const move = (index: number, dir: -1 | 1) => {
    const next = [...blocks];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {blocks.length === 0 ? <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-xs text-muted">Add a heading, some text and a button to get started.</p> : null}
      {blocks.map((b, i) => {
        const meta = BLOCK_META[b.type];
        const Icon = meta.icon;
        return (
          <div key={b.id} className="group rounded-md border border-border bg-black/20">
            <div className="flex items-center gap-2 border-b border-border px-2.5 py-1">
              <Icon className="size-3.5 text-muted" aria-hidden />
              <span className="text-[11px] font-medium text-muted">{meta.label}</span>
              {!readOnly ? (
                <div className="ml-auto flex items-center gap-0.5 opacity-60 group-focus-within:opacity-100 group-hover:opacity-100">
                  {(b.type === "heading" || b.type === "text" || b.type === "button") && (
                    <MergeFieldMenu onInsert={(token) => update(b.id, { text: insertAtCaret(refs.current[b.id] ?? null, b.text, token) } as Partial<EmailBlock>)} />
                  )}
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move block up">
                    <ArrowUp />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} aria-label="Move block down">
                    <ArrowDown />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(b.id)} aria-label="Remove block" className="text-muted hover:text-danger">
                    <Trash2 />
                  </Button>
                </div>
              ) : null}
            </div>
            <div className={cn("p-2.5", b.type === "divider" && "py-2")}>
              {b.type === "heading" ? (
                <Input
                  ref={(el) => {
                    refs.current[b.id] = el;
                  }}
                  aria-label="Heading text"
                  value={b.text}
                  onChange={(e) => update(b.id, { text: e.target.value })}
                  className="h-9 text-[15px] font-medium"
                  maxLength={200}
                  readOnly={readOnly}
                />
              ) : b.type === "text" ? (
                <Textarea
                  ref={(el) => {
                    refs.current[b.id] = el;
                  }}
                  aria-label="Paragraph text"
                  value={b.text}
                  onChange={(e) => update(b.id, { text: e.target.value })}
                  rows={Math.min(12, Math.max(3, b.text.split("\n").length + 1))}
                  maxLength={5000}
                  readOnly={readOnly}
                />
              ) : b.type === "image" ? (
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
                  <label className="space-y-1 text-[11px] text-muted">
                    Image URL
                    <Input value={b.src} onChange={(e) => update(b.id, { src: e.target.value })} placeholder="https://…" maxLength={1000} readOnly={readOnly} />
                  </label>
                  <label className="space-y-1 text-[11px] text-muted">
                    Alt text (read by screen readers)
                    <Input value={b.alt} onChange={(e) => update(b.id, { alt: e.target.value })} maxLength={200} readOnly={readOnly} />
                  </label>
                </div>
              ) : b.type === "button" ? (
                <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr]">
                  <label className="space-y-1 text-[11px] text-muted">
                    Button label
                    <Input
                      ref={(el) => {
                        refs.current[b.id] = el;
                      }}
                      value={b.text}
                      onChange={(e) => update(b.id, { text: e.target.value })}
                      maxLength={100}
                      readOnly={readOnly}
                    />
                  </label>
                  <label className="space-y-1 text-[11px] text-muted">
                    Link
                    <Input value={b.href} onChange={(e) => update(b.id, { href: e.target.value })} placeholder="https://…" maxLength={1000} readOnly={readOnly} />
                  </label>
                </div>
              ) : (
                <div className="h-px w-full bg-border-strong" aria-hidden />
              )}
            </div>
          </div>
        );
      })}
      {!readOnly ? (
        <div className="flex flex-wrap gap-1 pt-1">
          {(Object.keys(BLOCK_META) as Array<EmailBlock["type"]>).map((t) => {
            const Icon = BLOCK_META[t].icon;
            return (
              <Button key={t} type="button" variant="secondary" size="sm" onClick={() => onChange([...blocks, newBlock(t)])}>
                <Icon /> {BLOCK_META[t].label}
              </Button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
