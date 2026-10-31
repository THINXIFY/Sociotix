"use client";

import * as React from "react";
import { Combobox } from "@base-ui/react/combobox";
import { Select as BaseSelect } from "@base-ui/react/select";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { menuItem, menuLabel, menuPopup, popupSurface } from "./menu";

/**
 * The Sociotix dropdown, shared by the public site, dashboard and admin.
 *
 * A drop-in for a native `<select>`: same props (`value`/`defaultValue`, `onChange`, `name`,
 * `required`, `disabled`, ARIA) and `<option>`/`<optgroup>` children, so call sites keep their
 * markup and form behaviour. It renders an accessible listbox with typeahead, checkmarks and
 * collision-aware placement (it flips and shrinks to stay on screen and is never clipped by
 * cards or scroll containers, because it renders in a portal). Long lists get a search field.
 */

export const selectTriggerClass =
  "w-full rounded-xl border bg-background px-3.5 text-sm transition-colors outline-none placeholder:text-muted-foreground/70 hover:border-foreground/20 focus-visible:border-primary/50 focus-visible:ring-3 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive/60 aria-invalid:focus-visible:ring-destructive/15 dark:bg-muted/30";

const SIZES = { sm: "h-8 text-[0.8rem]", md: "h-10", lg: "h-11" } as const;

type Option = { value: string; label: React.ReactNode; text: string; disabled: boolean; group?: string };

const textOf = (node: React.ReactNode): string => {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return "";
};

/** Reads `<option>`/`<optgroup>` children (also inside fragments and arrays). Like a native select, an option without `value` uses its text. */
function optionsOf(children: React.ReactNode, out: Option[] = [], group?: string) {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement<{ value?: unknown; label?: string; children?: React.ReactNode; disabled?: boolean }>(child)) return;
    if (child.type === "option") {
      const text = textOf(child.props.children);
      out.push({ value: String(child.props.value ?? text), label: child.props.children, text, disabled: Boolean(child.props.disabled), group });
    } else if (child.type === "optgroup") optionsOf(child.props.children, out, child.props.label);
    else optionsOf(child.props.children, out, group);
  });
  return out;
}

const groupsOf = (options: Option[]) => {
  const groups: { label?: string; items: Option[] }[] = [];
  for (const o of options) {
    const last = groups.at(-1);
    if (last && last.label === o.group) last.items.push(o);
    else groups.push({ label: o.group, items: [o] });
  }
  return groups;
};

export type SelectProps = Omit<React.ComponentProps<"select">, "size"> & {
  /** Trigger height. Defaults to `md` (40px). */
  size?: keyof typeof SIZES;
  /** Show a search field in the list. Defaults to on for more than 12 options. */
  searchable?: boolean;
  /** Text for the search field. */
  searchPlaceholder?: string;
  /** Replaces the selected value inside the trigger (for icon-only or custom triggers). Keep an `aria-label`. */
  trigger?: React.ReactNode;
  /** Shown when nothing is selected and no option has an empty value. */
  placeholder?: string;
  popupClassName?: string;
};

function emitChange(onChange: SelectProps["onChange"], value: string, name?: string) {
  const target = { value, name };
  onChange?.({ target, currentTarget: target } as unknown as React.ChangeEvent<HTMLSelectElement>);
}

