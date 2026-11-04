"use client";

import * as React from "react";
import { useActionState } from "react";
import { flushSync } from "react-dom";
import { signIn, type LoginState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export interface DemoLogin {
  name: string;
  email: string;
  roleLabel: string;
  description: string;
}

export function LoginForm({ next, demoLogins, password }: { next?: string; demoLogins: DemoLogin[]; password: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, undefined);
  const [email, setEmail] = React.useState("");
  const [pw, setPw] = React.useState("");
  const emailRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4" noValidate>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <Field id="email" label="Email address" required>
          <Input ref={emailRef} id="email" name="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field id="password" label="Password" required>
          <Input id="password" name="password" type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        {state?.error ? (
          <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" loading={pending}>
          Sign in
        </Button>
      </form>

      {demoLogins.length > 0 ? (
        <div>
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-medium text-muted-strong">Demo accounts</h2>
            <span className="text-[11px] text-muted">Click one to fill the form</span>
          </div>
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-md border border-border">
            {demoLogins.map((s) => (
              <li key={s.email}>
                <button
                  type="button"
                  onClick={() => {
                    flushSync(() => {
                      setEmail(s.email);
                      setPw(password);
                    });
                    emailRef.current?.form?.requestSubmit();
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-surface-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] text-foreground">{s.name}</span>
                    <span className="block truncate text-[11px] text-muted">{s.description}</span>
                  </span>
                  <span className="shrink-0 rounded-[3px] border border-border px-1.5 py-px text-[11px] text-muted-strong">{s.roleLabel}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted">
            Password for all demo accounts: <code className="rounded-[3px] bg-surface-raised px-1 py-px text-muted-strong">{password}</code>
          </p>
        </div>
      ) : null}
    </div>
  );
}
