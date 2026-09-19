import type { HTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "resize-y leading-relaxed", className)} {...props} />;
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-xs font-medium text-zinc-500", className)} {...props} />;
}

export function Badge({
  className,
  tone = "zinc",
  ...props
}: { tone?: "zinc" | "indigo" | "emerald" | "amber" | "red" | "sky" } & HTMLAttributes<HTMLSpanElement>) {
  const tones: Record<string, string> = {
    zinc: "bg-zinc-200 text-zinc-700",
    indigo: "bg-indigo-100 text-indigo-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-700",
    sky: "bg-sky-100 text-sky-700",
  };
  return (
    <span
      className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium", tones[tone], className)}
      {...props}
    />
  );
}
