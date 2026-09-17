"use client";
import { useEffect, useState } from "react";
import { useProgress } from "@react-three/drei";
import sawAsset from "@/assets/saw_only.png.asset.json";
import logAsset from "@/assets/log_only.png.asset.json";

/**
 * Customer-side loading screen shown while the 3D pavilion scene loads.
 * Animated hand saw rocks back and forth across a log with sawdust particles
 * falling from the cut. All motion is pure CSS — no canvas, no JS frame loop.
 *
 * The overlay stays mounted (and the saw keeps stroking) until every asset
 * tracked by drei's loading manager has finished — not just the first
 * Suspense batch — so the saw doesn't stop mid-stroke while textures/GLBs
 * are still streaming in.
 */
const MIN_VISIBLE_MS = 2200;

export function SceneLoadingBar() {
  const { progress, active, loaded, total } = useProgress();
  const pct = Math.max(0, Math.min(100, Math.round(progress)));

  // Track when this component first mounted so we can enforce a minimum
  // display time — otherwise cached assets cause the saw to vanish instantly.
  const [mountedAt] = useState(() => Date.now());
  const [minElapsed, setMinElapsed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    return () => clearTimeout(t);
  }, []);

  // Scene is considered done loading when drei reports no active loads and
  // progress is at 100%. If no asset has loaded yet, we still wait for the
  // minimum display window before hiding.
  const dreiDone = !active && pct >= 100 && (total === 0 || loaded >= total);
  const fullyLoaded = dreiDone && minElapsed;

  // Keep the overlay mounted for a short fade-out after completion.
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  useEffect(() => {
    if (!fullyLoaded) return;
    setFading(true);
    const t = setTimeout(() => setVisible(false), 450);
    return () => clearTimeout(t);
  }, [fullyLoaded]);

  if (!visible) return null;

  // 12 sawdust particles with staggered delays so the stream looks continuous.
  const dust = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div
      className="absolute inset-0 z-20 grid place-items-center bg-[#F5F1E8]/95 backdrop-blur-sm transition-opacity duration-500"
      style={{ opacity: fading ? 0 : 1, pointerEvents: fading ? "none" : "auto" }}
    >
      <style>{`
        @keyframes ksm-saw-stroke {
          0%   { transform: translate(-46%, -78%) rotate(-10deg); }
          50%  { transform: translate(-54%, -76%) rotate(-4deg); }
          100% { transform: translate(-46%, -78%) rotate(-10deg); }
        }
        @keyframes ksm-log-shake {
          0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
          25%      { transform: translate(-50.4%, -50%) rotate(-0.4deg); }
          75%      { transform: translate(-49.6%, -50%) rotate(0.4deg); }
        }
        @keyframes ksm-dust-fall {
          0%   { opacity: 0; transform: translate(0,0) scale(0.4); }
          15%  { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--dx), 90px) scale(0.9); }
        }
        @keyframes ksm-progress-shimmer {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>

      <div className="flex flex-col items-center gap-8">
        {/* Animation stage */}
        <div className="relative h-[200px] w-[300px]">
          {/* Log — gentle shake from saw pressure */}
          <img
            src={logAsset.url}
            alt=""
            aria-hidden
            className="absolute left-1/2 top-1/2 w-[230px] select-none"
            style={{
              animation: "ksm-log-shake 0.36s ease-in-out infinite",
              transformOrigin: "50% 50%",
              filter: "drop-shadow(0 8px 14px rgba(60,30,10,0.18))",
            }}
            draggable={false}
          />

          {/* Saw — back-and-forth stroke across the log */}
          <img
            src={sawAsset.url}
            alt=""
            aria-hidden
            className="absolute left-1/2 top-1/2 w-[210px] select-none"
            style={{
              animation: "ksm-saw-stroke 0.72s ease-in-out infinite",
              transformOrigin: "50% 50%",
              filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.25))",
            }}
            draggable={false}
          />

          {/* Sawdust particles falling from the kerf */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
            {dust.map((i) => {
              const dx = (((i * 53) % 40) - 20).toFixed(0) + "px";
              const delay = ((i * 0.11) % 1.2).toFixed(2) + "s";
              const size = 3 + (i % 3); // 3..5px
              const palette = ["#C89766", "#A77042", "#D9B27A", "#8B5A2B"];
              const color = palette[i % palette.length];
              return (
                <span
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    width: size,
                    height: size,
                    backgroundColor: color,
                    left: 0,
                    top: 8,
                    // CSS var consumed by the keyframe
                    ["--dx" as string]: dx,
                    animation: `ksm-dust-fall 1.1s linear ${delay} infinite`,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Progress label + bar */}
        <div className="flex w-[min(360px,80vw)] flex-col items-center gap-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#5D3A1A]">
            {fullyLoaded ? "Finishing up" : "Cutting your pavilion"}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E5DCC8]">
            <div
              className="h-full rounded-full transition-[width] duration-200 ease-out"
              style={{
                width: `${pct}%`,
                backgroundImage:
                  "linear-gradient(90deg, #B45309 0%, #D97706 40%, #F59E0B 60%, #D97706 100%)",
                backgroundSize: "200% 100%",
                animation: "ksm-progress-shimmer 1.4s linear infinite",
              }}
            />
          </div>
          <div className="text-xs tabular-nums text-[#7C5A36]">{pct}%</div>
        </div>
      </div>
    </div>
  );
}

