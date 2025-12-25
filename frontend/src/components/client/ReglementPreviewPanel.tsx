type Item = { title: string; due: string };

export default function ReglementPreviewPanel({ items }: { items: Item[] }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
      <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Generated schedule (preview)</h3>
      {items.length === 0 ? (
        <div style={{ opacity: 0.7 }}>No events yet</div>
      ) : (
        <ul>
          {items.map((i, idx) => (
            <li key={idx}>
              <strong>{i.title}</strong> вЂ” {i.due}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}