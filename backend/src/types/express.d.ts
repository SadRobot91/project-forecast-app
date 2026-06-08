declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: number;
        role: 'pm' | 'dm';
        email: string;
        supabaseUid: string;
      };
    }
  }
}

export {};
