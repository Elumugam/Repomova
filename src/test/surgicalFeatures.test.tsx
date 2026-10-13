/* ============================================================
   Surgical Features & Integration Tests
   Tests for:
   1. Connected Apps (+) button opening new empty workspace
   2. Bookmark management and sidebar display (no opened apps)
   3. Uninterrupted navigation to Home & Settings while apps are running
   4. Independent workspace states and persistence
   ============================================================ */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../App';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import { useWorkspaceStore } from '../store';
import type { ConnectedApp } from '../types';

describe('Surgical Features & Fixes', () => {
  const appA: ConnectedApp = {
    id: 'app-alpha',
    userId: 'user-1',
    repoOwner: 'owner-a',
    repoName: 'alpha-app',
    repoFullName: 'owner-a/alpha-app',
    repoUrl: 'https://github.com/owner-a/alpha-app',
    defaultBranch: 'main',
    cloneStatus: 'cloned',
    runtimeType: 'react',
    status: 'running',
    port: 3001,
    previewUrl: 'http://127.0.0.1:3001',
    lastOpened: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const appB: ConnectedApp = {
    id: 'app-beta',
    userId: 'user-1',
    repoOwner: 'owner-b',
    repoName: 'beta-service',
    repoFullName: 'owner-b/beta-service',
    repoUrl: 'https://github.com/owner-b/beta-service',
    defaultBranch: 'main',
    cloneStatus: 'cloned',
    runtimeType: 'node',
    status: 'stopped',
    port: 4000,
    lastOpened: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    localStorage.clear();
    const store = useWorkspaceStore.getState();
    store.setConnectedApps([appA, appB]);
    store.closeTab('all');
    store.setBookmarkedAppIds([]);
    store.setActiveView('apps');
  });

  describe('1. Connected Apps (+) Button Behavior', () => {
    it('clicking + opens a new empty workspace without duplicating the active application', () => {
      // Set active tab to running appA
      useWorkspaceStore.setState({
        openTabs: [{ id: 'tab-alpha', appId: appA.id, title: appA.repoName, status: 'running' }],
        activeTabId: 'tab-alpha',
        activeView: 'apps',
      });

      render(<Topbar />);
      const plusBtn = screen.getByRole('button', { name: /open new application window/i });
      fireEvent.click(plusBtn);

      const state = useWorkspaceStore.getState();
      expect(state.openTabs.length).toBe(2);

      // The new tab is an empty workspace
      const newTab = state.openTabs[1];
      expect(newTab.title).toBe('New Workspace');
      expect(newTab.appId).toBe('');
      expect(newTab.appId).not.toBe(appA.id);
      expect(state.activeTabId).toBe(newTab.id);

      // Tab alpha is still intact and running
      expect(state.openTabs[0].id).toBe('tab-alpha');
      expect(state.openTabs[0].appId).toBe(appA.id);
      expect(state.openTabs[0].status).toBe('running');
    });

    it('existing tabs remain available after creating a new workspace', () => {
      useWorkspaceStore.setState({
        openTabs: [
          { id: 'tab-alpha', appId: appA.id, title: 'alpha-app', status: 'running' },
          { id: 'tab-beta', appId: appB.id, title: 'beta-service', status: 'stopped' },
        ],
        activeTabId: 'tab-alpha',
      });

      render(<Topbar />);
      const plusBtn = screen.getByRole('button', { name: /open new application window/i });
      fireEvent.click(plusBtn);

      const state = useWorkspaceStore.getState();
      expect(state.openTabs.length).toBe(3);
      expect(state.openTabs.some((t) => t.id === 'tab-alpha')).toBe(true);
      expect(state.openTabs.some((t) => t.id === 'tab-beta')).toBe(true);
    });

    it('new workspace allows selecting an already connected repository without duplicating', () => {
      const store = useWorkspaceStore.getState();
      const workspaceTabId = store.openNewWorkspace();

      expect(useWorkspaceStore.getState().openTabs.find((t) => t.id === workspaceTabId)?.appId).toBe('');

      // Assign appB to this workspace
      useWorkspaceStore.getState().assignAppToTab(workspaceTabId, appB.id);

      const updated = useWorkspaceStore.getState().openTabs.find((t) => t.id === workspaceTabId);
      expect(updated?.appId).toBe(appB.id);
      expect(updated?.title).toBe(appB.repoName);
      // Connected apps list remains clean and non-duplicated
      expect(useWorkspaceStore.getState().connectedApps.length).toBe(2);
    });
  });

  describe('2. Sidebar & Bookmarking Functionality', () => {
    it('opened applications no longer automatically appear in the sidebar', () => {
      useWorkspaceStore.setState({
        openTabs: [
          { id: 'tab-alpha', appId: appA.id, title: 'alpha-app', status: 'running' },
          { id: 'tab-beta', appId: appB.id, title: 'beta-service', status: 'stopped' },
        ],
        activeTabId: 'tab-alpha',
        sidebarCollapsed: false,
        bookmarkedAppIds: [], // no bookmarks
      });

      render(<Sidebar />);

      // "Running" and "Open Tabs" sections must NOT be rendered in sidebar
      expect(screen.queryByText(/Running/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Open Tabs/i)).not.toBeInTheDocument();

      // Only primary nav items should be present
      expect(screen.getByRole('button', { name: /^Home/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Connected Apps/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Settings/i })).toBeInTheDocument();
    });

    it('bookmarked applications appear in the dedicated sidebar section', () => {
      useWorkspaceStore.setState({
        sidebarCollapsed: false,
        bookmarkedAppIds: [appA.id],
      });

      render(<Sidebar />);

      expect(screen.getByText(/Bookmarks/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: `Open bookmarked ${appA.repoName}` })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: `Open bookmarked ${appB.repoName}` })).not.toBeInTheDocument();
    });

    it('unbookmarking removes an application from sidebar without disconnecting it or stopping it', () => {
      const store = useWorkspaceStore.getState();
      store.setBookmarkedAppIds([appA.id]);
      expect(store.isBookmarked(appA.id)).toBe(true);

      // Toggle bookmark off
      store.toggleBookmark(appA.id);

      expect(useWorkspaceStore.getState().isBookmarked(appA.id)).toBe(false);
      expect(useWorkspaceStore.getState().bookmarkedAppIds).toEqual([]);

      // Repo is NOT disconnected and status is unchanged!
      const apps = useWorkspaceStore.getState().connectedApps;
      expect(apps.find((a) => a.id === appA.id)).toBeDefined();
      expect(apps.find((a) => a.id === appA.id)?.status).toBe('running');
    });

    it('clicking a bookmark switches to existing workspace instead of duplicating', () => {
      useWorkspaceStore.setState({
        openTabs: [{ id: 'tab-alpha', appId: appA.id, title: 'alpha-app', status: 'running' }],
        activeTabId: 'tab-alpha',
        bookmarkedAppIds: [appA.id],
        sidebarCollapsed: false,
      });

      render(<Sidebar />);
      const bookmarkItem = screen.getByRole('button', { name: `Open bookmarked ${appA.repoName}` });
      fireEvent.click(bookmarkItem);

      const state = useWorkspaceStore.getState();
      // Should NOT create duplicate tab!
      expect(state.openTabs.length).toBe(1);
      expect(state.activeTabId).toBe('tab-alpha');
      expect(state.activeView).toBe('apps');
    });

    it('duplicate bookmarks are prevented', () => {
      const store = useWorkspaceStore.getState();
      store.setBookmarkedAppIds([appA.id, appA.id]);
      expect(useWorkspaceStore.getState().bookmarkedAppIds).toEqual([appA.id]);

      // Toggling on when already added toggles off
      store.toggleBookmark(appA.id);
      expect(useWorkspaceStore.getState().bookmarkedAppIds).toEqual([]);

      // Toggling back on adds once
      store.toggleBookmark(appA.id);
      expect(useWorkspaceStore.getState().bookmarkedAppIds).toEqual([appA.id]);
    });
  });

  describe('3. Navigation While Applications Are Running', () => {
    it('Home and Settings remain accessible while applications are running', () => {
      useWorkspaceStore.setState({
        openTabs: [{ id: 'tab-alpha', appId: appA.id, title: 'alpha-app', status: 'running' }],
        activeTabId: 'tab-alpha',
        activeView: 'apps',
        sidebarCollapsed: false,
      });

      render(<App />);

      // Running app view should initially be visible
      expect(screen.getByText(/alpha-app — Running/i)).toBeInTheDocument();

      // Navigate to Home via Sidebar
      const sidebar = screen.getByRole('complementary', { name: /Main Navigation/i });
      const homeBtn = within(sidebar).getByRole('button', { name: /^Home/i });
      fireEvent.click(homeBtn);

      expect(useWorkspaceStore.getState().activeView).toBe('home');
      // Home (WelcomeScreen) is rendered!
      expect(screen.getByRole('heading', { name: /^Overview/i })).toBeInTheDocument();

      // Running tab is STILL open and preserved in store!
      expect(useWorkspaceStore.getState().openTabs.length).toBe(1);
      expect(useWorkspaceStore.getState().openTabs[0].id).toBe('tab-alpha');

      // Navigate to Settings via Sidebar
      const settingsBtn = within(sidebar).getByRole('button', { name: /^Settings/i });
      fireEvent.click(settingsBtn);

      expect(useWorkspaceStore.getState().activeView).toBe('settings');
      expect(screen.getByRole('heading', { name: /^Settings/i })).toBeInTheDocument();
    });

    it('returning to Connected Apps restores the expected workspace and application state without reload', () => {
      useWorkspaceStore.setState({
        openTabs: [{ id: 'tab-alpha', appId: appA.id, title: 'alpha-app', status: 'running' }],
        activeTabId: 'tab-alpha',
        activeView: 'home',
        sidebarCollapsed: false,
      });

      render(<App />);
      expect(screen.getByRole('heading', { name: /^Overview/i })).toBeInTheDocument();

      // Return to Connected Apps via sidebar
      const sidebar = screen.getByRole('complementary', { name: /Main Navigation/i });
      const appsBtn = within(sidebar).getByRole('button', { name: /^Connected Apps/i });
      fireEvent.click(appsBtn);

      expect(useWorkspaceStore.getState().activeView).toBe('apps');
      expect(useWorkspaceStore.getState().activeTabId).toBe('tab-alpha');
      // Running app preview is restored!
      expect(screen.getByText(/alpha-app — Running/i)).toBeInTheDocument();
    });

    it('multiple connected applications retain independent state and can be switched between', () => {
      useWorkspaceStore.setState({
        openTabs: [
          { id: 'tab-alpha', appId: appA.id, title: 'alpha-app', status: 'running' },
          { id: 'tab-beta', appId: appB.id, title: 'beta-service', status: 'stopped' },
        ],
        activeTabId: 'tab-alpha',
        activeView: 'apps',
      });

      const store = useWorkspaceStore.getState();
      expect(store.openTabs.length).toBe(2);

      // Switch to beta
      store.setActiveTab('tab-beta');
      expect(useWorkspaceStore.getState().activeTabId).toBe('tab-beta');
      expect(useWorkspaceStore.getState().openTabs[0].status).toBe('running');
      expect(useWorkspaceStore.getState().openTabs[1].status).toBe('stopped');

      // Close beta tab
      store.closeTab('tab-beta');
      expect(useWorkspaceStore.getState().openTabs.length).toBe(1);
      expect(useWorkspaceStore.getState().activeTabId).toBe('tab-alpha');
      // App beta is still in connectedApps!
      expect(useWorkspaceStore.getState().connectedApps.find((a) => a.id === appB.id)).toBeDefined();
    });
  });
});
