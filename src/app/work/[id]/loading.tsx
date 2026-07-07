import { AppShellSkeleton, Skel } from "@/components/AppShellSkeleton";

export default function Loading() {
  return (
    <AppShellSkeleton>
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
        <Skel className="h-32 w-full" />
        <div className="flex gap-4 px-5 pb-5">
          <Skel className="-mt-12 h-36 w-24 shrink-0 rounded-xl border-2 border-[var(--color-surface)]" />
          <div className="space-y-2 pt-3">
            <Skel className="h-6 w-48 rounded" />
            <Skel className="h-3 w-32 rounded" />
            <div className="flex gap-1.5 pt-1">
              {Array.from({ length: 3 }).map((_, i) => <Skel key={i} className="h-5 w-16 rounded-full" />)}
            </div>
          </div>
        </div>
        <div className="space-y-2 px-5 pb-5">
          {Array.from({ length: 3 }).map((_, i) => <Skel key={i} className="h-3 w-full rounded" />)}
        </div>
      </div>
      <div className="mt-4 flex gap-1 rounded-full border border-[var(--color-border)] p-1">
        {Array.from({ length: 2 }).map((_, i) => <Skel key={i} className="h-9 flex-1 rounded-full" />)}
      </div>
      <Skel className="mt-4 h-40 w-full rounded-2xl" />
    </AppShellSkeleton>
  );
}
