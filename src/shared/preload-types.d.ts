declare global {
  interface Window {
    jpt: {
      send: (channel: string, ...args: unknown[]) => void
      invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>
      on: (channel: string, listener: (...args: unknown[]) => void) => () => void
    }
  }
}

export {}

declare module '*.png' {
  const url: string
  export default url
}
