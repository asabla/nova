import { Link } from "@tanstack/react-router";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "./ui/Button";

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <p className="text-7xl font-bold text-primary/20 mb-4">404</p>
      <h2 className="text-xl font-semibold text-text mb-2">Page not found</h2>
      <p className="text-sm text-text-secondary mb-6 max-w-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </Button>
        <Link to="/">
          <Button variant="primary">
            <Home className="h-4 w-4" />
            Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
