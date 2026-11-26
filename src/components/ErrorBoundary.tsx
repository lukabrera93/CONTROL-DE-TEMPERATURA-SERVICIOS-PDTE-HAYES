import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Error inesperado al renderizar la aplicación.',
    };
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetLocalStorage = () => {
    try {
      localStorage.removeItem('controlterm_db_v1');
      if (typeof indexedDB !== 'undefined') {
        indexedDB.deleteDatabase('ControlTermOfflineDB');
      }
    } catch {
      // Ignore cleanup errors
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-base font-bold text-slate-900">
              No se pudo cargar ControlTerm correctamente
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Ocurrió un error al iniciar la aplicación en este navegador. Puedes recargar la
              página o limpiar la caché local si había datos antiguos guardados.
            </p>
            {this.state.errorMessage && (
              <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-100 p-2.5 font-mono text-[11px] text-rose-700">
                {this.state.errorMessage}
              </pre>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800 cursor-pointer"
              >
                Recargar página
              </button>
              <button
                type="button"
                onClick={this.handleResetLocalStorage}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Restablecer datos locales
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
