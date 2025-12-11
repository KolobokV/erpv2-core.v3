import React from "react";
import DeadlinePill from "./DeadlinePill";

export type HorizonItem = {
  id: string;
  title: string;
  date?: string;
  category?: string;
  highlight?: "overdue" | "today" | "soon" | "normal";
};

export type HorizonListProps = {
  items: HorizonItem[];
  emptyLabel?: string;
};

const HorizonList: React.FC<HorizonListProps> = ({ items, emptyLabel }) => {
  if (!items || items.length === 0) {
    return (
      <div className="text-[11px] text-slate-600">
        {emptyLabel || "No items in the near horizon."}
      </div>
    );
  }

  return (
    <ul className="mt-1 space-y-0.5">
      {items.map((item) => {
        let titleClasses = "truncate pr-2 text-[11px]";
        if (item.highlight === "overdue") {
          titleClasses += " text-red-700";
        } else if (item.highlight === "today") {
          titleClasses += " text-amber-700";
        } else if (item.highlight === "soon") {
          titleClasses += " text-sky-700";
        }

        return (
          <li
            key={item.id}
            className="flex items-center justify-between gap-2 text-[11px]"
          >
            <div className="min-w-0 flex-1">
              <div className={titleClasses}>{item.title}</div>
              {item.category && (
                <div className="text-[10px] text-slate-500">
                  {item.category}
                </div>
              )}
            </div>
            {item.date && <DeadlinePill date={item.date} />}
          </li>
        );
      })}
    </ul>
  );
};

export default HorizonList;
