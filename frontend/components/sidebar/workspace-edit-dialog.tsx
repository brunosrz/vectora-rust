"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, FolderOpen, Plus, Star, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  useWorkspacesStore,
  type WorkspaceInfo,
} from "@/lib/stores/workspaces-store";
import { m } from "@/lib/paraglide/messages";

interface WorkspaceEditDialogProps {
  open: boolean;
  workspace: WorkspaceInfo | null;
  onOpenChange: (open: boolean) => void;
}

export function WorkspaceEditDialog({
  open,
  workspace,
  onOpenChange,
}: WorkspaceEditDialogProps) {
  const updateProject = useWorkspacesStore((s) => s.updateProject);
  const [name, setName] = useState(workspace?.name ?? "");
  const [path, setPath] = useState(workspace?.cwd ?? "");
  const [sourceRoots, setSourceRoots] = useState<string[]>(
    workspace?.source_roots ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canPickDirectory =
    typeof window !== "undefined" && Boolean(window.vectora?.pickDirectory);

  async function chooseFolder() {
    const selected = await window.vectora?.pickDirectory?.();
    if (selected) setPath(selected);
  }

  async function addSourceFolder() {
    const selected = await window.vectora?.pickDirectory?.();
    if (!selected) return;
    setSourceRoots((roots) =>
      roots.includes(selected) || selected === path
        ? roots
        : [...roots, selected],
    );
  }

  async function save() {
    if (!workspace || !name.trim() || !path.trim()) return;
    setSaving(true);
    setError(null);
    const result = await updateProject(
      workspace.id,
      name.trim(),
      path.trim(),
      sourceRoots,
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.workspace_edit_title()}</DialogTitle>
          <DialogDescription>
            {m.workspace_edit_description()}
          </DialogDescription>
        </DialogHeader>
        <label className="grid gap-1.5 text-sm">
          {m.workspace_edit_name()}
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <section className="grid gap-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span>{m.workspace_edit_source_folders()}</span>
            {canPickDirectory && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void addSourceFolder()}
              >
                <Plus className="mr-1 size-3.5" />
                {m.workspace_edit_add_folder()}
              </Button>
            )}
          </div>
          {sourceRoots.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {m.workspace_edit_no_source_folders()}
            </p>
          ) : (
            <ul className="max-h-36 divide-y overflow-y-auto rounded-md border">
              {sourceRoots.map((root) => (
                <li key={root} className="flex items-center gap-2 px-2 py-1.5">
                  <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
                  <span
                    className="min-w-0 flex-1 truncate font-mono text-xs"
                    title={root}
                  >
                    {root}
                  </span>
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                    aria-label={`${m.workspace_edit_make_primary()}: ${root}`}
                    title={m.workspace_edit_make_primary()}
                    onClick={() => {
                      setPath(root);
                      setSourceRoots((roots) => [
                        ...roots.filter((item) => item !== root),
                        path,
                      ]);
                    }}
                  >
                    <Star className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label={`${m.workspace_edit_move_up()}: ${root}`}
                    disabled={sourceRoots.indexOf(root) === 0}
                    onClick={() =>
                      setSourceRoots((roots) => {
                        const index = roots.indexOf(root);
                        if (index <= 0) return roots;
                        const reordered = [...roots];
                        [reordered[index - 1], reordered[index]] = [
                          reordered[index],
                          reordered[index - 1],
                        ];
                        return reordered;
                      })
                    }
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label={`${m.workspace_edit_move_down()}: ${root}`}
                    disabled={
                      sourceRoots.indexOf(root) === sourceRoots.length - 1
                    }
                    onClick={() =>
                      setSourceRoots((roots) => {
                        const index = roots.indexOf(root);
                        if (index < 0 || index >= roots.length - 1)
                          return roots;
                        const reordered = [...roots];
                        [reordered[index], reordered[index + 1]] = [
                          reordered[index + 1],
                          reordered[index],
                        ];
                        return reordered;
                      })
                    }
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:text-destructive"
                    aria-label={`${m.workspace_edit_remove_folder()}: ${root}`}
                    onClick={() =>
                      setSourceRoots((roots) =>
                        roots.filter((item) => item !== root),
                      )
                    }
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <label className="grid gap-1.5 text-sm">
          {m.workspace_edit_primary_folder()}
          <span className="flex gap-2">
            <Input
              value={path}
              onChange={(event) => setPath(event.target.value)}
            />
            {canPickDirectory && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => void chooseFolder()}
                aria-label={m.workspace_edit_choose_folder()}
              >
                <FolderOpen className="size-4" />
              </Button>
            )}
          </span>
        </label>
        {workspace &&
          (path !== workspace.cwd ||
            JSON.stringify(sourceRoots) !==
              JSON.stringify(workspace.source_roots)) && (
            <p className="text-xs text-muted-foreground">
              {m.workspace_edit_trust_notice()}
            </p>
          )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {m.workspace_cancel()}
          </Button>
          <Button
            onClick={() => void save()}
            disabled={saving || !name.trim() || !path.trim()}
          >
            {saving ? m.workspace_edit_saving() : m.workspace_edit_save()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
