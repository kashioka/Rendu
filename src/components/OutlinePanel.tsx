export interface HeadingItem {
  id: string;
  text: string;
  level: number;
}

interface OutlinePanelProps {
  headings: HeadingItem[];
}

export function OutlinePanel({ headings }: OutlinePanelProps) {
  const handleClick = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (headings.length === 0) {
    return <div className="p-4 text-sm text-muted">No headings</div>;
  }

  const minLevel = Math.min(...headings.map((h) => h.level));

  return (
    <div className="py-1">
      {headings.map((h) => (
        <div
          key={h.id}
          onClick={() => handleClick(h.id)}
          className="outline-item flex items-center py-1 px-2 text-sm select-none cursor-pointer truncate"
          style={{ paddingLeft: `${(h.level - minLevel) * 12 + 8}px` }}
          title={h.text}
        >
          <span className="truncate">{h.text}</span>
        </div>
      ))}
    </div>
  );
}
