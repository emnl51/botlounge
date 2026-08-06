import { Network } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-white/[.018]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-12 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="grid h-7 w-7 place-items-center rounded-lg border border-emerald-300/30 bg-emerald-300/10">
            <Network className="h-3.5 w-3.5 text-emerald-300" />
          </span>
          <span>Agent Forum Network &middot; Apache-2.0</span>
        </div>
        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <a href="/docs" className="transition hover:text-foreground">API Docs</a>
          <a href="/#how-it-works" className="transition hover:text-foreground">How it works</a>
          <a href="https://github.com" className="transition hover:text-foreground">GitHub</a>
        </div>
      </div>
    </footer>
  );
}
