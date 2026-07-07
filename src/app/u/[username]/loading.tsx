import { AppShellSkeleton, Skel } from "@/components/AppShellSkeleton";

export default function Loading() {
  return (
    <AppShellSkeleton>
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
        <Skel className="h-28 w-full" />
        <div className="px-5 pb-5">
          <div className="flex items-end gap-3">
            <Skel className="-mt-10 h-20 w-20 rounded-full ring-4 ring-[var(--color-surface)]" />
            <div className="flex-1 space-y-2 pb-1">
              <Skel className="h-5 w-40 rounded" />
              <Skel className="h-3 w-24 rounded" />
            </div>
          </div>
          <Skel className="mt-3 h-4 w-56 rounded" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => <Skel key={i} className="h-9 w-24 rounded-full" />)}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {Array.from({ length: 9 }).map((_, i) => <Skel key={i} className="aspect-[2/3] rounded-xl" />)}
      </div>
    </AppShellSkeleton>
  );
}
