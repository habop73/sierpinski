import { useEffect, useRef, useState } from "react";

const ITERATIONS = 29200;
const COLORS = ["#ff4d4d", "#4daaff", "#4dff91"];
const DEFAULT_SPEED = 0; // 0–100

type Point = { x: number; y: number };

// Anker: speed 25 → 1 Punkt/Sekunde (= 1/60 pt/frame), speed 100 → 600 pt/frame.
// Einzelne Exponentialkurve, gibt gebrochene Werte zurück (Akkumulator im Loop nötig).
const _PPF_K = Math.log(600 * 60) / 80;          // ln(36000) / 80
const _PPF_A = (1 / 60) * Math.exp(-20 * _PPF_K); // so dass speed 20 → 1/60

function pointsPerFrame(speed: number): number {
  if (speed === 0) return 0;
  return _PPF_A * Math.exp(speed * _PPF_K);
}

function useIosInstallHint() {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = ('standalone' in navigator) && (navigator as { standalone?: boolean }).standalone;
  const isSafari = !/CriOS|FxiOS/.test(navigator.userAgent);
  const [visible, setVisible] = useState(
    isIos && isSafari && !isStandalone && !sessionStorage.getItem('ios-hint-dismissed')
  );
  function dismiss() {
    sessionStorage.setItem('ios-hint-dismissed', '1');
    setVisible(false);
  }
  return { visible, dismiss };
}

