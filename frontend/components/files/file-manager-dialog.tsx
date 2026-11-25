"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  File as FileIcon,
  Folder,
  HardDrive,
  Loader2,
} from "lucide-react";

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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DRIVES_PSEUDO_PATH,
  type BrowseResult,
} from "@/lib/stores/workspaces-store";
import { m } from "@/lib/paraglide/messages";

type FileManagerSelection = "file" | "folder";

interface FileManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selection: FileManagerSelection;
  initialPath?: string;
  acceptExtensions?: string[];
  onSelect: (path: string) => void;
}

export async function readManagedFile(path: string): Promise<File> {
  const response = await fetch(
    `/workspaces/browse/file?path=${encodeURIComponent(path)}`,
    {
      credentials: "include",
    },
  );
  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as {
      detail?: string;
    };
    throw new Error(
      detail.detail ?? `Falha ao ler arquivo (${response.status}).`,
    );
  }
  const blob = await response.blob();
  if (blob.size > 50 * 1024 * 1024) {
    throw new Error("O arquivo excede o limite de 50 MiB.");
  }
  const name = path.replaceAll("\\", "/").split("/").pop() || "arquivo";
  return new File([blob], name, {
    type: blob.type || "application/octet-stream",
  });
}

interface FileManagerBrowserProps {
  listing: BrowseResult | null;
  loading: boolean;
  showFiles?: boolean;
  acceptExtensions?: string[];
  selectedFile?: string | null;
  onNavigate: (path: string) => void;
  onSelectFile?: (path: string) => void;
  className?: string;
}

/** A navegação é compartilhada pelos fluxos de confiança e pelos seletores. */
export function FileManagerBrowser({
  listing,
  loading,
  showFiles = false,
  acceptExtensions,
  selectedFile = null,
  onNavigate,
  onSelectFile,
  className = "h-64",
}: FileManagerBrowserProps) {
  const entries = listing?.entries.filter((entry) => {
    if (entry.is_dir || !showFiles || !acceptExtensions?.length) return true;
    const extension = entry.name.split(".").pop()?.toLowerCase();
    return extension ? acceptExtensions.includes(extension) : false;
  });

  return (
    <ScrollArea className={`${className} rounded-md border`}>
      <div className="p-1">
        {listing?.parent && (
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-accent"
            onClick={() => onNavigate(listing.parent!)}
            disabled={loading}
          >
            <ChevronLeft className="size-4 shrink-0 text-muted-foreground" />
            {m.file_manager_parent()}
          </button>
        )}
        {listing && !listing.at_drives_root && (
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent"
            onClick={() => onNavigate(DRIVES_PSEUDO_PATH)}
            disabled={loading}
          >
            <HardDrive className="size-4 shrink-0" />
            {m.workspace_browse_drives()}
          </button>
        )}
        {entries?.map((entry) => {
          const isSelected = selectedFile === entry.path;
          const Icon =
            entry.kind === "drive"
              ? HardDrive
              : entry.is_dir
                ? Folder
                : FileIcon;
          return (
            <button
              type="button"
              key={entry.path}
              className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-accent ${isSelected ? "bg-accent" : ""}`}
              aria-pressed={!entry.is_dir && isSelected}
              disabled={loading || (!entry.is_dir && !onSelectFile)}
              onClick={() => {
                if (entry.is_dir) onNavigate(entry.path);
                else onSelectFile?.(entry.path);
              }}
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{entry.name}</span>
              {entry.label && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {entry.label}
                </span>
              )}
              {isSelected && (
                <CheckCircle2 className="ml-auto size-4 text-primary" />
              )}
            </button>
          );
        })}
        {listing && entries?.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {m.file_manager_empty()}
          </p>
        )}
      </div>
    </ScrollArea>
  );
}

export function FileManagerDialog({
  open,
  onOpenChange,
  selection,
  initialPath,
  acceptExtensions,
  onSelect,
}: FileManagerDialogProps) {
  const [listing, setListing] = useState<BrowseResult | null>(null);
  const [pathInput, setPathInput] = useState(initialPath ?? "");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestEpoch = useRef(0);

  const load = useCallback(
    async (path?: string) => {
      const epoch = ++requestEpoch.current;
      setLoading(true);
      setError(null);
      setSelectedFile(null);
      const params = new URLSearchParams();
      if (path) params.set("path", path);
      if (selection === "file") params.set("include_files", "true");
      try {
        const response = await fetch(`/workspaces/browse?${params}`, {
          credentials: "include",
        });
        const data = (await response
          .json()
          .catch(() => ({}))) as BrowseResult & { detail?: string };
        if (!response.ok)
          throw new Error(
            data.detail ?? `Falha ao listar arquivos (${response.status}).`,
          );
        if (epoch !== requestEpoch.current) return;
        setListing(data);
        setPathInput(data.path);
      } catch (cause) {
        if (epoch !== requestEpoch.current) return;
        setListing(null);
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (epoch === requestEpoch.current) setLoading(false);
      }
    },
    [selection],
  );

  useEffect(() => {
    // Recarrega a listagem de disco ao abrir o seletor ou trocar o caminho inicial.
    // oxlint-disable-next-line react/set-state-in-effect
    if (open) void load(initialPath);
  }, [open, initialPath, load]);

  const canConfirm =
    selection === "file" ? selectedFile !== null : listing !== null;
  const confirm = () => {
    const path = selection === "file" ? selectedFile : listing?.path;
    if (!path) return;
    onSelect(path);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[min(560px,calc(100dvh-2rem))] w-full max-w-xl gap-4 overflow-hidden p-6">
        <DialogHeader>
          <DialogTitle>
            {selection === "file"
              ? m.file_manager_title_file()
              : m.file_manager_title_folder()}
          </DialogTitle>
          <DialogDescription>{m.file_manager_description()}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            value={pathInput}
            onChange={(event) => setPathInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void load(pathInput);
            }}
            aria-label={m.file_manager_location()}
            className="font-mono text-xs"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => void load(pathInput)}
            disabled={!pathInput.trim() || loading}
          >
            {m.file_manager_go()}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {loading && !listing ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {m.file_manager_loading()}
          </div>
        ) : (
          <FileManagerBrowser
            listing={listing}
            loading={loading}
            showFiles={selection === "file"}
            acceptExtensions={acceptExtensions}
            selectedFile={selectedFile}
            onNavigate={(path) => void load(path)}
            onSelectFile={selection === "file" ? setSelectedFile : undefined}
            className="h-64 max-h-[40vh]"
          />
        )}
        {selection === "file" && (
          <p className="truncate text-xs text-muted-foreground">
            {selectedFile ?? m.file_manager_no_file()}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {m.workspace_cancel()}
          </Button>
          <Button
            type="button"
            onClick={confirm}
            disabled={!canConfirm || loading}
          >
            {selection === "file"
              ? m.file_manager_select_file()
              : m.file_manager_select_folder()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
