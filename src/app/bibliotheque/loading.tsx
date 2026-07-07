import { AppShellSkeleton, Skel } from "@/components/AppShellSkeleton";

export default function Loading() {
  return (
    <AppShellSkeleton>
      <div className="mb-5 flex items-center justify-between">
        <Skel className="h-8 w-40 rounded-md" />
        <Skel className="h-9 w-28 rounded-full" />
      </div>
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => <Skel key={i} className="h-8 w-16 rounded-full" />)}
      </div>
      <Skel className="mb-2 h-5 w-24 rounded" />
      <div className="mb-6 flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => <Skel key={i} className="aspect-[2/3] w-32 shrink-0 rounded-xl" />)}
      </div>
      <Skel className="mb-3 h-5 w-40 rounded" />
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skel key={i} className="aspect-[4/3] rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => <Skel key={i} className="aspect-[2/3] rounded-xl" />)}
      </div>
    </AppShellSkeleton>
  );
}
