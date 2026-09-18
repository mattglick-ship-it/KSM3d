import { DEFAULT_SNOW_RATES, type SnowRates } from '@/lib/snow-retention';
import {ExpandedSizePricing} from './ExpandedSizePricing';
import { useEffect, useMemo, useRef, useState } from "react";
// xlsx imported dynamically inside handleFile to avoid SSR bundling issues
import { loadPricing, savePricing, SEED_DOC } from "@/lib/pricing/store";
import { parseWorkbook, mergeParseIntoDoc, type ParseWarning } from "@/lib/pricing/parse-xlsx";
import type { PricingDoc } from "@/lib/pricing/types";
import { fmtUSD } from "@/lib/pricing/engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export default function AdminPricingPage() {
  return <AdminPanel />;
}


function AdminPanel() {
  const [doc, setDoc] = useState<PricingDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [warnings, setWarnings] = useState<ParseWarning[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPricing()
      .then((d) => setDoc(d))
      .catch((e) => toast.error(`Load failed: ${e.message}`))
      .finally(() => setLoading(false));
  }, []);

  const openTodos = useMemo(() => computeOpenTodos(doc), [doc]);

  const persist = async (next: PricingDoc) => {
    setSaving(true);
    try {
      const withTodos: PricingDoc = { ...next, meta: { ...next.meta, openTodos: computeOpenTodos(next) } };
      await savePricing(withTodos);
      setDoc(withTodos);
      toast.success("Saved");
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleFile = async (file: File) => {
    if (!doc) return;
    setSaving(true);
    try {
      const {readWorkbook} = await import("@/lib/pricing/read-xlsx");
      const buf = await file.arrayBuffer();
      const wb = await readWorkbook(buf);
      const parsed = parseWorkbook(wb);
      const merged = mergeParseIntoDoc(doc, parsed);
      setWarnings(parsed.warnings);
      await persist(merged);
      toast.success(`Imported ${parsed.sizes.length} sizes · ${Object.keys(parsed.hammerAmounts).length} hammer deltas`);
    } catch (e) {
      toast.error(`Parse failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const resetToSeed = async () => {
    if (!confirm("Reset pricing data to bundled defaults? Manual upcharges will be lost.")) return;
    await persist(SEED_DOC);
  };

  if (loading || !doc) {
    return <div className="p-8 text-muted-foreground">Loading pricing…</div>;
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <Toaster position="top-right" />
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Pricing Admin</h1>
          <p className="text-xs text-muted-foreground">{doc.sizes.length} sizes · {doc.meta.currency}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetToSeed} disabled={saving}>Reset to defaults</Button>
        </div>

      </header>

      <main className="p-6 max-w-5xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload spreadsheet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Upload the pavilion pricing .xlsx. Sizes are replaced; hammer deltas are refreshed from
              "(HB)" tabs. Manually-entered upcharges are preserved.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="block text-sm"
            />
            {warnings.length > 0 && (
              <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
                <div className="font-semibold mb-1">Data warnings ({warnings.length}):</div>
                <ul className="list-disc ml-5 space-y-0.5">
                  {warnings.map((w, i) => (
                    <li key={i}><span className="font-mono">{w.sizeId}</span> — {w.message}</li>
                  ))}
                </ul>
              </div>
            )}
            {openTodos.length > 0 && (
              <div className="rounded border bg-muted/40 p-3 text-sm">
                <div className="font-semibold mb-1">Unpriced options ({openTodos.length}):</div>
                <ul className="list-disc ml-5 space-y-0.5">
                  {openTodos.map((t, i) => <li key={i} className="font-mono text-xs">{t}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <ExpandedSizePricing doc={doc} onSave={persist} saving={saving} />
        <ManualUpcharges doc={doc} onSave={persist} saving={saving} />

        <Card>
          <CardHeader>
            <CardTitle>Sizes ({doc.sizes.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left border-b">
                    <th className="p-2">ID</th>
                    <th className="p-2 text-right">Metal</th>
                    <th className="p-2 text-right">Std Seam</th>
                    <th className="p-2 text-right">Shingles</th>
                    <th className="p-2 text-right">Timber LF</th>
                    <th className="p-2 text-right">Posts</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.sizes.map((s) => (
                    <tr key={s.id} className={`border-b ${s.status === "needs_review" ? "bg-amber-50" : ""}`}>
                      <td className="p-2 font-mono">{s.id}</td>
                      <td className="p-2 text-right tabular-nums">{s.basePriceByRoof.metal != null ? fmtUSD(s.basePriceByRoof.metal) : "—"}</td>
                      <td className="p-2 text-right tabular-nums">{s.basePriceByRoof.standing_seam != null ? fmtUSD(s.basePriceByRoof.standing_seam) : "—"}</td>
                      <td className="p-2 text-right tabular-nums">{s.basePriceByRoof.shingles != null ? fmtUSD(s.basePriceByRoof.shingles) : "—"}</td>
                      <td className="p-2 text-right tabular-nums">{s.timberLinearFt}</td>
                      <td className="p-2 text-right tabular-nums">{s.posts}</td>
                      <td className="p-2">{s.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function computeOpenTodos(doc: PricingDoc | null): string[] {
  if (!doc) return [];
  const todos: string[] = [];
  const opts = doc.options;
  opts.height.choices.forEach((c, i) => {
    if (c.price.model === "flat" && c.price.amount == null) todos.push(`options.height.choices[${i}].price (${c.label})`);
  });
  opts.trussStyle.choices.forEach((c, i) => {
    if (c.price.model === "flat" && c.price.amount == null) todos.push(`options.trussStyle.choices[${i}].price (${c.label})`);
  });
  opts.rafterTail.choices.forEach((c, i) => {
    if (c.price.model === "flat" && c.price.amount == null) todos.push(`options.rafterTail.choices[${i}].price (${c.label})`);
  });
  if (opts.decorativeTrussPlates.price.model === "flat" && opts.decorativeTrussPlates.price.amount == null)
    todos.push("options.decorativeTrussPlates.price");
  if (opts.overhangFaceboard.price.model === "flat" && opts.overhangFaceboard.price.amount == null)
    todos.push("options.overhangFaceboard.price");
  if (opts.texturedMetal.price.model === "flat" && opts.texturedMetal.price.amount == null)
    todos.push("options.texturedMetal.price");
  return todos;
}

function ManualUpcharges({
  doc,
  onSave,
  saving,
}: {
  doc: PricingDoc;
  onSave: (d: PricingDoc) => Promise<void>;
  saving: boolean;
}) {
  const [draft, setDraft] = useState(() => extractDraft(doc));

  useEffect(() => setDraft(extractDraft(doc)), [doc]);

  const apply = async () => {
    const next: PricingDoc = JSON.parse(JSON.stringify(doc));
    setFlat(next, ["options", "trussStyle", "choices", "1"], draft.archedKing);
    setFlat(next, ["options", "rafterTail", "choices", "1"], draft.scrollCut);
    setFlat(next, ["options", "decorativeTrussPlates"], draft.decorativePlates);
    setFlat(next, ["options", "overhangFaceboard"], draft.faceboard);
    setFlat(next, ["options", "texturedMetal"], draft.texturedMetal);
    const hammer = next.options.trussStyle.choices.find((c) => c.id === "hammer");
    if (hammer && hammer.price.model === "bySize") {
      const amounts: Record<string, number | null> = { ...hammer.price.amounts };
      for (const [k, v] of Object.entries(draft.hammerBySize)) {
        amounts[k] = v === "" ? null : Number(v);
      }
      hammer.price = { model: "bySize", amounts };
    }
    const rates = {} as SnowRates;
    for (const key of Object.keys(DEFAULT_SNOW_RATES) as (keyof SnowRates)[]) {
      const input = draft.snowRates[key].trim();
      const rate = input === '' ? null : Number(input);
      if (rate !== null && (!Number.isFinite(rate) || rate < 0)) {
        toast.error('Snow-retention rates must be nonnegative amounts or blank.'); return;
      }
      rates[key] = rate;
    }
    next.options.snowRetentionRates = rates;
    await onSave(next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manual upcharges</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Set the prices the spreadsheet doesn't include. Leave blank for "call for pricing". These
          values survive future spreadsheet uploads.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Money label="Arched King Truss (flat)" value={draft.archedKing} onChange={(v) => setDraft({ ...draft, archedKing: v })} />
          <Money label="Scroll Cut Rafter Tail (flat)" value={draft.scrollCut} onChange={(v) => setDraft({ ...draft, scrollCut: v })} />
          <Money label="Decorative Truss Plates" value={draft.decorativePlates} onChange={(v) => setDraft({ ...draft, decorativePlates: v })} />
          <Money label="Overhang Faceboard" value={draft.faceboard} onChange={(v) => setDraft({ ...draft, faceboard: v })} />
          <Money label="Textured Metal upgrade" value={draft.texturedMetal} onChange={(v) => setDraft({ ...draft, texturedMetal: v })} />
        </div>

        <div>
          <div className="text-sm font-semibold mb-2">Hammer Truss by size</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {doc.sizes.map((s) => (
              <Money
                key={s.id}
                label={s.id}
                small
                value={draft.hammerBySize[s.id] ?? ""}
                onChange={(v) => setDraft({ ...draft, hammerBySize: { ...draft.hammerBySize, [s.id]: v } })}
              />
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold">Snow retention — unit rates</h3>
          <p className="text-sm text-muted-foreground mb-3">The estimate counts guards and rail on both eaves. Ribbed-metal rail uses whole 10-foot sections per eave. Standing-seam rail uses the installed linear feet. Blank means a quote is required.</p>
          <div className="grid grid-cols-1 gap-3">
            {([['guardEach', 'Snow guard · per piece'], ['ribbedRailPerSection', 'Ribbed-metal rail · per 10′ section'], ['standingSeamRailPerFoot', 'Standing-seam rail · per linear foot']] as const).map(([key,label]) => <Money key={key} label={label} value={draft.snowRates[key]} onChange={v => setDraft({...draft,snowRates:{...draft.snowRates,[key]:v}})}/>)}
          </div>
        </div>
        <Button onClick={apply} disabled={saving}>{saving ? "Saving…" : "Save upcharges"}</Button>
      </CardContent>
    </Card>
  );
}

function Money({ label, value, onChange, small }: { label: string; value: string; onChange: (v: string) => void; small?: boolean }) {
  return (
    <div className="space-y-1">
      <Label className={small ? "text-[10px] font-mono" : "text-xs"}>{label}</Label>
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
        <Input
          inputMode="decimal"
          placeholder="—"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-5 h-8 text-sm"
        />
      </div>
    </div>
  );
}

type Draft = {
  snowRates: Record<keyof SnowRates, string>;
  archedKing: string;
  scrollCut: string;
  decorativePlates: string;
  faceboard: string;
  texturedMetal: string;
  hammerBySize: Record<string, string>;
};

function extractDraft(doc: PricingDoc): Draft {
  const flat = (m: { model: string; amount?: number | null }) =>
    m.model === "flat" && m.amount != null ? String(m.amount) : "";
  const arched = doc.options.trussStyle.choices.find((c) => c.id === "arched_king");
  const scroll = doc.options.rafterTail.choices.find((c) => c.id === "scroll_cut");
  const hammer = doc.options.trussStyle.choices.find((c) => c.id === "hammer");
  const hammerBySize: Record<string, string> = {};
  if (hammer && hammer.price.model === "bySize") {
    for (const [k, v] of Object.entries(hammer.price.amounts)) {
      hammerBySize[k] = v == null ? "" : String(v);
    }
  }
  return {
    archedKing: arched && arched.price.model === "flat" ? flat(arched.price) : "",
    scrollCut: scroll && scroll.price.model === "flat" ? flat(scroll.price) : "",
    decorativePlates: flat(doc.options.decorativeTrussPlates.price as { model: string; amount?: number | null }),
    faceboard: flat(doc.options.overhangFaceboard.price as { model: string; amount?: number | null }),
    texturedMetal: flat(doc.options.texturedMetal.price as { model: string; amount?: number | null }),
    snowRates: Object.fromEntries(Object.entries({...DEFAULT_SNOW_RATES,...doc.options.snowRetentionRates}).map(([key,value])=>[key,value === null ? '' : String(value)])) as Record<keyof SnowRates,string>,
    hammerBySize,
  };
}

function setFlat(doc: PricingDoc, path: string[], strVal: string) {
  let node: unknown = doc;
  for (let i = 0; i < path.length; i++) {
    const key = path[i];
    if (Array.isArray(node)) node = (node as unknown[])[Number(key)];
    else node = (node as Record<string, unknown>)[key];
    if (node == null) return;
  }
  const target = node as { price?: { model: string; amount?: number | null } };
  if (!target.price) return;
  if (target.price.model !== "flat") target.price = { model: "flat", amount: null };
  target.price.amount = strVal === "" ? null : Number(strVal);
}
