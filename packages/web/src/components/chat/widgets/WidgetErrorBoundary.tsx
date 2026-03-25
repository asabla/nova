import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  widgetType: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[WidgetErrorBoundary] ${this.props.widgetType}:`, error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-danger">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span className="font-medium">
              Failed to render {this.props.widgetType} widget
            </span>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="ml-auto flex items-center gap-1 text-text-tertiary hover:text-text-secondary transition-colors"
            >
              <RefreshCw className="size-3" />
              <span>Retry</span>
            </button>
          </div>
          {this.state.error?.message && (
            <details className="mt-2">
              <summary className="text-[10px] text-text-tertiary cursor-pointer hover:text-text-secondary">
                Error details
              </summary>
              <pre className="mt-1 text-[10px] text-text-tertiary bg-surface-tertiary/50 rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-all">
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
