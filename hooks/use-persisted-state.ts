import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

/* ----------------------------- Undo history ----------------------------- */
// Global undo stack shared across every usePersistedState instance. Each
// entry is a thunk that reverts the most recent change to its prior value.
// Cmd/Ctrl+Z pops the most recent entry. Rapid bursts of changes (slider
// drags) only push a single "before" snapshot per burst, so one undo
// reverts the whole drag instead of one tiny step at a time.
type UndoEntry = () => void;
const undoStack: UndoEntry[] = [];
const MAX_UNDO = 200;
const BURST_WINDOW_MS = 400;
let undoInProgress = false;
let listenerInstalled = false;

function pushUndo(entry: UndoEntry) {
  undoStack.push(entry);
  if (undoStack.length > MAX_UNDO) undoStack.shift();
}

/** Run a state-mutation callback without recording an undo entry. Useful for
 *  irreversible actions (e.g. permanent deletes) that should not be reversed
 *  via Cmd/Ctrl+Z. */
export function withoutUndo(fn: () => void) {
  const prev = undoInProgress;
  undoInProgress = true;
  try {
    fn();
  } finally {
    undoInProgress = prev;
  }
}

function installUndoListener() {
  if (listenerInstalled || typeof window === "undefined") return;
  listenerInstalled = true;
  window.addEventListener("keydown", (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    if (e.shiftKey) return; // Shift+Cmd+Z is redo — leave alone for now.
    if (e.key !== "z" && e.key !== "Z") return;
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    // Inside text fields the browser's native undo should win.
    if (tag === "input" || tag === "textarea" || target?.isContentEditable) {
      const input = target as HTMLInputElement | null;
      const type = input?.type?.toLowerCase();
      // Range inputs (sliders) don't have native undo — handle them ourselves.
      if (type !== "range") return;
    }
    const fn = undoStack.pop();
    if (fn) {
      e.preventDefault();
      fn();
    }
  });
}

/** useState backed by localStorage. Reads synchronously on first render so
 *  the very first painted frame already reflects the persisted value — no
 *  post-mount "shift" when hydrating. SSR-safe via the `typeof window` guard. */
export function usePersistedState<T>(key: string, initial: T | (() => T)) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw !== null) return JSON.parse(raw) as T;
      } catch {
        /* ignore */
      }
    }
    return typeof initial === "function" ? (initial as () => T)() : initial;
  });
  const valueRef = useRef(value);
  // Already hydrated on the first render (synchronous read above).
  const hydrated = useRef(true);
  const skipNextWrite = useRef(true); // skip the first auto-write echo
  const lastPushTime = useRef(0);

  const writeValue = useCallback(
    (next: T) => {
      try {
        if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [key],
  );

  // Install the global undo listener once on mount (no value mutation here,
  // so no second-frame render).
  useEffect(() => {
    installUndoListener();
  }, []);


  useEffect(() => {
    if (!hydrated.current) return;
    if (skipNextWrite.current) {
      skipNextWrite.current = false;
      return;
    }
    valueRef.current = value;
    writeValue(value);
  }, [key, value, writeValue]);

  const setPersistedValue = useCallback<Dispatch<SetStateAction<T>>>(
    (nextValue) => {
      const previous = valueRef.current;
      const next =
        typeof nextValue === "function" ? (nextValue as (previous: T) => T)(previous) : nextValue;
      // Record undo: snapshot the "before" value at the start of a burst.
      if (hydrated.current && !undoInProgress && previous !== next) {
        const now = Date.now();
        if (now - lastPushTime.current > BURST_WINDOW_MS) {
          pushUndo(() => {
            undoInProgress = true;
            try {
              valueRef.current = previous;
              if (hydrated.current) writeValue(previous);
              setValue(previous);
            } finally {
              undoInProgress = false;
            }
          });
        }
        lastPushTime.current = now;
      }
      valueRef.current = next;
      if (hydrated.current) writeValue(next);
      setValue(next);
    },
    [writeValue],
  );

  return [value, setPersistedValue] as const;
}

