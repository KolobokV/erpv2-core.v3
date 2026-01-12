import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type SidePanelSection = {
  title?: string;
  content: any;
};

export type SidePanelPayload = {
  title: string;
  subtitle?: string;
  actions?: any;
  sections: SidePanelSection[];
  widthPx?: number;
  onClose?: () => void;
};

type Ctx = {
  isOpen: boolean;
  payload: SidePanelPayload | null;
  openPanel: (p: SidePanelPayload) => void;
  closePanel: () => void;
};

const SidePanelCtx = createContext<Ctx | null>(null);

function useBodyLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}

export function SidePanelProvider(props: { children: any }) {
  const [payload, setPayload] = useState<SidePanelPayload | null>(null);

  const openPanel = useCallback((p: SidePanelPayload) => setPayload(p), []);
  const closePanel = useCallback(() => setPayload(null), []);

  const isOpen = !!payload;

  useBodyLock(isOpen);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (!payload) return;
        if (payload.onClose) payload.onClose();
        closePanel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [payload, closePanel]);

  const value = useMemo<Ctx>(() => ({ isOpen, payload, openPanel, closePanel }), [isOpen, payload, openPanel, closePanel]);

  return (
    <SidePanelCtx.Provider value={value}>
      {props.children}
      <SidePanelHost />
    </SidePanelCtx.Provider>
  );
}

export function useSidePanel(): Ctx {
  const v = useContext(SidePanelCtx);
  if (!v) throw new Error("useSidePanel must be used within SidePanelProvider");
  return v;
}

function SidePanelHost() {
  const ctx = useContext(SidePanelCtx);
  const payload = ctx?.payload || null;
  const closePanel = ctx?.closePanel || (() => undefined);
  const open = !!payload;

  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const el = panelRef.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (first) first.focus();
  }, [open]);

  if (!payload) return null;

  const width = Math.max(360, Math.min(720, Number(payload.widthPx || 560)));

  const doClose = () => {
    if (payload.onClose) payload.onClose();
    closePanel();
  };

  return (
    <>
      <div className="spx-backdrop" role="presentation" onClick={doClose} />
      <div className="spx-panel" role="dialog" aria-modal="true" style={{ width }} ref={panelRef}>
        <div className="spx-head">
          <div className="spx-head-main">
            <div className="spx-title">{payload.title}</div>
            {payload.subtitle ? <div className="spx-sub">{payload.subtitle}</div> : null}
          </div>
          <button className="spx-x" type="button" onClick={doClose} aria-label="Close">
            {"\u2715"}
          </button>
        </div>

        {payload.actions ? <div className="spx-actions">{payload.actions}</div> : null}

        <div className="spx-body">
          {payload.sections.map((s, i) => (
            <div key={i} className="spx-section">
              {s.title ? <div className="spx-section-title">{s.title}</div> : null}
              <div className="spx-section-content">{s.content}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
