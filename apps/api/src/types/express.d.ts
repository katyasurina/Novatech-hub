export {};

declare global {
  namespace Express {
    export interface Request {
      /** Set by requireAuth / optionalAuth. Undefined when not authenticated. */
      auth?: {
        id: string;
        username: string;
        role: 'USER' | 'ADMIN';
        tokenVersion?: number;
      };
    }
  }
}