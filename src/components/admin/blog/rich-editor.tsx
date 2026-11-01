"use client";

import * as React from "react";
import { Bold, Heading2, Heading3, Heading4, ImagePlus, Italic, Link2, List, ListOrdered, Pilcrow, Quote, Redo2, Trash2, Underline, Undo2, Unlink } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { blocksToHtml, domToBlocks, safeHref } from "@/lib/blog/rich";
import type { PostImage } from "@/lib/blog/admin";
import type { RichBlock } from "@/lib/blog/types";
import { cn } from "@/lib/utils";
import { Field, TextInput } from "../form";
import { ImageSource } from "./image-field";

/*
 * Rich-text editor without a third-party engine: a contenteditable surface driven by the browser's
 * editing commands (which also give native undo/redo). What's stored is never this HTML: every change
 * is converted to RichBlock JSON through an allowlist (src/lib/blog/rich.ts), and pastes are
 * sanitised the same way before they're inserted.
 */

type Cmd = "bold" | "italic" | "underline" | "insertUnorderedList" | "insertOrderedList";
const BLOCKS = [
  { tag: "p", label: "Paragraph", Icon: Pilcrow },
  { tag: "h2", label: "Heading 2", Icon: Heading2 },
  { tag: "h3", label: "Heading 3", Icon: Heading3 },
  { tag: "h4", label: "Heading 4", Icon: Heading4 },
  { tag: "blockquote", label: "Quote", Icon: Quote },
] as const;

const exec = (cmd: string, value?: string) => document.execCommand(cmd, false, value);

