import React from "react";

type UpBackBarProps = {
  title: string;
  onUp?: () => void;
  onBack?: () => void;
  right?: React.ReactNode;
};

export function UpBackBar(props: UpBackBarProps) {
  const { title, onUp, onBack, right } = props;

  return (
    <div className="erp-pagebar" role="region" aria-label="page actions">
      <div className="erp-pagebar-left">
        {onUp ? (
          <button type="button" onClick={onUp} className="erp-btn erp-btn-sm">
            Up
          </button>
        ) : null}
        {onBack ? (
          <button type="button" onClick={onBack} className="erp-btn erp-btn-sm">
            Back
          </button>
        ) : null}

        <div className="erp-pagebar-title" title={title}>
          {title}
        </div>
      </div>

      <div className="erp-pagebar-right">{right ?? null}</div>
    </div>
  );
}
