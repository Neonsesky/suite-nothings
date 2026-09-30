import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/Button';
import s from './Shell.module.css';

export const ERROR_BOUNDARY_COPY = 'This screen tripped over its suitcase. Your stays are safe on this phone.';

interface State {
  error: Error | null;
}

/** Global error boundary (SPEC §8.9). Also used per-route so the shell survives. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen error', error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={s.crash} role="alert">
        <p className={s.crashText}>{ERROR_BOUNDARY_COPY}</p>
        <Button onClick={() => location.reload()}>Reload</Button>
      </div>
    );
  }
}
