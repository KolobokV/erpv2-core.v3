import React from "react";
import StatusPill, { StatusPillTone } from "./StatusPill";

export type DeadlinePillProps = {
  date?: string | null;
  baseDate?: Date;
};

function parseIsoDateLike(value: string | undefined | null): Date | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return null;
  return d;
}

function getDateOnlyString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getDateDiffInDays(target: Date, base: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const a = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const b = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  return Math.round((a.getTime() - b.getTime()) / msPerDay);
}

const DeadlinePill: React.FC<DeadlinePillProps> = ({ date, baseDate }) => {
  const parsed = parseIsoDateLike(date ?? undefined);
  if (!parsed) {
    return <StatusPill label="No date" tone="neutral" />;
  }

  const base = baseDate ?? new Date();
  const diff = getDateDiffInDays(parsed, base);
  const dateLabel = getDateOnlyString(parsed);

  let tone: StatusPillTone = "neutral";
  let label = dateLabel;

  if (diff < 0) {
    tone = "danger";
    label = dateLabel + " · overdue";
  } else if (diff === 0) {
    tone = "warning";
    label = dateLabel + " · today";
  } else if (diff > 0 && diff <= 7) {
    tone = "warning";
    label = dateLabel + " · in " + diff + "d";
  } else if (diff > 7 && diff <= 30) {
    tone = "info";
    label = dateLabel + " · in " + diff + "d";
  } else {
    tone = "neutral";
  }

  return <StatusPill label={label} tone={tone} />;
};

export default DeadlinePill;
