import { loadClientProfileV27 } from "./profileStore";
import { deriveReglementV27 } from "./deriveReglement";
import { computeRisksV27 } from "./riskEngine";
import { ClientProfileV27, ReglementItemDerived, RiskItem } from "./types";

export type V27ClientBundle = {
  clientId: string;
  profile: ClientProfileV27;
  derived: ReglementItemDerived[];
  risks: RiskItem[];
};

export const buildV27Bundle = (clientId: string): V27ClientBundle => {
  const profile = loadClientProfileV27(clientId);
  const derived = deriveReglementV27(profile);
  const risks = computeRisksV27(profile, derived);
  return { clientId, profile, derived, risks };
};