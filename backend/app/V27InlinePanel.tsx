import React, { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { getClientFromLocation } from "../v27/clientContext";
import { buildV27Bundle } from "../v27/bridge";
import { V27DerivedPanel } from "./V27DerivedPanel";

export const V27InlinePanel: React.FC<{ title: string }> = ({ title }) => {
  const loc = useLocation();
  const clientId = getClientFromLocation(loc);

  const bundle = useMemo(() => {
    if (!clientId) return null;
    return buildV27Bundle(clientId);
  }, [clientId]);

  if (!bundle) return null;

  return (
    <V27DerivedPanel
      title={title}
      clientId={bundle.clientId}
      derived={bundle.derived}
      risks={bundle.risks}
    />
  );
};