/* ============================================
   Zustand Store — Repomova workspace state
   ============================================ */
import { create } from 'zustand';
import type { ConnectedApp, OpenTab, UserProfile, Theme, AppStatus } from './types';
import { isSupabaseConfigured, syncBookmarkToSupabase } from './lib/supabase';

function getInitialSidebarCollapsed(): boolean {
  try {
    const saved = localStorage.getItem('repomova-sidebar-collapsed');
    if (saved !== null) {
      return saved === 'true';
    }
  } catch {
    // Ignore localStorage errors
  }
  return true; // Collapsed by default in a fresh session
}

function getInitialBookmarks(): string[] {
  try {
    const saved = localStorage.getItem('repomova-bookmarks');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore localStorage errors
  }
  return [];
}

interface AppCustomization {
  displayName?: string;
  customThumbnail?: string;
}

function getStoredAppCustomizations(): Record<string, AppCustomization> {
  try {
    const raw = localStorage.getItem('repomova-app-customizations');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // Ignore localStorage errors
  }
  return {};
}

function saveAppCustomizations(customizations: Record<string, AppCustomization>): void {
  try {
    localStorage.setItem('repomova-app-customizations', JSON.stringify(customizations));
  } catch {
    // Ignore localStorage errors
  }
}

export function applyCustomizationsToApp(app: ConnectedApp): ConnectedApp {
  const all = getStoredAppCustomizations();
  const custom = all[app.id] || (app.repoFullName ? all[app.repoFullName] : undefined);
  if (!custom) return app;
  return {
    ...app,
    displayName: custom.displayName !== undefined ? custom.displayName : app.displayName,
    customThumbnail: custom.customThumbnail !== undefined ? custom.customThumbnail : app.customThumbnail,
  };
}

interface WorkspaceState {
  // ---- Theme ----
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;

  // ---- Sidebar ----
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  toggleSidebarCollapse: () => void;

  // ---- Workspace Loading & Error State ----
  appsLoading: boolean;
  appsError: string | null;
  setAppsLoading: (loading: boolean) => void;
  setAppsError: (error: string | null) => void;

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

  // ---- Bookmarks ----
  bookmarkedAppIds: string[];
  toggleBookmark: (appId: string) => void;
  isBookmarked: (appId: string) => boolean;
  setBookmarkedAppIds: (ids: string[]) => void;

  // ---- Open Tabs ----
  openTabs: OpenTab[];
  activeTabId: string | null;
  openTab: (tab: OpenTab) => void;
  openNewWorkspace: () => string;
  assignAppToTab: (tabId: string, appId: string) => void;
  openNewWindow: (appId?: string) => string;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;

  // ---- Modals ----
  connectModalOpen: boolean;
  setConnectModalOpen: (open: boolean) => void;

  // ---- Active View ----
  activeView: 'home' | 'apps' | 'settings' | 'app-detail';
  setActiveView: (view: 'home' | 'apps' | 'settings' | 'app-detail') => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
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
  sidebarCollapsed: getInitialSidebarCollapsed(),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarCollapsed: (collapsed) => {
    try {
      localStorage.setItem('repomova-sidebar-collapsed', String(collapsed));
    } catch {
      // Ignore localStorage errors
    }
    set({ sidebarCollapsed: collapsed });
  },
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleSidebarCollapse: () =>
    set((s) => {
      const next = !s.sidebarCollapsed;
      try {
        localStorage.setItem('repomova-sidebar-collapsed', String(next));
      } catch {
        // Ignore localStorage errors
      }
      return { sidebarCollapsed: next };
    }),

  // Loading & error
  appsLoading: false,
  appsError: null,
  setAppsLoading: (loading) => set({ appsLoading: loading }),
  setAppsError: (error) => set({ appsError: error }),

  // Auth
  user: null,
  isAuthenticated: false,
  setUser: (u) => set({ user: u, isAuthenticated: !!u }),

  // Connected Apps
  connectedApps: [],
  setConnectedApps: (apps) => set({ connectedApps: apps.map(applyCustomizationsToApp) }),
  addConnectedApp: (app) => set((s) => ({ connectedApps: [...s.connectedApps, applyCustomizationsToApp(app)] })),
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
    set((s) => {
      if (updates.displayName !== undefined || updates.customThumbnail !== undefined) {
        const stored = getStoredAppCustomizations();
        const app = s.connectedApps.find((a) => a.id === appId);
        const existing = stored[appId] || (app?.repoFullName ? stored[app.repoFullName] : undefined) || {};
        const updatedCustom = {
          ...existing,
          ...(updates.displayName !== undefined ? { displayName: updates.displayName } : {}),
          ...(updates.customThumbnail !== undefined ? { customThumbnail: updates.customThumbnail } : {}),
        };
        stored[appId] = updatedCustom;
        if (app?.repoFullName) {
          stored[app.repoFullName] = updatedCustom;
        }
        saveAppCustomizations(stored);
      }

      const nextTabs = updates.displayName !== undefined
        ? s.openTabs.map((t) => (t.appId === appId ? { ...t, title: updates.displayName || t.title } : t))
        : s.openTabs;

      return {
        connectedApps: s.connectedApps.map((a) =>
          a.id === appId ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
        ),
        openTabs: nextTabs,
      };
    }),
  removeConnectedApp: (appId) =>
    set((s) => {
      const app = s.connectedApps.find((a) => a.id === appId);
      const nextBookmarks = s.bookmarkedAppIds.filter((id) => id !== appId);
      try {
        localStorage.setItem('repomova-bookmarks', JSON.stringify(nextBookmarks));
      } catch {
        // Ignore localStorage errors
      }
      try {
        const stored = getStoredAppCustomizations();
        let changed = false;
        if (stored[appId]) {
          delete stored[appId];
          changed = true;
        }
        if (app?.repoFullName && stored[app.repoFullName]) {
          delete stored[app.repoFullName];
          changed = true;
        }
        if (changed) {
          saveAppCustomizations(stored);
        }
      } catch {
        // Ignore localStorage errors
      }
      return {
        connectedApps: s.connectedApps.filter((a) => a.id !== appId),
        openTabs: s.openTabs.filter((t) => t.appId !== appId),
        bookmarkedAppIds: nextBookmarks,
      };
    }),