function ToolButton({ label, onClick, active, disabled, children }: { label: string; onClick: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep the editor's selection: toolbar clicks must not move focus.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn("grid size-9 shrink-0 place-items-center rounded-lg text-foreground/75 transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:opacity-40", active && "bg-secondary text-primary")}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-6 w-px shrink-0 bg-border" aria-hidden />;

export function RichEditor({ initial, onChange, invalid, describedBy }: { initial: RichBlock[]; onChange: (blocks: RichBlock[]) => void; invalid?: boolean; describedBy?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const saved = React.useRef<Range | null>(null);
  const [active, setActive] = React.useState<{ block: string; marks: Record<Cmd, boolean> }>({ block: "p", marks: { bold: false, italic: false, underline: false, insertUnorderedList: false, insertOrderedList: false } });
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkValue, setLinkValue] = React.useState("");
  const [linkError, setLinkError] = React.useState<string | null>(null);
  const [imageOpen, setImageOpen] = React.useState(false);
  const [pendingImage, setPendingImage] = React.useState<PostImage | null>(null);
  const [imgAlt, setImgAlt] = React.useState("");
  const [imgCaption, setImgCaption] = React.useState("");
  // DOM nodes inside the editor live in refs (React never renders them); booleans drive the UI.
  const figureRef = React.useRef<HTMLElement | null>(null);
  const editingRef = React.useRef<HTMLElement | null>(null);
  const [figureSelected, setFigureSelected] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const selectFigure = (el: HTMLElement | null) => {
    figureRef.current = el;
    setFigureSelected(Boolean(el));
  };

  // The editor owns its DOM after the first render; React never re-renders its children.
  React.useEffect(() => {
    if (ref.current) ref.current.innerHTML = blocksToHtml(initial);
    document.execCommand("defaultParagraphSeparator", false, "p");
    // Only the initial value seeds the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = React.useCallback(() => {
    if (ref.current) onChange(domToBlocks(ref.current));
  }, [onChange]);

  const refresh = React.useCallback(() => {
    const sel = window.getSelection();
    if (!sel?.rangeCount || !ref.current?.contains(sel.anchorNode)) return;
    let block = "p";
    for (let n: Node | null = sel.anchorNode; n && n !== ref.current; n = n.parentNode) {
      if (n.nodeType === 1 && /^(H2|H3|H4|BLOCKQUOTE|P)$/.test((n as Element).tagName)) {
        block = (n as Element).tagName.toLowerCase();
        break;
      }
    }
    const q = (c: Cmd) => {
      try {
        return document.queryCommandState(c);
      } catch {
        return false;
      }
    };
    setActive({ block, marks: { bold: q("bold"), italic: q("italic"), underline: q("underline"), insertUnorderedList: q("insertUnorderedList"), insertOrderedList: q("insertOrderedList") } });
  }, []);

  React.useEffect(() => {
    document.addEventListener("selectionchange", refresh);
    return () => document.removeEventListener("selectionchange", refresh);
  }, [refresh]);

  const run = (fn: () => void) => {
    ref.current?.focus();
    fn();
    emit();
    refresh();
  };
  const saveSelection = () => {
    const sel = window.getSelection();
    saved.current = sel?.rangeCount && ref.current?.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
  };
  const restoreSelection = () => {
    ref.current?.focus();
    const sel = window.getSelection();
    if (saved.current && sel) {
      sel.removeAllRanges();
      sel.addRange(saved.current);
    } else if (ref.current && sel) {
      const r = document.createRange();
      r.selectNodeContents(ref.current);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
    }
  };

  const openLink = () => {
    saveSelection();
    let href = "";
    for (let n: Node | null = saved.current?.startContainer ?? null; n && n !== ref.current; n = n.parentNode) if (n.nodeType === 1 && (n as Element).tagName === "A") href = (n as Element).getAttribute("href") ?? "";
    setLinkValue(href);
    setLinkError(null);
    setLinkOpen(true);
  };
  const applyLink = (e: React.FormEvent) => {
    e.preventDefault();
    const href = safeHref(linkValue);
    if (!href) return setLinkError("Use a site path like /help, or a full https:// address.");
    setLinkOpen(false);
    restoreSelection();
    run(() => {
      if (saved.current?.collapsed) exec("insertHTML", `<a href="${href.replace(/"/g, "&quot;")}">${href.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</a>`);
      else exec("createLink", href);
    });
  };

  const openImage = (fig?: HTMLElement) => {
    if (fig) {
      const img = fig.querySelector("img");
      editingRef.current = fig;
      setEditing(true);
      setPendingImage(img ? { id: "", src: img.getAttribute("src") ?? "", width: Number(img.getAttribute("width")) || 0, height: Number(img.getAttribute("height")) || 0, mime: "" } : null);
      setImgAlt(img?.getAttribute("alt") ?? "");
      setImgCaption(fig.querySelector("figcaption")?.textContent ?? "");
    } else {
      saveSelection();
      editingRef.current = null;
      setEditing(false);
      setPendingImage(null);
      setImgAlt("");
      setImgCaption("");
    }
    setImageOpen(true);
  };
  const insertImage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingImage || !imgAlt.trim()) return;
    const html = blocksToHtml([{ type: "img", src: pendingImage.src, alt: imgAlt.trim(), ...(imgCaption.trim() ? { caption: imgCaption.trim() } : {}), ...(pendingImage.width ? { width: pendingImage.width, height: pendingImage.height } : {}) }]);
    setImageOpen(false);
    const target = editingRef.current;
    if (target) {
      target.outerHTML = html;
      editingRef.current = null;
      selectFigure(null);
      emit();
      return;
    }
    restoreSelection();
    run(() => exec("insertHTML", `${html}<p><br></p>`));
  };
  const removeFigure = () => {
    figureRef.current?.remove();
    selectFigure(null);
    emit();
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    let blocks: RichBlock[];
    // Event-handler attributes are neutralised before parsing (the parsed document is inert, but this avoids even a blocked attempt).
    if (html) blocks = domToBlocks(new DOMParser().parseFromString(html.replace(/\s(on[a-z]+)\s*=/gi, " data-removed-$1="), "text/html").body);
    else
      blocks = text
        .split(/\r?\n\s*\r?\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => ({ type: "p" as const, runs: [{ text: p }] }));
    if (!blocks.length) return;
    // A single pasted paragraph goes inline; anything longer is inserted as blocks.
    const single = blocks.length === 1 && blocks[0].type === "p";
    const out = single ? blocksToHtml(blocks).replace(/^<p>|<\/p>$/g, "") : blocksToHtml(blocks);
    run(() => exec("insertHTML", out));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openLink();
    }
  };

  const onClick = (e: React.MouseEvent) => {
    const fig = (e.target as Element).closest("figure[data-rich-img]");
    selectFigure(fig as HTMLElement | null);
  };

  return (
    <div className={cn("overflow-clip rounded-2xl border bg-background transition-colors focus-within:border-primary/50 focus-within:ring-3 focus-within:ring-primary/15 dark:bg-muted/20", invalid && "border-destructive/60")}>
      <div role="toolbar" aria-label="Formatting" aria-controls="post-content" className="sticky top-16 z-10 flex flex-wrap items-center gap-0.5 border-b bg-card/95 px-2 py-1.5 backdrop-blur">
        {BLOCKS.map(({ tag, label, Icon }) => (
          <ToolButton key={tag} label={label} active={active.block === tag} onClick={() => run(() => exec("formatBlock", `<${tag}>`))}>
            <Icon className="size-4" aria-hidden />
          </ToolButton>
        ))}
        <Sep />
        <ToolButton label="Bold (Ctrl+B)" active={active.marks.bold} onClick={() => run(() => exec("bold"))}>
          <Bold className="size-4" aria-hidden />
        </ToolButton>
        <ToolButton label="Italic (Ctrl+I)" active={active.marks.italic} onClick={() => run(() => exec("italic"))}>
          <Italic className="size-4" aria-hidden />
        </ToolButton>
        <ToolButton label="Underline (Ctrl+U)" active={active.marks.underline} onClick={() => run(() => exec("underline"))}>
          <Underline className="size-4" aria-hidden />
        </ToolButton>
        <ToolButton label="Add link (Ctrl+K)" onClick={openLink}>
          <Link2 className="size-4" aria-hidden />
        </ToolButton>
        <ToolButton label="Remove link" onClick={() => run(() => exec("unlink"))}>
          <Unlink className="size-4" aria-hidden />
        </ToolButton>
        <Sep />
        <ToolButton label="Bulleted list" active={active.marks.insertUnorderedList} onClick={() => run(() => exec("insertUnorderedList"))}>
          <List className="size-4" aria-hidden />
        </ToolButton>
        <ToolButton label="Numbered list" active={active.marks.insertOrderedList} onClick={() => run(() => exec("insertOrderedList"))}>
          <ListOrdered className="size-4" aria-hidden />
        </ToolButton>
        <ToolButton label="Insert image" onClick={() => openImage()}>
          <ImagePlus className="size-4" aria-hidden />
        </ToolButton>
        <Sep />
        <ToolButton label="Undo (Ctrl+Z)" onClick={() => run(() => exec("undo"))}>
          <Undo2 className="size-4" aria-hidden />
        </ToolButton>
        <ToolButton label="Redo (Ctrl+Shift+Z)" onClick={() => run(() => exec("redo"))}>
          <Redo2 className="size-4" aria-hidden />
        </ToolButton>
      </div>
      {figureSelected ? (
        <div className="flex flex-wrap items-center gap-2 border-b bg-secondary/40 px-3 py-2 text-sm">
          <span className="font-semibold">Image selected</span>
          <button type="button" onClick={() => figureRef.current && openImage(figureRef.current)} className="rounded-full px-2.5 py-1 text-xs font-semibold text-primary hover:bg-card">
            Edit alt text &amp; caption
          </button>
          <button type="button" onClick={removeFigure} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10">
            <Trash2 className="size-3.5" aria-hidden /> Remove image
          </button>
        </div>
      ) : null}
      <div
        ref={ref}
        id="post-content"
        role="textbox"
        aria-multiline="true"
        aria-label="Post content"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        onInput={emit}
        onBlur={emit}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        onClick={onClick}
        onDrop={(e) => e.dataTransfer.files.length && e.preventDefault()}
        className="rich-editor min-h-[26rem] px-5 py-5 text-[1.02rem] leading-[1.75] outline-none sm:px-8 sm:py-7"
      />

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={applyLink} className="space-y-4">
            <div>
              <DialogTitle className="font-heading text-lg font-bold">Add a link</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">Link to a Sociotix page (for example /help or /blog/another-post) or a full https:// address.</DialogDescription>
            </div>
            <Field id="link-url" label="Link address" error={linkError}>
              <TextInput id="link-url" autoFocus value={linkValue} onChange={(e) => setLinkValue(e.target.value)} placeholder="/help or https://…" aria-invalid={linkError ? true : undefined} />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setLinkOpen(false)} className="h-10 rounded-full border px-4 text-sm font-semibold hover:bg-muted">
                Cancel
              </button>
              <button type="submit" className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                Apply link
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={imageOpen} onOpenChange={setImageOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={insertImage} className="space-y-4">
            <div>
              <DialogTitle className="font-heading text-lg font-bold">{editing ? "Edit image" : "Insert an image"}</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">Images are stored on Sociotix. Alt text is required so everyone can follow the post.</DialogDescription>
            </div>
            {pendingImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- uploaded image preview
              <img src={pendingImage.src} alt="" className="max-h-56 w-full rounded-xl border object-contain" />
            ) : (
              <ImageSource id="inline-image" onAdded={setPendingImage} />
            )}
            <Field id="inline-alt" label="Alt text" help="What the image shows, in a short sentence.">
              <TextInput id="inline-alt" value={imgAlt} maxLength={200} onChange={(e) => setImgAlt(e.target.value)} required />
            </Field>
            <Field id="inline-caption" label="Caption" optional>
              <TextInput id="inline-caption" value={imgCaption} maxLength={300} onChange={(e) => setImgCaption(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setImageOpen(false)} className="h-10 rounded-full border px-4 text-sm font-semibold hover:bg-muted">
                Cancel
              </button>
              <button type="submit" disabled={!pendingImage || !imgAlt.trim()} className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {editing ? "Save image" : "Insert image"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
