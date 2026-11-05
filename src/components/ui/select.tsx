import { Select as SelectPrimitive } from "@base-ui/react/select"
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export interface SelectOption {
  value: string
  label: ReactNode
  disabled?: boolean
}

// Styled replacement for <select>: a trigger like <Input> and a list like the dropdown menus, in
// both themes. Values are strings; "" means nothing chosen (the placeholder shows).
function Select({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  className,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: {
  id?: string
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  placeholder?: ReactNode
  disabled?: boolean
  className?: string
  "aria-label"?: string
  "aria-invalid"?: boolean
}) {
  return (
    <SelectPrimitive.Root
      id={id}
      items={options.map(({ value, label }) => ({ value, label }))}
      value={value === "" ? null : value}
      onValueChange={(next) => onValueChange(next ?? "")}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        data-slot="select-trigger"
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid || undefined}
        className={cn(
          "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-left text-sm transition-colors outline-none select-none",
          "hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:border-ring data-popup-open:ring-3 data-popup-open:ring-ring/30",
          "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:hover:bg-input/50",
          className
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} className="truncate data-placeholder:text-muted-foreground" />
        <SelectPrimitive.Icon className="flex shrink-0 text-muted-foreground transition-transform duration-150 in-data-popup-open:rotate-180">
          <ChevronDownIcon className="size-4" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner className="isolate z-50 outline-none" sideOffset={4} alignItemWithTrigger={false}>
          <SelectPrimitive.Popup
            data-slot="select-content"
            className="max-h-[min(20rem,var(--available-height))] min-w-(--anchor-width) origin-(--transform-origin) overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            <SelectPrimitive.List>
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className="relative flex cursor-default items-center rounded-md py-1.5 pr-8 pl-2.5 text-sm outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground data-selected:font-medium"
                >
                  <SelectPrimitive.ItemText className="truncate">{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="absolute right-2 flex text-primary">
                    <CheckIcon className="size-4" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

export { Select }
