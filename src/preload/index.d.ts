import type { BoardyApi } from '../shared/api'

declare global {
  interface Window {
    boardy: BoardyApi
  }
}

export {}
