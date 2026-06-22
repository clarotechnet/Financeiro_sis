import { createContext } from 'react';
import { User, Session } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  cargo: string | null;
  avatar_url: string | null;
  avatar_path: string | null;
  role: string;
  approved: boolean;
  approved_at: string | null;
  notifications_seen_at: string | null;
  created_at: string;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isAdmin: boolean;
  isApproved: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ ok: boolean; message: string }>;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; message: string; reason?: string }>;
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; message: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
