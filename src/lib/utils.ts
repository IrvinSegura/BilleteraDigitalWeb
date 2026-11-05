import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Joins class names, letting a later Tailwind class override an earlier one (`px-2` then `px-4` keeps `px-4`). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