export function Sierpinski() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fixpoints, setFixpoints] = useState<Point[]>([]);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [done, setDone] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [pixelSize, setPixelSize] = useState(5);
  const [iterReady, setIterReady] = useState(false);
  const [loop, setLoop] = useState(false);
  const [count, setCount] = useState(0);

  const [factor, setFactor] = useState(0.5);

  // Refs für den Animations-Loop (vermeidet Closure-Probleme)
  const speedRef = useRef(DEFAULT_SPEED);
  const pixelSizeRef = useRef(5);
  const factorRef = useRef(0.5);
  const loopRef = useRef(false);
  const animRef = useRef<number | null>(null);
  const countRef = useRef(0);
  const accumRef = useRef(0);
  const loopFnRef = useRef<(() => void) | null>(null);
  const iterRef = useRef<{
    fp: Point[];
    cur: Point;
    remaining: number;
  } | null>(null);

  // --- Fixpunkte + Startpunkt zeichnen ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    fixpoints.forEach((p, i) => {
      const color = COLORS[i];
      ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
      ctx.fillStyle = `${color}26`; ctx.fill();
      ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = `${color}88`; ctx.fill();
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.fillStyle = color; ctx.font = "bold 11px monospace";
      ctx.fillText(`${i + 1}`, p.x + 16, p.y + 6);
    });
    if (startPoint) {
      ctx.beginPath(); ctx.arc(startPoint.x, startPoint.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.fill();
      ctx.beginPath(); ctx.arc(startPoint.x, startPoint.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = "bold 11px monospace";
      ctx.fillText("S", startPoint.x + 12, startPoint.y + 5);
    }
  }, [fixpoints, startPoint]);

  // --- Animations-Loop starten sobald Startpunkt gesetzt ---
  useEffect(() => {
    if (!startPoint || fixpoints.length !== 3) return;

    iterRef.current = {
      fp: fixpoints,
      cur: startPoint,
      remaining: ITERATIONS,
    };
    countRef.current = 0;
    accumRef.current = 0;
    setCount(0);
    setIterReady(true);

    function loop(): void {
      const iter = iterRef.current;
      if (!iter || iter.remaining <= 0) {
        if (loopRef.current) {
          iterRef.current = { fp: iter.fp, cur: iter.fp[Math.floor(Math.random() * 3)], remaining: ITERATIONS };
          countRef.current = 0;
          accumRef.current = 0;
          setCount(0);
          animRef.current = requestAnimationFrame(loop);
          return;
        }
        setDone(true);
        return;
      }
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx) return;

      accumRef.current += pointsPerFrame(speedRef.current);
      const batch = Math.min(Math.floor(accumRef.current), iter.remaining);
      if (batch > 0) {
        accumRef.current -= batch;
        for (let i = 0; i < batch; i++) {
          const idx = Math.floor(Math.random() * 3);
          const target = iter.fp[idx];
          const f = factorRef.current;
          iter.cur = {
            x: iter.cur.x + f * (target.x - iter.cur.x),
            y: iter.cur.y + f * (target.y - iter.cur.y),
          };
          const ps = pixelSizeRef.current;
          const half = (ps - 1) / 2;
          ctx.fillStyle = COLORS[idx];
          ctx.fillRect(iter.cur.x - half, iter.cur.y - half, ps, ps);
        }
        iter.remaining -= batch;
        countRef.current += batch;
        setCount(countRef.current);
      }

      animRef.current = requestAnimationFrame(loop);
    }

    loopFnRef.current = loop;
    animRef.current = requestAnimationFrame(loop);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [fixpoints, startPoint]);

  function handlePointer(e: React.PointerEvent<HTMLCanvasElement>) {
    if (fixpoints.length < 3) {
      e.preventDefault();
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const p = {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height),
      };
      setFixpoints(prev => [...prev, p]);
    } else if (!startPoint) {
      e.preventDefault();
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      setStartPoint({
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height),
      });
    }
  }

  function handleReset() {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    iterRef.current = null;
    countRef.current = 0;
    accumRef.current = 0;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) { ctx.fillStyle = "black"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    setFixpoints([]);
    setStartPoint(null);
    setDone(false);
    setIterReady(false);
    setCount(0);
    setSpeed(0);
    speedRef.current = 0;
  }

  function handleFactor(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Number(e.target.value);
    setFactor(v);
    factorRef.current = v;
  }

  function handleSpeed(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Number(e.target.value);
    setSpeed(v);
    speedRef.current = v;
  }

  function handlePixelSize(ps: number) {
    setPixelSize(ps);
    pixelSizeRef.current = ps;
  }

  function handleLoop() {
    const next = !loopRef.current;
    loopRef.current = next;
    setLoop(next);
    // Animation bereits beendet → sofort neu starten
    if (next && done && iterRef.current && loopFnRef.current) {
      iterRef.current = {
        fp: iterRef.current.fp,
        cur: iterRef.current.fp[Math.floor(Math.random() * 3)],
        remaining: ITERATIONS,
      };
      countRef.current = 0;
      accumRef.current = 0;
      setCount(0);
      setDone(false);
      animRef.current = requestAnimationFrame(loopFnRef.current);
    }
  }

  function handleStep() {
    const iter = iterRef.current;
    if (!iter || iter.remaining <= 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const idx = Math.floor(Math.random() * 3);
    const target = iter.fp[idx];
    const f = factorRef.current;
    iter.cur = { x: iter.cur.x + f * (target.x - iter.cur.x), y: iter.cur.y + f * (target.y - iter.cur.y) };
    const ps = pixelSizeRef.current;
    const half = (ps - 1) / 2;
    ctx.fillStyle = COLORS[idx];
    ctx.fillRect(iter.cur.x - half, iter.cur.y - half, ps, ps);
    iter.remaining -= 1;
    countRef.current += 1;
    setCount(countRef.current);
    if (iter.remaining <= 0) setDone(true);
  }

  const { visible: iosHint, dismiss: dismissIosHint } = useIosInstallHint();
  const active = fixpoints.length > 0;

  return (
    <div style={{
      width: "100vw", height: "100vh", minHeight: "-webkit-fill-available", background: "black",
      display: "flex", flexDirection: "column",
      boxSizing: "border-box", padding: 16,
    }}>
      {/* Status oben */}
      <div style={{
        color: "white", fontFamily: "monospace", fontSize: 15,
        opacity: 0.85, textAlign: "center", paddingBottom: 12, flexShrink: 0,
      }}>
        {done
          ? <span>Fertig &ndash; klicke &bdquo;Neu&ldquo; f&uuml;r ein neues Muster</span>
          : <span style={{ display: "flex", alignItems: "center", gap: 20, justifyContent: "center" }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{ color: fixpoints.length > i ? COLORS[i] : "rgba(255,255,255,0.3)" }}>
                  {i + 1}&nbsp;{fixpoints.length > i ? "\u2713" : "\u25cb"}
                </span>
              ))}
              <span style={{ color: startPoint ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)" }}>
                S&nbsp;{startPoint ? "\u2713" : "\u25cb"}
              </span>
              <span style={{
                color: fixpoints.length < 3
                  ? COLORS[fixpoints.length]
                  : !startPoint
                    ? "rgba(255,255,255,0.7)"
                    : "white",
                marginLeft: 8,
              }}>
                {fixpoints.length < 3
                  ? `\u2192 Punkt ${fixpoints.length + 1} klicken`
                  : !startPoint
                    ? "\u2192 Startpunkt klicken"
                    : "\u2192 l\u00e4uft\u2026"}
              </span>
            </span>
        }
      </div>

      {/* Klickfläche mit Slider am unteren Rand */}
      <div style={{
        flex: 1, border: "1px solid rgba(255,255,255,0.6)", borderRadius: 4,
        overflow: "hidden", display: "flex", flexDirection: "column",
        cursor: (fixpoints.length < 3 || !startPoint) ? "crosshair" : "default",
        position: "relative",
      }}>
        {/* Iterations-Zähler oben links */}
        {iterReady && (
          <div style={{
            position: "absolute", top: 8, right: 10,
            fontFamily: "monospace", fontSize: 13,
            color: "rgba(255,255,255,0.45)",
            pointerEvents: "none",
            zIndex: 10,
            letterSpacing: "0.03em",
          }}>
            {count.toLocaleString("de-DE")}&thinsp;/&thinsp;{ITERATIONS.toLocaleString("de-DE")}
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={800} height={600}
          onPointerDown={handlePointer}
          style={{ display: "block", flex: 1, minHeight: 0, width: "100%", touchAction: "none", userSelect: "none" }}
        />

        {/* Slider-Leiste */}
        <div style={{
          flexShrink: 0,
          padding: "8px 14px",
          background: "rgba(0,0,0,0.85)",
          borderTop: "1px solid rgba(255,255,255,0.15)",
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          {/* Geschwindigkeit */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "rgba(255,255,255,0.45)", fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}>
              {speed === 0 ? "⏸" : "◀"}
            </span>
            <input
              type="range" min={0} max={100} value={speed} onChange={handleSpeed}
              style={{ flex: 1, accentColor: "rgba(255,255,255,0.6)", cursor: "pointer", height: 4 }}
            />
            <span style={{ color: "rgba(255,255,255,0.45)", fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}>▶</span>
          </div>
          {/* Kompressionsfaktor */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "rgba(255,255,255,0.35)", fontFamily: "monospace", fontSize: 11, whiteSpace: "nowrap", width: 16, textAlign: "right" }}>
              ◈
            </span>
            <input
              type="range" min={0.1} max={0.9} step={0.1} value={factor} onChange={handleFactor}
              style={{ flex: 1, accentColor: "rgba(255,255,255,0.6)", cursor: "pointer", height: 4 }}
            />
            <span style={{ color: "rgba(255,255,255,0.35)", fontFamily: "monospace", fontSize: 11, whiteSpace: "nowrap", minWidth: 32, textAlign: "right" }}>
              {factor.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Neu-Button + Pixelgröße unten */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 12 }}>
        <button
          onClick={handleReset}
          disabled={!active}
          style={{
            padding: "8px 36px", background: "transparent",
            border: `1px solid ${!active ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.5)"}`,
            color: !active ? "rgba(255,255,255,0.2)" : "white",
            fontFamily: "monospace", fontSize: 24,
            cursor: !active ? "default" : "pointer",
            borderRadius: 6, letterSpacing: 1, transition: "all 0.2s",
          }}
        >
          Neu
        </button>
        {[1, 3, 5].map(ps => (
          <button
            key={ps}
            onClick={() => handlePixelSize(ps)}
            style={{
              width: 36, height: 36,
              background: pixelSize === ps ? "rgba(255,255,255,0.18)" : "transparent",
              border: `1px solid ${pixelSize === ps ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)"}`,
              color: pixelSize === ps ? "white" : "rgba(255,255,255,0.4)",
              fontFamily: "monospace", fontSize: 16,
              cursor: "pointer", borderRadius: 6,
              transition: "all 0.2s",
            }}
          >
            {ps}
          </button>
        ))}
        <button
          onClick={handleLoop}
          disabled={!iterReady}
          title="Loop"
          style={{
            width: 36, height: 36,
            background: loop ? "rgba(255,255,255,0.18)" : "transparent",
            border: `1px solid ${!iterReady ? "rgba(255,255,255,0.15)" : loop ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.35)"}`,
            color: !iterReady ? "rgba(255,255,255,0.2)" : loop ? "white" : "rgba(255,255,255,0.7)",
            fontSize: 18, cursor: !iterReady ? "default" : "pointer",
            borderRadius: 6, transition: "all 0.2s",
          }}
        >
          ↺
        </button>
        <button
          onClick={handleStep}
          disabled={!iterReady || done}
          title="Eine Iteration"
          style={{
            width: 36, height: 36,
            background: "transparent",
            border: `1px solid ${!iterReady || done ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.35)"}`,
            color: !iterReady || done ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.7)",
            fontFamily: "monospace", fontSize: 14,
            cursor: !iterReady || done ? "default" : "pointer",
            borderRadius: 6, transition: "all 0.2s",
          }}
        >
          +1
        </button>
      </div>

      {/* iOS-Installationshinweis */}
      {iosHint && (
        <div style={{
          position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
          background: "rgba(30,30,30,0.97)", border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 12, padding: "12px 16px",
          display: "flex", alignItems: "center", gap: 12,
          fontFamily: "monospace", fontSize: 13, color: "rgba(255,255,255,0.85)",
          whiteSpace: "nowrap", zIndex: 100,
          boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
        }}>
          <span style={{ fontSize: 18 }}>⬆</span>
          <span>„Teilen" &rarr; <strong>Zum Home-Bildschirm</strong></span>
          <button onClick={dismissIosHint} style={{
            background: "none", border: "none", color: "rgba(255,255,255,0.4)",
            fontSize: 18, cursor: "pointer", padding: "0 4px", lineHeight: 1,
          }}>✕</button>
        </div>
      )}
    </div>
  );
}
