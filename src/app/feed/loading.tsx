import { AppShellSkeleton, Skel } from "@/components/AppShellSkeleton";

export default function Loading() {
  return (
    <AppShellSkeleton>
      <div className="mb-3 flex gap-1.5 rounded-2xl border border-[var(--color-border)] p-1.5">
        {Array.from({ length: 3 }).map((_, i) => <Skel key={i} className="h-10 flex-1 rounded-xl" />)}
      </div>
      <Skel className="mb-4 h-11 w-full rounded-2xl" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-[var(--color-border)] p-4">
            <div className="flex gap-3">
              <Skel className="h-10 w-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skel className="h-3 w-32 rounded" />
                <Skel className="h-3 w-24 rounded" />
                <Skel className="mt-2 h-24 w-full rounded-xl" />
                <div className="flex gap-2 pt-1">
                  <Skel className="h-7 w-16 rounded-full" />
                  <Skel className="h-7 w-16 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppShellSkeleton>
  );
}
