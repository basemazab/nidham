"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ChatErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
          <div className="max-w-lg mx-auto text-center pt-16">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold font-cairo mb-2 text-slate-700">حدث خطأ</h2>
            <p className="text-slate-500 text-sm font-cairo mb-4">
              {this.state.error.message || "تعذر تحميل المساعد الذكي"}
            </p>
            <button
              onClick={() => {
                this.setState({ error: null });
                window.location.reload();
              }}
              className="px-4 py-2 rounded-xl bg-brand-cyan-dark text-white font-bold text-sm font-cairo hover:bg-brand-cyan transition"
            >
              إعادة تحميل
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
