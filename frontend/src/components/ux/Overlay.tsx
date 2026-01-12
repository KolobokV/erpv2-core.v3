import React, { useEffect } from "react";

type SidePanelProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  widthPx?: number;
};

export function SidePanel(props: SidePanelProps) {
  const { open, title, onClose, children, widthPx } = props;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const style: React.CSSProperties | undefined = widthPx ? { width: widthPx } : undefined;

  return (
    <div className="ux-panel" role="dialog" aria-modal="false" style={style}>
      <div className="ux-panel-head">
        <div className="ux-panel-title">{title}</div>
        <button className="ux-icon" type="button" onClick={onClose} aria-label="Close">
          {"\u2715"}
        </button>
      </div>
      <div className="ux-panel-body">{children}</div>
    </div>
  );
}

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  widthPx?: number;
};

export function Modal(props: ModalProps) {
  const { open, title, onClose, children, widthPx } = props;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const style: React.CSSProperties | undefined = widthPx ? { width: widthPx } : undefined;

  return (
    <div className="ux-modal" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="ux-modal-card" style={style} onMouseDown={(e) => e.stopPropagation()}>
        <div className="ux-modal-head">
          <div className="ux-modal-title">{title}</div>
          <button className="ux-icon" type="button" onClick={onClose} aria-label="Close">
            {"\u2715"}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
