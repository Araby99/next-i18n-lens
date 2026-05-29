import { clsx, type ClassValue } from 'clsx';

// Wait, the regular export of tailwind-merge has twMerge
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
