"use client";

import * as React from "react";
import { Clipboard, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

function copyTextViaExecCommand(text: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "0";
  ta.style.left = "0";
  ta.style.width = "2px";
  ta.style.height = "2px";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

export type CopyableConsoleProps = {
  /** Log or payload text; when empty, `emptyPlaceholder` is shown but not treated as copyable content. */
  text: string;
  emptyPlaceholder: string;
  downloadBasename: string;
  ariaLabel: string;
  title?: string;
  className?: string;
  textareaClassName?: string;
  onNotify?: (message: string) => void;
  /** Extra controls (e.g. Clear) rendered after Copy / Select all / .txt */
  headerEnd?: React.ReactNode;
  "data-testid"?: string;
  textareaTestId?: string;
};

export function CopyableConsole({
  text,
  emptyPlaceholder,
  downloadBasename,
  ariaLabel,
  title,
  className,
  textareaClassName,
  onNotify,
  headerEnd,
  "data-testid": testId,
  textareaTestId,
}: CopyableConsoleProps) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const trimmed = text.trim();
  const hasPayload = trimmed.length > 0;
  const displayValue = hasPayload ? text : emptyPlaceholder;

  async function copyConsole() {
    if (!hasPayload) {
      onNotify?.("Console is empty — nothing to copy.");
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(trimmed);
        onNotify?.("Copied console to clipboard.");
        return;
      } catch {
        /* fall through */
      }
    }
    if (copyTextViaExecCommand(trimmed)) {
      onNotify?.("Copied console to clipboard.");
      return;
    }
    const el = ref.current;
    if (el) {
      el.focus();
      el.select();
      onNotify?.("Press Cmd/Ctrl+C now (console is selected).");
    } else {
      onNotify?.("Copy failed — use Select all, then Cmd/Ctrl+C.");
    }
  }

  function selectAllConsole() {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }

  function downloadConsole() {
    if (!hasPayload) {
      onNotify?.("Console is empty — nothing to download.");
      return;
    }
    const blob = new Blob([trimmed], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${downloadBasename}-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onNotify?.("Downloaded console as .txt (check your Downloads folder).");
  }

  return (
    <div className={cn("rounded-lg border border-zinc-800 bg-zinc-950 p-3", className)} data-testid={testId}>
      <div
        className={cn(
          "mb-2 flex flex-wrap items-center gap-2",
          title ? "justify-between" : "justify-end",
        )}
      >
        {title ? (
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">{title}</div>
        ) : null}
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            leftIcon={<Clipboard className="h-3.5 w-3.5" />}
            onClick={() => void copyConsole()}
          >
            Copy
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={selectAllConsole}>
            Select all
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            leftIcon={<Download className="h-3.5 w-3.5" />}
            onClick={downloadConsole}
          >
            .txt
          </Button>
          {headerEnd}
        </div>
      </div>
      <textarea
        ref={ref}
        readOnly
        spellCheck={false}
        aria-label={ariaLabel}
        data-testid={textareaTestId}
        className={cn(
          "h-56 w-full cursor-text resize-none overflow-auto whitespace-pre-wrap border-0 bg-zinc-900/80 p-2 font-mono text-[11px] leading-5 text-zinc-400 outline-none ring-1 ring-inset ring-zinc-800 focus:ring-emerald-500/50",
          textareaClassName,
        )}
        value={displayValue}
      />
    </div>
  );
}
