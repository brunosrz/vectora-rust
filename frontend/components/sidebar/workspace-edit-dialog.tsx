"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, FolderOpen, Plus, Star, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FileManagerDialog } from "@/components/files/file-manager-dialog";
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
import {
  getSandboxPolicy,
  putSandboxPolicy,
  type SandboxPolicy,
  type SandboxPolicyInput,
} from "@/lib/api/sandbox";

const environmentLines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

function WorkspaceEnvironmentSettings({
  workspace,
}: {
  workspace: WorkspaceInfo;
}) {
  const queryClient = useQueryClient();
  const policy = useQuery({
    queryKey: ["sandbox", workspace.id, "policy"],
    queryFn: () => getSandboxPolicy(workspace.id),
  });
  const [seenPolicy, setSeenPolicy] = useState<SandboxPolicy | undefined>();
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  if (policy.data !== seenPolicy) {
    setSeenPolicy(policy.data);
    setDraft(policy.data?.env_pass.join("\n") ?? null);
  }

  async function saveEnvironment() {
    if (!policy.data || draft === null || !workspace.trusted) return;
    setSaving(true);
    setMessage(null);
    const current = policy.data;
    const input: SandboxPolicyInput = {
      enabled: current.enabled,
      rw_paths: current.rw_paths,
      ro_paths: current.ro_paths,
      mask: current.mask,
      no_gpu: current.no_gpu,
      lockdown: current.lockdown,
      allow_tcp_ports: current.allow_tcp_ports,
      env_pass: environmentLines(draft),
      git_writable: current.git_writable,
      require_full_isolation: current.require_full_isolation,
      network: current.network,
      allow_hosts: current.allow_hosts,
      credential_bindings: current.credential_bindings,
      registry_hosts: current.registry_hosts,
      max_file_mb: current.max_file_mb,
      memory_limit_mb: current.memory_limit_mb,
      tmp_size_mb: current.tmp_size_mb,
    };
    try {
      await putSandboxPolicy(workspace.id, input);
      setMessage({ ok: true, text: m.workspace_environment_saved() });
      await queryClient.invalidateQueries({
        queryKey: ["sandbox", workspace.id],
      });
    } catch (error) {
      setMessage({
        ok: false,
        text: m.workspace_environment_save_error({
          error: error instanceof Error ? error.message : String(error),
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid gap-2 border-t pt-4 text-sm">
      <div>
        <h3 className="font-medium">{m.workspace_environment_title()}</h3>
        <p className="text-xs text-muted-foreground">
          {m.workspace_environment_description()}
        </p>
      </div>
      {policy.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {m.workspace_environment_load_error({
            error:
              policy.error instanceof Error
                ? policy.error.message
                : String(policy.error),
          })}
        </p>
      ) : policy.isLoading || draft === null ? (
        <p className="text-xs text-muted-foreground">
          {m.workspace_environment_loading()}
        </p>
      ) : (
        <>
          {!workspace.trusted && (
            <p className="text-xs text-warning">
              {m.workspace_environment_untrusted()}
            </p>
          )}
          <label className="grid gap-1.5">
            {m.workspace_environment_variables()}
            <textarea
              rows={3}
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70"
              value={draft}
              disabled={!workspace.trusted || saving}
              onChange={(event) => setDraft(event.target.value)}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            {m.workspace_environment_values_hint()}
          </p>
          {message && (
            <p
              role={message.ok ? "status" : "alert"}
              className={
                message.ok ? "text-xs text-success" : "text-xs text-destructive"
              }
            >
              {message.text}
            </p>
          )}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!workspace.trusted || saving}
              onClick={() => void saveEnvironment()}
            >
              {saving
                ? m.workspace_environment_saving()
                : m.workspace_environment_save()}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

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
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [folderPickerTarget, setFolderPickerTarget] = useState<
    "primary" | "source"
  >("primary");

  function selectFolder(selected: string) {
    if (folderPickerTarget === "primary") {
      setPath(selected);
      setSourceRoots((roots) => roots.filter((root) => root !== selected));
      return;
    }
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
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{m.workspace_edit_title()}</DialogTitle>
          <DialogDescription>
            {m.workspace_edit_description()}
          </DialogDescription>
        </DialogHeader>
        <details className="rounded-md border px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium">
            {m.workspace_edit_manual_title()}
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
            <li>{m.workspace_edit_manual_open()}</li>
            <li>{m.workspace_edit_manual_name()}</li>
            <li>{m.workspace_edit_manual_folders()}</li>
            <li>{m.workspace_edit_manual_environment()}</li>
            <li>{m.workspace_edit_manual_save()}</li>
          </ol>
        </details>
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setFolderPickerTarget("source");
                setFolderPickerOpen(true);
              }}
            >
              <Plus className="mr-1 size-3.5" />
              {m.workspace_edit_add_folder()}
            </Button>
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
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                setFolderPickerTarget("primary");
                setFolderPickerOpen(true);
              }}
              aria-label={m.workspace_edit_choose_folder()}
            >
              <FolderOpen className="size-4" />
            </Button>
          </span>
        </label>
        {workspace?.transport === "local" && (
          <WorkspaceEnvironmentSettings
            key={workspace.id}
            workspace={workspace}
          />
        )}
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
      <FileManagerDialog
        open={folderPickerOpen}
        onOpenChange={setFolderPickerOpen}
        selection="folder"
        initialPath={folderPickerTarget === "primary" ? path : undefined}
        onSelect={selectFolder}
      />
    </Dialog>
  );
}
