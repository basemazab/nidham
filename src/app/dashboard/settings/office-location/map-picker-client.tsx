"use client";

// Thin wrapper that loads the real map picker only on the client.
// Leaflet calls `window` at module init -- if we let Next.js try to
// render this on the server, the page crashes during SSR with
// "window is not defined".
//
// `next/dynamic({ ssr: false })` defers the import until after
// hydration. The initial render shows the skeleton so the layout
// doesn't jump when the map mounts.

import dynamic from "next/dynamic";

const OfficeMapPicker = dynamic(
  () => import("./map-picker").then((m) => m.OfficeMapPicker),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border-2 border-slate-200 bg-slate-50 h-[320px] flex items-center justify-center text-sm text-slate-500 font-cairo">
        ...جاري تحميل الخريطة
      </div>
    ),
  },
);

type Props = {
  initialLat: number | null;
  initialLng: number | null;
  initialRadius: number;
};

export function OfficeMapPickerClient(props: Props) {
  return <OfficeMapPicker {...props} />;
}
