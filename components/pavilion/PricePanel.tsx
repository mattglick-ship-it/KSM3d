"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadPricing } from "@/lib/pricing/store";
import { computeQuote, selectionFromConfig, fmtUSD } from "@/lib/pricing/engine";
import type { PavilionConfig } from "@/lib/pavilion-config";
import { AlertTriangle } from "lucide-react";

export function PricePanel({
  config,
  embedded = false,
  beamStained = false,
  deckStained = false,
  hideSize = false,
  totalOnly = false,
}: {
  config: PavilionConfig;
  embedded?: boolean;
  beamStained?: boolean;
  deckStained?: boolean;
  hideSize?: boolean;
  totalOnly?: boolean;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["pricing_data"],
    queryFn: loadPricing,
    staleTime: 60_000,
  });
  const [collapsed, setCollapsed] = useState(false);
  const open = true;

  const sel = useMemo(
    () => selectionFromConfig(config, { beamStained, deckStained }),
    [config, beamStained, deckStained],
  );
  const quote = useMemo(() => (data ? computeQuote(sel, data) : null), [sel, data]);




  if (!embedded && collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed bottom-4 right-4 z-40 rounded-full bg-primary text-primary-foreground px-4 py-2 shadow-lg text-sm font-semibold"
      >
        Show price
      </button>
    );
  }

  const containerClass = embedded
    ? "w-full"
    : "fixed bottom-4 right-4 z-40 w-[320px] max-w-[calc(100vw-2rem)] rounded-lg border bg-background/95 backdrop-blur shadow-xl";

  const headerClass = embedded ? "flex items-start justify-between gap-2" : "flex items-start justify-between gap-2 p-3 border-b";

  return (
    <div className={containerClass}>
      <div className={headerClass}>
        <div>
          {isLoading && <div className="text-2xl font-bold">…</div>}
          {error && <div className="text-sm text-destructive">Pricing unavailable</div>}
          {quote && (
            <div className="text-2xl font-bold tabular-nums whitespace-nowrap">
              {fmtUSD(quote.total)}
            </div>
          )}
          {quote?.size?.label && !hideSize && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {quote.size.label} · {sel.roof.replace("_", " ")}
            </div>
          )}
        </div>
        {!embedded && (
          <button
            onClick={() => setCollapsed(true)}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            Hide
          </button>
        )}
      </div>


      {quote && !quote.size && (
        <div className={`${embedded ? "pt-3" : "p-3"} text-xs text-amber-600 flex gap-2 items-start`}>
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{quote.warning ?? "Size not in price list — contact us for a custom quote."}</span>
        </div>
      )}

      {quote && quote.status === "needs_review" && (
        <div className={`${embedded ? "mt-3 p-2 rounded" : "p-3 border-b"} text-xs text-amber-700 bg-amber-50 flex gap-2 items-start`}>
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>Pricing for this size is under review — contact us to confirm.</span>
        </div>
      )}

      {open && quote && quote.size && !totalOnly && (
        <div className={`${embedded ? "mt-3 pt-3 border-t" : "p-3 border-b"} space-y-1 text-xs max-h-60 overflow-y-auto`}>
          {quote.lines.map((l, i) => (
            <div key={i} className="flex justify-between gap-2">
              <span className="text-muted-foreground">{l.label}</span>
              <span className="tabular-nums font-medium">{fmtUSD(l.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between gap-2 pt-2 border-t mt-2 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">
              {fmtUSD(quote.total)}
              <span className="text-xs font-normal text-muted-foreground ml-1">+ tax</span>
            </span>
          </div>

        </div>
      )}

      {quote && quote.callForPricing.length > 0 && (
        <div className={`${embedded ? "mt-3 pt-3 border-t" : "p-3"} text-xs text-muted-foreground`}>
          *Estimated pricing
        </div>
      )}
    </div>
  );
}

