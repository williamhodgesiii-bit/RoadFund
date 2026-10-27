"use client";

import { useEffect, useState } from "react";
import { CloudSnow, MessageSquare, Snowflake } from "lucide-react";
import { Card, CardHeader, cx } from "@/components/ui";
import { smsHref } from "@/lib/client/links";
import { useRoad } from "@/lib/client/road-context";
import { snowText, type ForecastDay } from "@/lib/weather";

type State = { loading: true } | { loading: false; available: false; reason: string } | { loading: false; available: true; place: string | null; days: ForecastDay[] };

export function WeatherCard() {
  const { road } = useRoad();
  const at = road.center ?? road.path[0] ?? road.homes.find((h) => h.position)?.position ?? null;
  const [state, setState] = useState<State>({ loading: true });

  useEffect(() => {
    if (!at || !road.settings.weather.enabled) return;
    let live = true;
    fetch(`/api/weather?lat=${at.lat}&lng=${at.lng}`)
      .then((r) => r.json())
      .then((b) => live && setState({ loading: false, ...b }))
      .catch(() => live && setState({ loading: false, available: false, reason: "Forecast unavailable right now." }));
    return () => {
      live = false;
    };
  }, [at?.lat, at?.lng, road.settings.weather.enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!road.settings.weather.enabled) return null;
  if (!at) {
    return (
      <Card>
        <CardHeader title="Snow alerts" icon={<CloudSnow className="h-5 w-5" aria-hidden />} sub="Put the road on the map (Road tab) to get the forecast and plow alerts." />
      </Card>
    );
  }

  const threshold = road.settings.weather.snowInches;
  const contractor = road.contractors.find((c) => c.id === road.settings.weather.contractorId);
  const days = state.loading || !state.available ? [] : state.days.slice(0, 8);
  const trigger = days.find((d) => d.snow && d.snow[1] >= threshold);

  return (
    <Card>
      <CardHeader
        title="Snow alerts"
        icon={<CloudSnow className="h-5 w-5" aria-hidden />}
        sub={state.loading ? "Checking the National Weather Service…" : state.available ? `Forecast for ${state.place ?? "your road"} · alert at ${threshold}+ inches` : state.reason}
      />
      {!state.loading && state.available && (
        <div className="space-y-4 p-5">
          {trigger ? (
            <div className="rounded-xl border border-sign/60 bg-sign-50 p-4">
              <p className="flex items-center gap-2 font-bold">
                <Snowflake className="h-5 w-5 text-sign-ink" aria-hidden />
                {trigger.name}: {snowText(trigger.snow!)}
              </p>
              <p className="mt-1 text-[0.95rem]">That&apos;s over your {threshold}-inch plow trigger.</p>
              {contractor?.phone && (
                <a
                  href={smsHref(contractor.phone, `Hi, this is ${road.name}. Forecast says ${snowText(trigger.snow!)} ${trigger.name.toLowerCase()}. Please plow once it stops. Thanks!`)}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-charcoal px-4 font-semibold text-white"
                >
                  <MessageSquare className="h-4 w-4" aria-hidden /> Text {contractor.name}
                </a>
              )}
            </div>
          ) : (
            <p className="text-stone">No snow over {threshold} inches in the next few days.</p>
          )}
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {days
              .filter((d) => d.daytime)
              .slice(0, 4)
              .map((d) => (
                <li key={d.start} className={cx("rounded-xl border p-3", d.snow ? "border-lake/40 bg-lake-50" : "border-line")}>
                  <p className="text-[0.88rem] font-semibold">{d.name}</p>
                  <p className="tnum font-display text-[1.25rem] font-extrabold">{d.temp}°</p>
                  <p className="text-[0.82rem] leading-snug text-stone">{d.snow ? snowText(d.snow) : d.short}</p>
                </li>
              ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
