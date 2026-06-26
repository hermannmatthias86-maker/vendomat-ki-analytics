import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="card max-w-md text-center">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Ein Fehler ist aufgetreten</h2>
            <p className="text-sm text-gray-500 mb-4">
              Die Anwendung konnte nicht geladen werden. Bitte laden Sie die Seite neu.
            </p>
            <button onClick={() => window.location.reload()} className="btn-primary">
              Seite neu laden
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
