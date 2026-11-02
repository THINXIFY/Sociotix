"use client";

import * as React from "react";
import { Check, Lock, Pencil, Plus, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { AdminCategory } from "@/lib/blog/admin";
import { BLOG_CATEGORIES } from "@/lib/blog/types";
import { Field, TextInput } from "../form";
import { blogApi, ConfirmDialog } from "./shared";

/* Categories in the admin: built-in ones plus custom categories admins add, rename and delete. Used by the blog and the Digital Products marketplace. */

export interface CategoryScope {
  endpoint: string;
  builtIn: AdminCategory[];
  /** What a category holds, singular ("post" | "product"). */
  noun: string;
  /** Where custom categories show up publicly. */
  where: string;
}

export const BLOG_CATEGORY_SCOPE: CategoryScope = { endpoint: "/api/admin/blog/categories", builtIn: BLOG_CATEGORIES.map((c) => ({ id: c.id, key: null, name: c.name, description: "", builtIn: true, postCount: 0 })), noun: "post", where: "the blog" };

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/** The category list (built-in shown immediately; custom ones once loaded). */
export function useCategories(scope: CategoryScope = BLOG_CATEGORY_SCOPE) {
  const { endpoint } = scope;
  const [categories, setCategories] = React.useState<AdminCategory[]>(scope.builtIn);
  const [version, setVersion] = React.useState(0);
  React.useEffect(() => {
    let cancelled = false;
    blogApi<{ categories: AdminCategory[] }>(endpoint).then(
      (r) => !cancelled && setCategories(r.categories),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [version, endpoint]);
  return { categories, reload: () => setVersion((v) => v + 1), add: (c: AdminCategory) => setCategories((xs) => [...xs, c]) };
}

type ApiError = Error & { field?: string };

/** Small form to add a custom category; used by the manager and the editor. */
function AddCategoryForm({ scope, onAdded, autoFocus }: { scope: CategoryScope; onAdded: (c: AdminCategory) => void; autoFocus?: boolean }) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    setError(null);
    try {
      const { category } = await blogApi<{ category: AdminCategory }>(scope.endpoint, { method: "POST", body: JSON.stringify({ name, description }) });
      setName("");
      setDescription("");
      onAdded(category);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <Field id="new-category-name" label="Category name" error={error}>
        <TextInput id="new-category-name" autoFocus={autoFocus} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Case Studies" aria-invalid={error ? true : undefined} />
      </Field>
      <Field id="new-category-description" label="Description" optional>
        <TextInput id="new-category-description" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} placeholder={`What ${scope.noun}s in this category cover`} />
      </Field>
      <button type="submit" disabled={busy || !name.trim()} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
        <Plus className="size-4" aria-hidden /> {busy ? "Adding…" : "Add category"}
      </button>
    </form>
  );
}

/** Quick "New category" from the editor: creates it and hands it back to be selected. */
export function NewCategoryDialog({ open, onClose, onAdded, scope = BLOG_CATEGORY_SCOPE }: { open: boolean; onClose: () => void; onAdded: (c: AdminCategory) => void; scope?: CategoryScope }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <div>
          <DialogTitle className="font-heading text-lg font-bold">New category</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">It appears on {scope.where} once it has a published {scope.noun}.</DialogDescription>
        </div>
        <AddCategoryForm scope={scope} autoFocus onAdded={(c) => (onAdded(c), onClose())} />
      </DialogContent>
    </Dialog>
  );
}

