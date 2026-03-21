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
import { ColorPaletteWidget } from "./ColorPaletteWidget";
import { ChecklistWidget } from "./ChecklistWidget";
import { TimelineWidget } from "./TimelineWidget";
import { DiceWidget } from "./DiceWidget";
import { UnitConverterWidget } from "./UnitConverterWidget";
import { CalendarWidget } from "./CalendarWidget";
import { QRCodeWidget } from "./QRCodeWidget";
import { DiffWidget } from "./DiffWidget";
import { JsonExplorerWidget } from "./JsonExplorerWidget";
import { CodeDisplayWidget } from "./CodeDisplayWidget";
import { CurrencyWidget } from "./CurrencyWidget";
import { StockWidget } from "./StockWidget";
import { YouTubeWidget } from "./YouTubeWidget";
import { KanbanWidget } from "./KanbanWidget";
import { QuizWidget } from "./QuizWidget";

export interface WidgetComponentProps {
  params?: Record<string, string>;
  endpoint?: string;
  artifactId?: string;
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
  colorpalette: ColorPaletteWidget,
  checklist: ChecklistWidget,
  timeline: TimelineWidget,
  dice: DiceWidget,
  unitconverter: UnitConverterWidget,
  calendar: CalendarWidget,
  qrcode: QRCodeWidget,
  diff: DiffWidget,
  jsonexplorer: JsonExplorerWidget,
  codedisplay: CodeDisplayWidget,
  currency: CurrencyWidget,
  stock: StockWidget as ComponentType<WidgetComponentProps>,
  youtube: YouTubeWidget,
  kanban: KanbanWidget as ComponentType<WidgetComponentProps>,
  quiz: QuizWidget,
};
