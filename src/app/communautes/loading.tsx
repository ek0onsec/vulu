import { AppShellSkeleton, Skel } from "@/components/AppShellSkeleton";

export default function Loading() {
  return (
    <AppShellSkeleton>
      <div className="mb-5 flex items-center justify-between">
        <Skel className="h-8 w-40 rounded-md" />
        <Skel className="h-9 w-28 rounded-full" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
            <Skel className="h-16 w-full" />
            <div className="space-y-2 p-4">
              <Skel className="h-5 w-40 rounded" />
              <Skel className="h-3 w-20 rounded" />
            </div>
          </div>
        ))}
      </div>
    </AppShellSkeleton>
  );
}
