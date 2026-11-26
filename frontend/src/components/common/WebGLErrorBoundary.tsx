import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  fallback: ReactNode
  children: ReactNode
}

interface State {
  hasError: boolean
  errorMessage: string | null
}

export class WebGLErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Error is safely isolated to the 3D canvas; fallback UI renders cleanly.
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}