export function Select({
  id,
  name,
  value,
  defaultValue,
  onChange,
  children,
  className,
  popupClassName,
  disabled,
  required,
  size = "md",
  searchable,
  searchPlaceholder = "Search…",
  trigger,
  placeholder,
  onBlur,
  "aria-required": ariaRequired,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: SelectProps) {
  const options = optionsOf(children);
  const controlled = value !== undefined;
  const [inner, setInner] = React.useState(String(defaultValue ?? options[0]?.value ?? ""));
  const current = controlled ? String(value ?? "") : inner;
  const choose = (v: string) => {
    if (!controlled) setInner(v);
    emitChange(onChange, v, name);
  };
  const triggerProps = {
    id,
    "aria-required": ariaRequired,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    className: cn(
      selectTriggerClass,
      SIZES[size],
      "flex cursor-default items-center justify-between gap-2 pe-2.5 text-start data-popup-open:border-primary/50 data-popup-open:ring-3 data-popup-open:ring-primary/15",
      className,
    ),
  };
  const chevron = <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 in-data-popup-open:rotate-180 motion-reduce:transition-none" aria-hidden />;
  const popupWidth = "max-w-[min(22rem,calc(100vw-1.5rem))] min-w-(--anchor-width)";
  const check = <Check className="size-4 text-primary" strokeWidth={2.5} aria-hidden />;

  if (searchable ?? options.length > 12) {
    const selected = options.find((o) => o.value === current) ?? null;
    return (
      <Combobox.Root
        items={options}
        value={selected}
        onValueChange={(o: Option | null) => o && choose(o.value)}
        itemToStringLabel={(o: Option) => o.text}
        itemToStringValue={(o: Option) => o.value}
        isItemEqualToValue={(a: Option, b: Option) => a.value === b.value}
        name={name}
        required={required}
        disabled={disabled}
      >
        <Combobox.Trigger {...triggerProps} onBlur={onBlur as React.FocusEventHandler<HTMLButtonElement> | undefined}>
          <span className={cn("min-w-0 truncate", !selected && "text-muted-foreground")}>{trigger ?? selected?.label ?? placeholder ?? "Choose…"}</span>
          {chevron}
        </Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner sideOffset={6} collisionPadding={12} className="z-[60] outline-none">
            <Combobox.Popup className={cn(popupSurface, popupWidth, "flex max-h-[min(26rem,var(--available-height))] flex-col overflow-hidden", popupClassName)}>
              <div className="relative border-b p-1.5">
                <Search className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Combobox.Input placeholder={searchPlaceholder} aria-label={searchPlaceholder} className="h-9 w-full rounded-lg bg-transparent ps-9 pe-2.5 text-sm outline-none placeholder:text-muted-foreground/70 focus-visible:bg-muted/50" />
              </div>
              <Combobox.Empty className="px-3 py-6 text-center text-sm text-muted-foreground empty:hidden">No matches. Try another word.</Combobox.Empty>
              <Combobox.List className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 empty:hidden">
                {(o: Option) => (
                  <Combobox.Item key={o.value} value={o} disabled={o.disabled} className={cn(menuItem, "pe-9 data-selected:font-semibold data-selected:text-primary")}>
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    <Combobox.ItemIndicator className="absolute end-2.5 flex items-center">{check}</Combobox.ItemIndicator>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    );
  }

  const items = options.map((o) => ({ value: o.value, label: o.label }));
  const groups = groupsOf(options);
  return (
    <BaseSelect.Root
      items={items}
      value={current}
      name={name}
      required={required}
      disabled={disabled}
      onValueChange={(v) => v !== null && choose(String(v))}
      onOpenChange={(open) => {
        if (!open) onBlur?.({} as React.FocusEvent<HTMLSelectElement>);
      }}
    >
      <BaseSelect.Trigger {...triggerProps}>
        {trigger ?? <BaseSelect.Value className="min-w-0 truncate" placeholder={placeholder} />}
        <BaseSelect.Icon className="flex shrink-0">{chevron}</BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner sideOffset={6} alignItemWithTrigger={false} collisionPadding={12} className="z-[60] outline-none">
          <BaseSelect.Popup className={cn(menuPopup, popupWidth, popupClassName)}>
            {groups.map((g, gi) => {
              const rows = g.items.map((o) => (
                <BaseSelect.Item key={o.value} value={o.value} disabled={o.disabled} data-value={o.value} className={cn(menuItem, "pe-9 data-selected:font-semibold data-selected:text-primary")}>
                  <BaseSelect.ItemText className="min-w-0 flex-1 truncate">{o.label}</BaseSelect.ItemText>
                  <BaseSelect.ItemIndicator className="absolute end-2.5 flex items-center">{check}</BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ));
              return g.label ? (
                <BaseSelect.Group key={`${g.label}-${gi}`}>
                  <BaseSelect.GroupLabel className={menuLabel}>{g.label}</BaseSelect.GroupLabel>
                  {rows}
                </BaseSelect.Group>
              ) : (
                <React.Fragment key={`g-${gi}`}>{rows}</React.Fragment>
              );
            })}
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
