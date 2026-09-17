"use client";
import { useEffect, useRef, useState } from "react";
const useServerFn = <T,>(fn:T):T => fn;
import { cn } from "@/lib/utils";
import { publishPavilionDefaults } from "@/lib/pavilion-defaults.functions";

/** Prefix used by every persisted admin/config localStorage key. */
const KEY_PREFIX = "pav.";

type Snapshot = Record<string, string | null>;

function readSnapshot(): Snapshot {
  const snap: Snapshot = {};
  if (typeof window === "undefined") return snap;
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(KEY_PREFIX)) continue;
    snap[key] = window.localStorage.getItem(key);
  }
  return snap;
}

function snapshotsEqual(a: Snapshot, b: Snapshot): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (a[k] !== b[k]) return false;
  return true;
}

function restoreSnapshot(snap: Snapshot) {
  if (typeof window === "undefined") return;
  const current = readSnapshot();
  for (const k of Object.keys(current)) {
    if (!(k in snap)) window.localStorage.removeItem(k);
  }
  for (const [k, v] of Object.entries(snap)) {
    if (v == null) window.localStorage.removeItem(k);
    else window.localStorage.setItem(k, v);
  }
}

type Status = "idle" | "dirty" | "saved" | "saving";

/** Floating save prompt for admin mode. Watches every `pav.*` localStorage
 *  key. Surfaces a Save / Discard prompt for every adjustment. Hardened with:
 *  - Instant change detection (patched setItem/removeItem + storage events).
 *  - Ctrl/Cmd+S keyboard shortcut.
 *  - beforeunload warning when dirty.
 *  - Save always reads a fresh snapshot and reports per-key write failures. */
export function AdminAutosave() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const publishDefaults = useServerFn(publishPavilionDefaults);
  // Baseline = last user-confirmed snapshot. Discard restores this.
  const baselineRef = useRef<Snapshot>({});
  const savedTimerRef = useRef<number | null>(null);
  const statusRef = useRef<Status>("idle");

  const setStatusBoth = (s: Status) => {
    statusRef.current = s;
    setStatus(s);
  };

  const recompute = () => {
    const current = readSnapshot();
    const equal = snapshotsEqual(current, baselineRef.current);
    if (!equal && statusRef.current !== "dirty") setStatusBoth("dirty");
    else if (equal && statusRef.current === "dirty") setStatusBoth("idle");
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    baselineRef.current = readSnapshot();

    // Patch setItem / removeItem / clear to emit a same-tab change event so
    // we react instantly instead of waiting for the next poll tick.
    const proto = window.localStorage;
    const origSet = proto.setItem.bind(proto);
    const origRemove = proto.removeItem.bind(proto);
    const origClear = proto.clear.bind(proto);
    const EVT = "pav:localstorage";

    proto.setItem = (k: string, v: string) => {
      origSet(k, v);
      if (k.startsWith(KEY_PREFIX)) window.dispatchEvent(new Event(EVT));
    };
    proto.removeItem = (k: string) => {
      origRemove(k);
      if (k.startsWith(KEY_PREFIX)) window.dispatchEvent(new Event(EVT));
    };
    proto.clear = () => {
      origClear();
      window.dispatchEvent(new Event(EVT));
    };

    const onChange = () => recompute();
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith(KEY_PREFIX)) recompute();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (statusRef.current === "dirty") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "s") {
        if (statusRef.current === "dirty") {
          e.preventDefault();
          handleSave();
        }
      }
    };

    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onStorage);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", onKeyDown);
    // Safety-net poll for any writer that bypassed the patched API.
    const interval = window.setInterval(recompute, 1000);

    return () => {
      proto.setItem = origSet;
      proto.removeItem = origRemove;
      proto.clear = origClear;
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", onKeyDown);
      window.clearInterval(interval);
      if (savedTimerRef.current != null) window.clearTimeout(savedTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setStatusBoth("saving");
    setErrorMsg(null);
    try {
      // Re-read every key directly to guarantee we capture the freshest state,
      // including any value written between the last poll and this click.
      const latest = readSnapshot();
      // Verify each key round-trips. If a write was silently dropped (quota,
      // privacy mode), surface the failure instead of pretending we saved.
      const failed: string[] = [];
      for (const [k, v] of Object.entries(latest)) {
        try {
          if (v == null) window.localStorage.removeItem(k);
          else window.localStorage.setItem(k, v);
          if (window.localStorage.getItem(k) !== v) failed.push(k);
        } catch {
          failed.push(k);
        }
      }
      if (failed.length > 0) {
        setErrorMsg(`Could not save ${failed.length} setting${failed.length === 1 ? "" : "s"}`);
        setStatusBoth("dirty");
        return;
      }
      // Push the same snapshot to the backend so customers see it. Only the
      // string-valued entries are forwarded (the schema demands strings).
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(latest)) {
        if (typeof v === "string") payload[k] = v;
      }
      try {
        await publishDefaults({ data: { data: payload } });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Publish failed";
        setErrorMsg(`Saved locally, publish failed: ${msg}`);
        setStatusBoth("dirty");
        return;
      }
      baselineRef.current = latest;
      setStatusBoth("saved");
      if (savedTimerRef.current != null) window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = window.setTimeout(() => {
        if (statusRef.current === "saved") setStatusBoth("idle");
      }, 1800);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Save failed");
      setStatusBoth("dirty");
    }
  };

  const handleDiscard = () => {
    if (statusRef.current === "dirty") {
      const ok = window.confirm("Discard all unsaved changes?");
      if (!ok) return;
    }
    restoreSnapshot(baselineRef.current);
    // Hooks hydrate from localStorage on mount; reload to push the restored
    // values back into React state.
    window.location.reload();
  };

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex items-center gap-2">
      <div
        className={cn(
          "pointer-events-auto rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur transition-colors",
          status === "dirty" && "border-amber-300 bg-amber-50/90 text-amber-900",
          status === "saving" && "border-sky-300 bg-sky-50/90 text-sky-900",
          status === "saved" && "border-emerald-300 bg-emerald-50/90 text-emerald-900",
          status === "idle" && "border-ink/10 bg-white/80 text-ink/60",
        )}
        title={errorMsg ?? undefined}
      >
        {status === "dirty" && (errorMsg ?? "Unsaved changes")}
        {status === "saving" && "Saving…"}
        {status === "saved" && "Saved"}
        {status === "idle" && "All changes saved"}
      </div>
      {(status === "dirty" || status === "saving") && (
        <>
          <button
            type="button"
            onClick={handleSave}
            disabled={status === "saving"}
            title="Save (⌘/Ctrl+S)"
            className="pointer-events-auto rounded-full border border-brand bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
          >
            {status === "saving" ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={handleDiscard}
            disabled={status === "saving"}
            className="pointer-events-auto rounded-full border border-ink/20 bg-white/90 px-3 py-1.5 text-xs font-medium text-ink shadow-sm backdrop-blur hover:bg-white disabled:opacity-60"
          >
            Discard
          </button>
        </>
      )}
    </div>
  );
}

