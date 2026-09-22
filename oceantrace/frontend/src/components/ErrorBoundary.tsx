import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "16px",
            margin: "12px",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "8px",
            color: "#fca5a5",
            fontSize: "12px",
            fontFamily: "monospace",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: "6px", color: "#f87171" }}>
            ⚠️ {this.props.fallbackTitle || "Panel Encountered an Error"}
          </div>
          <div style={{ color: "#e2e8f0", marginBottom: "8px", fontSize: "11px" }}>
            {this.state.error?.message || "An unexpected rendering error occurred."}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: "4px 10px",
              background: "rgba(239, 68, 68, 0.2)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: "4px",
              color: "#fff",
              cursor: "pointer",
              fontSize: "11px",
            }}
          >
            Retry Panel
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
