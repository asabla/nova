import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Component, type ReactNode } from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class AdminErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center" style={{ background: "var(--color-surface)" }}>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>Something went wrong</h2>
          <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.href = "/"; }}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--color-accent-blue)", color: "white" }}
          >
            Return to Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const Route = createRootRoute({
  component: () => (
    <AdminErrorBoundary>
      <Outlet />
    </AdminErrorBoundary>
  ),
});
