import type { ComponentType } from "react";
import { WeatherWidget } from "./WeatherWidget";
import { CountdownWidget } from "./CountdownWidget";
import { PollWidget } from "./PollWidget";
import { ApiWidget } from "./ApiWidget";
import { ProgressWidget } from "./ProgressWidget";
import { TimerWidget } from "./TimerWidget";
import { ChartWidget } from "./ChartWidget";
import { MapWidget } from "./MapWidget";
import { MathWidget } from "./MathWidget";

export interface WidgetComponentProps {
  params?: Record<string, string>;
  endpoint?: string;
}

/**
 * Registry of all supported widget types.
 * Each widget receives `params` (and optionally `endpoint`) from the WidgetConfig.
 */
export const WIDGET_REGISTRY: Record<string, ComponentType<WidgetComponentProps>> = {
  weather: WeatherWidget,
  countdown: CountdownWidget,
  poll: PollWidget,
  api: ApiWidget as ComponentType<WidgetComponentProps>,
  progress: ProgressWidget,
  timer: TimerWidget,
  chart: ChartWidget,
  map: MapWidget,
  math: MathWidget,
};
