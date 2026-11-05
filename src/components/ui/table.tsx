"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// stickyHeader: from tablets up, the header row stays under the app bar (h-16) while the page
// scrolls. The container then can't scroll sideways (it would become the sticky's scroller); its
// columns already hide on narrow screens, and phones keep the sideways scroll without the sticky.
function Table({ className, stickyHeader = false, ...props }: React.ComponentProps<"table"> & { stickyHeader?: boolean }) {
  return (
    <div
      data-slot="table-container"
      className={cn("relative w-full overflow-x-auto", stickyHeader && "md:overflow-visible")}
    >
      <table
        data-slot="table"
        className={cn(
          "w-full caption-bottom text-sm",
          stickyHeader &&
            "md:[&_thead_th]:sticky md:[&_thead_th]:top-16 md:[&_thead_th]:z-10 md:[&_thead_th]:bg-[color-mix(in_oklch,var(--muted)_50%,var(--card))] md:[&_thead_th]:shadow-[inset_0_-1px_0_var(--border)]",
          className
        )}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
