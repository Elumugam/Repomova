/* ============================================
   Zustand Store — Repomova workspace state
   ============================================ */
import { create } from 'zustand';
import type { ConnectedApp, OpenTab, UserProfile, Theme, AppStatus } from './types';

interface WorkspaceState {
  // ---- Theme ----
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;

  // ---- Sidebar ----
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  toggleSidebarCollapse: () => void;

  // ---- Auth ----
  user: UserProfile | null;
  isAuthenticated: boolean;
  setUser: (u: UserProfile | null) => void;

  // ---- Connected Apps ----
  connectedApps: ConnectedApp[];
  setConnectedApps: (apps: ConnectedApp[]) => void;
  addConnectedApp: (app: ConnectedApp) => void;
  updateAppStatus: (appId: string, status: AppStatus) => void;
  updateApp: (appId: string, updates: Partial<ConnectedApp>) => void;
  removeConnectedApp: (appId: string) => void;

  // ---- Open Tabs ----
  openTabs: OpenTab[];
  activeTabId: string | null;
  openTab: (tab: OpenTab) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;

  // ---- Modals ----
  connectModalOpen: boolean;
  setConnectModalOpen: (open: boolean) => void;

  // ---- Active View ----
  activeView: 'home' | 'apps' | 'settings' | 'app-detail';
  setActiveView: (view: 'home' | 'apps' | 'settings' | 'app-detail') => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  // Theme
  theme: (localStorage.getItem('repomova-theme') as Theme) || 'light',
  setTheme: (t) => {
    localStorage.setItem('repomova-theme', t);
    document.documentElement.setAttribute('data-theme', t);
    set({ theme: t });
  },
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('repomova-theme', next);
      document.documentElement.setAttribute('data-theme', next);
      return { theme: next };
    }),

  // Sidebar
  sidebarOpen: false,
  sidebarCollapsed: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleSidebarCollapse: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  // Auth
  user: null,
  isAuthenticated: false,
  setUser: (u) => set({ user: u, isAuthenticated: !!u }),

  // Connected Apps
  connectedApps: [],
  setConnectedApps: (apps) => set({ connectedApps: apps }),
  addConnectedApp: (app) => set((s) => ({ connectedApps: [...s.connectedApps, app] })),
  updateAppStatus: (appId, status) =>
    set((s) => ({
      connectedApps: s.connectedApps.map((a) =>
        a.id === appId ? { ...a, status, updatedAt: new Date().toISOString() } : a
      ),
      openTabs: s.openTabs.map((t) =>
        t.appId === appId ? { ...t, status } : t
      ),
    })),
  updateApp: (appId, updates) =>
    set((s) => ({
      connectedApps: s.connectedApps.map((a) =>
        a.id === appId ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
      ),
    })),
  removeConnectedApp: (appId) =>
    set((s) => ({
      connectedApps: s.connectedApps.filter((a) => a.id !== appId),
      openTabs: s.openTabs.filter((t) => t.appId !== appId),
    })),

  // Open Tabs
  openTabs: [],
  activeTabId: null,
  openTab: (tab) =>
    set((s) => {
      const existing = s.openTabs.find((t) => t.appId === tab.appId);
      if (existing) return { activeTabId: existing.id };
      return { openTabs: [...s.openTabs, tab], activeTabId: tab.id };
    }),
  closeTab: (tabId) =>
    set((s) => {
      const remaining = s.openTabs.filter((t) => t.id !== tabId);
      let nextActive = s.activeTabId;
      if (s.activeTabId === tabId) {
        nextActive = remaining.length > 0 ? remaining[remaining.length - 1].id : null;
      }
      return { openTabs: remaining, activeTabId: nextActive };
    }),
  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  // Modals
  connectModalOpen: false,
  setConnectModalOpen: (open) => set({ connectModalOpen: open }),

  // Active View
  activeView: 'home',
  setActiveView: (view) => set({ activeView: view }),
}));
