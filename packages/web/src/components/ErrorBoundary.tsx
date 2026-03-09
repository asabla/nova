import { Component, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./ui/Button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

function ErrorBoundaryFallback({ error }: { error?: Error }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] px-4 text-center" role="alert">
      <AlertTriangle className="h-12 w-12 text-danger mb-4" aria-hidden="true" />
      <h2 className="text-lg font-semibold text-text mb-2">
        {t("errors.somethingWentWrong", "Something went wrong")}
      </h2>
      <p className="text-sm text-text-secondary mb-4 max-w-md">
        {error?.message ?? t("errors.unexpectedError", "An unexpected error occurred. Please try again.")}
      </p>
      <Button
        variant="primary"
        onClick={() => window.location.reload()}
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        {t("errors.reloadPage", "Reload Page")}
      </Button>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return <ErrorBoundaryFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}
