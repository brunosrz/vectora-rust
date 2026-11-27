"use client";

import { useState } from "react";
import { FolderOpen } from "lucide-react";

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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canPickDirectory =
    typeof window !== "undefined" && Boolean(window.vectora?.pickDirectory);

  async function chooseFolder() {
    const selected = await window.vectora?.pickDirectory?.();
    if (selected) setPath(selected);
  }

  async function save() {
    if (!workspace || !name.trim() || !path.trim()) return;
    setSaving(true);
    setError(null);
    const result = await updateProject(workspace.id, name.trim(), path.trim());
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
        {workspace && path !== workspace.cwd && (
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