function CategoryRow({ scope, c, onChanged, onDelete }: { scope: CategoryScope; c: AdminCategory; onChanged: () => void; onDelete: (c: AdminCategory) => void }) {
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(c.name);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await blogApi(`${scope.endpoint}/${c.key}`, { method: "PATCH", body: JSON.stringify({ name, description: c.description }) });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <TextInput aria-label={`Rename ${c.name}`} value={name} maxLength={60} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => (e.key === "Enter" ? void save() : e.key === "Escape" ? setEditing(false) : undefined)} />
          ) : (
            <p className="truncate text-sm font-semibold">{c.name}</p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {plural(c.postCount, scope.noun)}
            {c.builtIn ? " · Built-in" : ""}
          </p>
        </div>
        {c.builtIn ? (
          <Lock className="size-4 shrink-0 text-muted-foreground" aria-label="Built-in category (can't be changed)" />
        ) : editing ? (
          <>
            <button type="button" onClick={save} disabled={busy || !name.trim()} aria-label="Save name" className="grid size-9 place-items-center rounded-full text-ok hover:bg-ok-soft disabled:opacity-50">
              <Check className="size-4" aria-hidden />
            </button>
            <button type="button" onClick={() => (setEditing(false), setName(c.name), setError(null))} aria-label="Cancel" className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted">
              <X className="size-4" aria-hidden />
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setEditing(true)} aria-label={`Rename ${c.name}`} className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
              <Pencil className="size-4" aria-hidden />
            </button>
            <button type="button" onClick={() => onDelete(c)} aria-label={`Delete ${c.name}`} className="grid size-9 place-items-center rounded-full text-destructive hover:bg-destructive/10">
              <Trash2 className="size-4" aria-hidden />
            </button>
          </>
        )}
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}

/** Side panel listing every category, with add, rename and delete for custom ones. */
export function CategoryManager({ open, onClose, canManage, onChanged, scope = BLOG_CATEGORY_SCOPE }: { open: boolean; onClose: () => void; canManage: boolean; onChanged: () => void; scope?: CategoryScope }) {
  const { categories, reload } = useCategories(scope);
  const [pending, setPending] = React.useState<AdminCategory | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const changed = () => (reload(), onChanged());
  React.useEffect(() => {
    if (open) reload();
    // Refresh counts each time the panel opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const remove = async () => {
    if (!pending?.key) return;
    setBusy(true);
    setError(null);
    try {
      await blogApi(`${scope.endpoint}/${pending.key}`, { method: "DELETE" });
      setPending(null);
      changed();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const custom = categories.filter((c) => !c.builtIn);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" showCloseButton={false} className="w-full gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <div className="flex items-start gap-3 border-b px-5 py-4">
          <div className="min-w-0 flex-1">
            <SheetTitle className="font-heading text-lg font-bold">Categories</SheetTitle>
            <SheetDescription className="mt-0.5 text-sm text-muted-foreground">Custom categories appear on {scope.where} once they have a published {scope.noun}.</SheetDescription>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {canManage ? (
            <section aria-labelledby="add-category-title" className="rounded-2xl border p-4">
              <h3 id="add-category-title" className="mb-3 text-sm font-bold">
                Add a category
              </h3>
              <AddCategoryForm scope={scope} onAdded={changed} />
            </section>
          ) : null}
          <section aria-labelledby="custom-categories-title">
            <h3 id="custom-categories-title" className="mb-2 text-sm font-bold">
              Custom categories
            </h3>
            {custom.length ? (
              <ul className="divide-y rounded-2xl border">
                {custom.map((c) => (canManage ? <CategoryRow key={c.key} scope={scope} c={c} onChanged={changed} onDelete={(x) => (setError(null), setPending(x))} /> : <CategoryRow key={c.key} scope={scope} c={{ ...c, builtIn: true }} onChanged={changed} onDelete={() => {}} />))}
              </ul>
            ) : (
              <p className="rounded-2xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">No custom categories yet.</p>
            )}
          </section>
          <section aria-labelledby="builtin-categories-title">
            <h3 id="builtin-categories-title" className="mb-2 text-sm font-bold">
              Built-in categories
            </h3>
            <ul className="divide-y rounded-2xl border">
              {categories
                .filter((c) => c.builtIn)
                .map((c) => (
                  <CategoryRow key={c.id} scope={scope} c={c} onChanged={changed} onDelete={() => {}} />
                ))}
            </ul>
          </section>
        </div>
      </SheetContent>
      <ConfirmDialog
        open={Boolean(pending)}
        busy={busy}
        error={error}
        danger
        title="Delete this category?"
        description={pending?.postCount ? <>“{pending.name}” is used by {plural(pending.postCount, scope.noun)}. Move {pending.postCount === 1 ? "it" : "them"} to another category first.</> : <>“{pending?.name}” will be removed. This can&apos;t be undone.</>}
        confirmLabel="Delete category"
        onConfirm={remove}
        onClose={() => setPending(null)}
      />
    </Sheet>
  );
}
