// client/src/components/ui/error-boundary.tsx
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Sentry } from "@/lib/sentry";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children:  ReactNode;
  fallback?: ReactNode;
  label?:    string;
}

interface State {
  hasError: boolean;
  error:    Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Caught render error:", error, info.componentStack);
    // Report to Sentry (no-op if VITE_SENTRY_DSN is not set)
    Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
    });
  }

  handleReset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback)  return this.props.fallback;

    const label = this.props.label ?? "this page";

    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <div className="space-y-2 max-w-sm">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="text-muted-foreground text-sm">
            We hit an unexpected error loading {label}.
            This has been logged and we'll look into it.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre className="mt-3 text-left text-xs bg-muted rounded-lg p-3 overflow-auto max-h-32 text-destructive">
              {this.state.error.message}
            </pre>
          )}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={this.handleReset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try again
          </Button>
          <Button variant="ghost" onClick={() => (window.location.href = "/")}>
            Go home
          </Button>
        </div>
      </div>
    );
  }
}