  // Bookmarks
  bookmarkedAppIds: getInitialBookmarks(),
  toggleBookmark: (appId) => {
    set((s) => {
      const exists = s.bookmarkedAppIds.includes(appId);
      const next = exists
        ? s.bookmarkedAppIds.filter((id) => id !== appId)
        : [...s.bookmarkedAppIds, appId];

      try {
        localStorage.setItem('repomova-bookmarks', JSON.stringify(next));
      } catch {
        // Ignore localStorage errors
      }

      if (s.user && isSupabaseConfigured) {
        syncBookmarkToSupabase(s.user.id, appId, !exists);
      }

      return { bookmarkedAppIds: next };
    });
  },
  isBookmarked: (appId) => get().bookmarkedAppIds.includes(appId),
  setBookmarkedAppIds: (ids) => {
    const unique = Array.from(new Set(ids));
    try {
      localStorage.setItem('repomova-bookmarks', JSON.stringify(unique));
    } catch {
      // Ignore localStorage errors
    }
    set({ bookmarkedAppIds: unique });
  },

  // Open Tabs & Workspaces
  openTabs: [],
  activeTabId: null,
  openTab: (tab) =>
    set((s) => {
      const existing = s.openTabs.find(
        (t) => t.id === tab.id || (Boolean(tab.appId) && t.appId === tab.appId)
      );
      if (existing) return { activeTabId: existing.id, activeView: 'apps' };
      return { openTabs: [...s.openTabs, tab], activeTabId: tab.id, activeView: 'apps' };
    }),
  openNewWorkspace: () => {
    const newTabId = `workspace-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newTab: OpenTab = {
      id: newTabId,
      appId: '',
      title: 'New Workspace',
      status: 'connected',
    };
    set((s) => ({
      openTabs: [...s.openTabs, newTab],
      activeTabId: newTabId,
      activeView: 'apps',
    }));
    return newTabId;
  },
  assignAppToTab: (tabId, appId) =>
    set((s) => {
      const app = s.connectedApps.find((a) => a.id === appId);
      if (!app) return s;
      return {
        openTabs: s.openTabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                appId: app.id,
                title: app.displayName || app.repoName,
                status: app.status,
                previewUrl: app.previewUrl,
              }
            : t
        ),
        activeTabId: tabId,
        activeView: 'apps',
      };
    }),
  openNewWindow: (appId?: string) => {
    if (!appId) {
      return get().openNewWorkspace();
    }

    const app = get().connectedApps.find((a) => a.id === appId);
    if (!app) return '';

    const appName = app.displayName || app.repoName;
    const existingViews = get().openTabs.filter((t) => t.appId === app.id);
    const viewNumber = existingViews.length + 1;
    const title = existingViews.length > 0 ? `${appName} (${viewNumber})` : appName;
    const newTabId = `tab-${app.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const newTab: OpenTab = {
      id: newTabId,
      appId: app.id,
      title,
      status: app.status,
      previewUrl: app.previewUrl,
    };

    set((s) => ({
      openTabs: [...s.openTabs, newTab],
      activeTabId: newTabId,
      activeView: 'apps',
    }));
    return newTabId;
  },
  closeTab: (tabId) =>
    set((s) => {
      if (tabId === 'all') {
        return { openTabs: [], activeTabId: null };
      }
      const remaining = s.openTabs.filter((t) => t.id !== tabId);
      let nextActive = s.activeTabId;
      if (s.activeTabId === tabId) {
        nextActive = remaining.length > 0 ? remaining[remaining.length - 1].id : null;
      }
      return { openTabs: remaining, activeTabId: nextActive };
    }),
  setActiveTab: (tabId) => set({ activeTabId: tabId, activeView: 'apps' }),

  // Modals
  connectModalOpen: false,
  setConnectModalOpen: (open) => set({ connectModalOpen: open }),

  // Active View
  activeView: 'home',
  setActiveView: (view) => set({ activeView: view }),
}));
