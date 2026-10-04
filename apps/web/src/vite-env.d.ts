/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the API, defaults to the Vite proxy origin ("/api/v1"). */
  readonly VITE_API_BASE?: string;
  /** Override for Socket.io in production; defaults to same origin in dev. */
  readonly VITE_SOCKET_URL?: string;
  /** Unsplash access key — covers products saved without a photo of their own. */
  readonly VITE_UNSPLASH_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}