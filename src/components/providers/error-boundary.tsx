/**
 * Error Boundary para React Query
 *
 * Captura erros não tratados e exibe UI de fallback
 */

'use client';

import React, { Component, ReactNode } from 'react';
import { createErrorBoundaryHandler } from '@/lib/react-query/error-handler';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error) => ReactNode);
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary Component
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log do erro
    const errorHandler = createErrorBoundaryHandler();
    errorHandler(error, errorInfo);

    // Callback customizado
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset error state se resetKeys mudarem
    if (this.state.hasError && prevProps.resetKeys !== this.props.resetKeys) {
      this.setState({
        hasError: false,
        error: null,
      });
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Renderizar fallback customizado
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback(this.state.error!)
          : this.props.fallback;
      }

      // Fallback padrão
      return <DefaultErrorFallback error={this.state.error!} />;
    }

    return this.props.children;
  }
}

/**
 * Fallback UI padrão
 */
function DefaultErrorFallback({ error }: { error: Error }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        backgroundColor: '#f9fafb',
      }}
    >
      <div
        style={{
          maxWidth: '500px',
          padding: '2rem',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            marginBottom: '1rem',
            color: '#dc2626',
          }}
        >
          Algo deu errado
        </h1>
        <p
          style={{
            marginBottom: '1rem',
            color: '#6b7280',
          }}
        >
          Ocorreu um erro inesperado. Por favor, recarregue a página.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <details
            style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: '#fee2e2',
              borderRadius: '4px',
              fontSize: '0.875rem',
            }}
          >
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              Detalhes do erro
            </summary>
            <pre
              style={{
                marginTop: '0.5rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {error.message}
              {'\n\n'}
              {error.stack}
            </pre>
          </details>
        )}
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '500',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#2563eb';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#3b82f6';
          }}
        >
          Recarregar página
        </button>
      </div>
    </div>
  );
}

/**
 * Hook para usar error boundary de forma declarativa
 */
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return {
    throwError: setError,
    reset: () => setError(null),
  };
}
