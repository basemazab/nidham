"use client";

// Click-to-pick map for office location.
// We use OpenStreetMap tiles (no API key required) via Leaflet. The
// component is loaded with ssr: false from a wrapper because Leaflet
// touches `window` during module initialisation.
//
// Behaviour:
//   - Centres on the current (lat, lng) if both inputs are set; otherwise
//     defaults to Cairo (30.0444, 31.2357) at zoom 12.
//   - A click anywhere drops / moves the marker AND writes the new
//     coords to the office_lat / office_lng inputs (DOM-side, matching
//     the existing GPS-button pattern).
//   - The marker is draggable, so HR can fine-tune by 5-10 metres.
//   - A circle ring renders around the marker with radius =
//     office_radius_meters input, so HR sees the geofence in real time.

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";

// Leaflet ships its marker icon as CSS-referenced PNGs whose URLs are
// re-pathed by bundlers. Without overriding, the marker shows as a
// broken image in production. Use the official CDN copies instead.
const DefaultIcon = L.icon({
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

type Props = {
  /** Initial latitude (from saved company.office_lat). Null = unset. */
  initialLat: number | null;
  /** Initial longitude. */
  initialLng: number | null;
  /** Default geofence radius in metres. */
  initialRadius: number;
};

const CAIRO: [number, number] = [30.0444, 31.2357];

export function OfficeMapPicker({
  initialLat,
  initialLng,
  initialRadius,
}: Props) {
  // Local state mirrors the form inputs so the marker re-renders
  // immediately on click without waiting for a state round-trip
  // through the DOM.
  const [lat, setLat] = useState<number | null>(initialLat);
  const [lng, setLng] = useState<number | null>(initialLng);
  const [radius, setRadius] = useState<number>(initialRadius);

  // Watch the radius input so the circle preview tracks edits live.
  useEffect(() => {
    const radiusInput = document.getElementById(
      "office_radius_meters",
    ) as HTMLInputElement | null;
    if (!radiusInput) return;
    const handler = () => {
      const n = parseInt(radiusInput.value, 10);
      if (Number.isFinite(n) && n > 0) setRadius(n);
    };
    radiusInput.addEventListener("input", handler);
    return () => radiusInput.removeEventListener("input", handler);
  }, []);

  // Watch the lat/lng inputs too -- the GPS button writes there
  // directly, and we want the map to recentre when it does.
  useEffect(() => {
    const latInput = document.getElementById(
      "office_lat",
    ) as HTMLInputElement | null;
    const lngInput = document.getElementById(
      "office_lng",
    ) as HTMLInputElement | null;
    if (!latInput || !lngInput) return;
    const sync = () => {
      const a = parseFloat(latInput.value);
      const b = parseFloat(lngInput.value);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        setLat(a);
        setLng(b);
      }
    };
    latInput.addEventListener("change", sync);
    lngInput.addEventListener("change", sync);
    return () => {
      latInput.removeEventListener("change", sync);
      lngInput.removeEventListener("change", sync);
    };
  }, []);

  const center = useMemo<[number, number]>(
    () => (lat !== null && lng !== null ? [lat, lng] : CAIRO),
    [lat, lng],
  );
  const zoom = lat !== null && lng !== null ? 17 : 12;

  // Update local state + the DOM inputs (so form submission picks them up).
  function setCoords(a: number, b: number) {
    setLat(a);
    setLng(b);
    const latInput = document.getElementById(
      "office_lat",
    ) as HTMLInputElement | null;
    const lngInput = document.getElementById(
      "office_lng",
    ) as HTMLInputElement | null;
    if (latInput) latInput.value = a.toFixed(7);
    if (lngInput) lngInput.value = b.toFixed(7);
  }

  return (
    <div className="rounded-xl overflow-hidden border-2 border-slate-200 shadow-md">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        style={{ height: 320, width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onClick={setCoords} />
        <Recentre center={center} zoom={zoom} />
        {lat !== null && lng !== null && (
          <>
            <Marker
              position={[lat, lng]}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const pos = e.target.getLatLng();
                  setCoords(pos.lat, pos.lng);
                },
              }}
            />
            <Circle
              center={[lat, lng]}
              radius={radius}
              pathOptions={{
                color: "#0891b2",
                fillColor: "#22d3ee",
                fillOpacity: 0.15,
              }}
            />
          </>
        )}
      </MapContainer>
      <div className="bg-slate-50 px-3 py-2 text-[11px] text-slate-600 font-cairo border-t border-slate-200 flex items-center justify-between gap-2">
        <div>
          💡 اضغط على الخريطة لتحديد المكان، أو اسحب الـ marker لضبط دقيق.
        </div>
        {lat !== null && lng !== null && (
          <a
            href={`https://www.google.com/maps?q=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-cyan-dark hover:underline whitespace-nowrap"
          >
            افتح في Google Maps ↗
          </a>
        )}
      </div>
    </div>
  );
}

// Captures click events on the map.
function ClickHandler({
  onClick,
}: {
  onClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Whenever the parent state's center changes (e.g. GPS just wrote new
// lat/lng to the inputs), animate the map to that new position. The
// MapContainer's `center` prop is initial-only by design, so we need
// an effect to follow updates.
function Recentre({
  center,
  zoom,
}: {
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.6 });
  }, [map, center, zoom]);
  return null;
}
