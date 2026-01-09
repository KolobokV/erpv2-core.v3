import React from "react";

type Props = {
  title?: string;
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  errorText?: string;
};

export class ErpErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: unknown): State {
    const txt = err instanceof Error ? (err.stack || err.message) : String(err);
    return { hasError: true, errorText: txt };
  }

  componentDidCatch(err: unknown) {
    // Intentionally minimal; console already has the error in dev.
    // Keeping here for future telemetry hooks.
    void err;
  }

  private onReload = () => {
    try {
      window.location.reload();
    } catch {
      // ignore
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const title = this.props.title ?? "\u041e\u0448\u0438\u0431\u043a\u0430 \u0432 \u0438\u043d\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0435";
    const hint =
      "\u042d\u0442\u043e \u043d\u0435 \u0441\u0431\u0440\u043e\u0441 \u0441\u0438\u0441\u0442\u0435\u043c\u044b. \u041c\u044b \u043f\u0440\u043e\u0441\u0442\u043e \u0443\u043b\u043e\u0432\u0438\u043b\u0438 \u043e\u0448\u0438\u0431\u043a\u0443, \u0447\u0442\u043e\u0431\u044b \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430 \u043d\u0435 \u043f\u0430\u0434\u0430\u043b\u0430 \u0446\u0435\u043b\u0438\u043a\u043e\u043c.";

    return (
      <div style={{ padding: 16 }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{title}</div>
            <div style={{ opacity: 0.9, marginBottom: 12 }}>{hint}</div>
            <button
              onClick={this.onReload}
              style={{
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 10,
                padding: "8px 12px",
                background: "rgba(255,255,255,0.06)",
                cursor: "pointer",
              }}
            >
              {"\u041f\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c"}
            </button>
            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
              {"\u0414\u0435\u0442\u0430\u043b\u0438 (\u0434\u043b\u044f \u0440\u0430\u0437\u0440\u0430\u0431\u043e\u0442\u0447\u0438\u043a\u0430):"}
            </div>
            <pre
              style={{
                marginTop: 6,
                whiteSpace: "pre-wrap",
                background: "rgba(0,0,0,0.35)",
                padding: 12,
                borderRadius: 10,
                overflow: "auto",
              }}
            >
              {this.state.errorText || "(no details)"}
            </pre>
          </div>
        </div>
      </div>
    );
  }
}
