import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      role: null,

      setSession: ({ access_token, refresh_token, role, full_name, user_id }) =>
        set({
          token: access_token,
          refreshToken: refresh_token,
          role,
          user: { id: user_id, full_name, role, email: get().user?.email || '' },
        }),

      setUser: (user) => set({ user }),

      logout: () => set({ user: null, token: null, refreshToken: null, role: null }),
    }),
    {
      name: 'hrms-auth',
      partialize: (s) => ({ token: s.token, refreshToken: s.refreshToken, role: s.role, user: s.user }),
    }
  )
);
