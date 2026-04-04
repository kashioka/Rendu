import { useEffect, useState } from "react";
import { readDir, type DirEntry } from "@tauri-apps/plugin-fs";

interface FileTreeProps {
  rootDir: string;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: TreeNode[];
}

async function buildTree(dirPath: string): Promise<TreeNode[]> {
  const entries: DirEntry[] = await readDir(dirPath);
  const nodes: TreeNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name.includes("/") || entry.name.includes("\\")) continue;
    const fullPath = `${dirPath.replace(/\/+$/, "")}/${entry.name}`;
    nodes.push({ name: entry.name, path: fullPath, isDir: entry.isDirectory });
  }

  nodes.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return nodes;
}

function TreeItem({
  node, selectedFile, onSelectFile, depth,
}: {
  node: TreeNode;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<TreeNode[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isMd = node.name.endsWith(".md") || node.name.endsWith(".markdown");
  const isSelected = selectedFile === node.path;
  const isClickable = node.isDir || isMd;

  const handleClick = async () => {
    if (!node.isDir) {
      if (isMd) onSelectFile(node.path);
      return;
    }
    setLoadError(null);
    if (!expanded && children === null) {
      try {
        const nodes = await buildTree(node.path);
        setChildren(nodes);
      } catch (e) {
        setLoadError(String(e));
        return;
      }
    }
    setExpanded(!expanded);
  };

  const className = [
    "flex items-center gap-1.5 py-1 px-2 text-sm select-none",
    isSelected ? "tree-item--selected" : "",
    !isSelected && isClickable ? "tree-item" : "",
    !isClickable ? "tree-item--muted" : "",
    isClickable ? "cursor-pointer" : "cursor-default",
  ].join(" ");

  return (
    <div>
      <div
        role="treeitem"
        tabIndex={isClickable ? 0 : -1}
        aria-expanded={node.isDir ? expanded : undefined}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(); } }}
        className={className}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <span className="w-4 text-center flex-shrink-0 text-xs">
          {node.isDir ? (expanded ? "▾" : "▸") : ""}
        </span>
        <span className="truncate">{node.name}</span>
      </div>
      {loadError && (
        <div className="text-xs truncate" style={{ paddingLeft: `${(depth + 1) * 16 + 8}px`, color: "#f87171" }}>
          {loadError}
        </div>
      )}
      {node.isDir && expanded && children && (
        <div>
          {children.map((child) => (
            <TreeItem key={child.path} node={child} selectedFile={selectedFile} onSelectFile={onSelectFile} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({ rootDir, selectedFile, onSelectFile }: FileTreeProps) {
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    buildTree(rootDir).then(setNodes).catch((e) => setError(String(e)));
  }, [rootDir]);

  if (error) return <div className="p-4 text-sm" style={{ color: "#f87171" }}>{error}</div>;

  return (
    <div className="py-1" role="tree">
      {nodes.map((node) => (
        <TreeItem key={node.path} node={node} selectedFile={selectedFile} onSelectFile={onSelectFile} depth={0} />
      ))}
    </div>
  );
}
