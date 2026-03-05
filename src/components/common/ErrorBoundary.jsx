import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log and prevent crash of the parent tree
    console.error("ErrorBoundary caught: ", error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 border rounded bg-amber-50 text-amber-800">
          Komponenten kunde inte laddas
        </div>
      );
    }
    return this.props.children;
  }
}