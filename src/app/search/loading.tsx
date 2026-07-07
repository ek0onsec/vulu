import { AppShellSkeleton, Skel } from "@/components/AppShellSkeleton";

export default function Loading() {
  return (
    <AppShellSkeleton>
      <Skel className="mb-4 h-11 w-full rounded-full" />
      <div className="mb-4 space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <Skel className="h-10 w-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skel className="h-3 w-40 rounded" />
              <Skel className="h-3 w-24 rounded" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skel key={i} className="aspect-[2/3] rounded-xl" />)}
      </div>
    </AppShellSkeleton>
  );
}
