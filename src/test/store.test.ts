import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore } from '../store';
import type { ConnectedApp, OpenTab } from '../types';

describe('useWorkspaceStore', () => {
  beforeEach(() => {
    // Reset store state
    const store = useWorkspaceStore.getState();
    store.setConnectedApps([]);
    store.closeTab('all');
    store.setUser(null);
    store.setTheme('dark');
  });

  it('manages theme changes and localStorage', () => {
    const store = useWorkspaceStore.getState();
    store.setTheme('light');
    expect(useWorkspaceStore.getState().theme).toBe('light');

    store.toggleTheme();
    expect(useWorkspaceStore.getState().theme).toBe('dark');
  });

  it('adds, updates status, and removes connected apps', () => {
    const mockApp: ConnectedApp = {
      id: 'app-test-1',
      userId: 'user-1',
      repoOwner: 'owner',
      repoName: 'test-repo',
      repoFullName: 'owner/test-repo',
      repoUrl: 'https://github.com/owner/test-repo',
      defaultBranch: 'main',
      cloneStatus: 'cloned',
      runtimeType: 'vite',
      status: 'connected',
      lastOpened: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    useWorkspaceStore.getState().addConnectedApp(mockApp);
    expect(useWorkspaceStore.getState().connectedApps).toHaveLength(1);
    expect(useWorkspaceStore.getState().connectedApps[0].repoName).toBe('test-repo');

    // Update status
    useWorkspaceStore.getState().updateAppStatus('app-test-1', 'running');
    expect(useWorkspaceStore.getState().connectedApps[0].status).toBe('running');

    // Remove app
    useWorkspaceStore.getState().removeConnectedApp('app-test-1');
    expect(useWorkspaceStore.getState().connectedApps).toHaveLength(0);
  });

  it('manages tab operations (open, switch active, close)', () => {
    const tab1: OpenTab = { id: 'tab-1', appId: 'app-1', title: 'App 1', status: 'connected' };
    const tab2: OpenTab = { id: 'tab-2', appId: 'app-2', title: 'App 2', status: 'running' };

    useWorkspaceStore.getState().openTab(tab1);
    expect(useWorkspaceStore.getState().openTabs).toHaveLength(1);
    expect(useWorkspaceStore.getState().activeTabId).toBe('tab-1');

    useWorkspaceStore.getState().openTab(tab2);
    expect(useWorkspaceStore.getState().openTabs).toHaveLength(2);
    expect(useWorkspaceStore.getState().activeTabId).toBe('tab-2');

    // Opening existing tab switches to it without duplicating
    useWorkspaceStore.getState().openTab(tab1);
    expect(useWorkspaceStore.getState().openTabs).toHaveLength(2);
    expect(useWorkspaceStore.getState().activeTabId).toBe('tab-1');

    // Close tab1 should activate remaining tab
    useWorkspaceStore.getState().closeTab('tab-1');
    expect(useWorkspaceStore.getState().openTabs).toHaveLength(1);
    expect(useWorkspaceStore.getState().activeTabId).toBe('tab-2');
  });

  it('handles user authentication state', () => {
    expect(useWorkspaceStore.getState().isAuthenticated).toBe(false);

    useWorkspaceStore.getState().setUser({
      id: 'usr-123',
      email: 'alex@example.com',
      displayName: 'Alex Morgan',
      avatarUrl: undefined,
      createdAt: new Date().toISOString(),
    });

    expect(useWorkspaceStore.getState().isAuthenticated).toBe(true);
    expect(useWorkspaceStore.getState().user?.email).toBe('alex@example.com');

    useWorkspaceStore.getState().setUser(null);
    expect(useWorkspaceStore.getState().isAuthenticated).toBe(false);
  });

  describe('Multi-Window Management', () => {
    const mockApp1: ConnectedApp = {
      id: 'app-web-1',
      userId: 'user-1',
      repoOwner: 'owner',
      repoName: 'my-web-app',
      repoFullName: 'owner/my-web-app',
      repoUrl: 'https://github.com/owner/my-web-app',
      defaultBranch: 'main',
      cloneStatus: 'cloned',
      runtimeType: 'vite',
      status: 'running',
      port: 4120,
      lastOpened: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockApp2: ConnectedApp = {
      id: 'app-web-2',
      userId: 'user-1',
      repoOwner: 'owner',
      repoName: 'my-api-service',
      repoFullName: 'owner/my-api-service',
      repoUrl: 'https://github.com/owner/my-api-service',
      defaultBranch: 'main',
      cloneStatus: 'cloned',
      runtimeType: 'backend',
      status: 'stopped',
      lastOpened: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    beforeEach(() => {
      const store = useWorkspaceStore.getState();
      store.setConnectedApps([mockApp1, mockApp2]);
      store.closeTab('all');
    });

    it('opens initial tab and opens additional views with "+" openNewWindow', () => {
      const store = useWorkspaceStore.getState();

      // Open initial tab for App 1
      const initialTabId = store.openNewWindow(mockApp1.id);
      expect(initialTabId).toBeDefined();
      expect(useWorkspaceStore.getState().openTabs).toHaveLength(1);
      expect(useWorkspaceStore.getState().openTabs[0].title).toBe('my-web-app');
      expect(useWorkspaceStore.getState().openTabs[0].appId).toBe(mockApp1.id);
      expect(useWorkspaceStore.getState().activeTabId).toBe(initialTabId);

      // Open a second view for the same app using openNewWindow
      const secondTabId = store.openNewWindow(mockApp1.id);
      expect(secondTabId).toBeDefined();
      expect(secondTabId).not.toBe(initialTabId);
      expect(useWorkspaceStore.getState().openTabs).toHaveLength(2);
      expect(useWorkspaceStore.getState().openTabs[1].title).toBe('my-web-app (2)');
      expect(useWorkspaceStore.getState().openTabs[1].appId).toBe(mockApp1.id);
      expect(useWorkspaceStore.getState().activeTabId).toBe(secondTabId);

      // Open a third view
      const thirdTabId = store.openNewWindow(mockApp1.id);
      expect(useWorkspaceStore.getState().openTabs).toHaveLength(3);
      expect(useWorkspaceStore.getState().openTabs[2].title).toBe('my-web-app (3)');
      expect(useWorkspaceStore.getState().openTabs[2].appId).toBe(mockApp1.id);
      expect(useWorkspaceStore.getState().activeTabId).toBe(thirdTabId);
    });

    it('switches between connected applications and multiple windows', () => {
      const store = useWorkspaceStore.getState();

      const tabApp1Win1 = store.openNewWindow(mockApp1.id);
      const tabApp2Win1 = store.openNewWindow(mockApp2.id);
      const tabApp1Win2 = store.openNewWindow(mockApp1.id);

      expect(useWorkspaceStore.getState().openTabs).toHaveLength(3);
      expect(useWorkspaceStore.getState().activeTabId).toBe(tabApp1Win2);

      // Switch to App 2
      useWorkspaceStore.getState().setActiveTab(tabApp2Win1!);
      expect(useWorkspaceStore.getState().activeTabId).toBe(tabApp2Win1);

      // Switch back to App 1 Window 1
      useWorkspaceStore.getState().setActiveTab(tabApp1Win1!);
      expect(useWorkspaceStore.getState().activeTabId).toBe(tabApp1Win1);
    });

    it('closes an individual window without deleting or disconnecting the repository', () => {
      const store = useWorkspaceStore.getState();

      const tab1 = store.openNewWindow(mockApp1.id);
      const tab2 = store.openNewWindow(mockApp1.id);

      expect(useWorkspaceStore.getState().openTabs).toHaveLength(2);
      expect(useWorkspaceStore.getState().connectedApps).toHaveLength(2);

      // Close window 2
      useWorkspaceStore.getState().closeTab(tab2!);

      // Only window 2 was closed; window 1 remains active
      expect(useWorkspaceStore.getState().openTabs).toHaveLength(1);
      expect(useWorkspaceStore.getState().openTabs[0].id).toBe(tab1);

      // Crucial: The repository is NOT deleted from connectedApps!
      expect(useWorkspaceStore.getState().connectedApps).toHaveLength(2);
      expect(useWorkspaceStore.getState().connectedApps[0].id).toBe(mockApp1.id);
      expect(useWorkspaceStore.getState().connectedApps[0].status).toBe('running');
    });

    it('reopens a previously closed connected application', () => {
      const store = useWorkspaceStore.getState();

      const tab1 = store.openNewWindow(mockApp1.id);
      expect(useWorkspaceStore.getState().openTabs).toHaveLength(1);

      // Close all tabs
      useWorkspaceStore.getState().closeTab(tab1!);
      expect(useWorkspaceStore.getState().openTabs).toHaveLength(0);

      // App is still saved in Connected Apps
      expect(useWorkspaceStore.getState().connectedApps.find((a) => a.id === mockApp1.id)).toBeDefined();

      // Reopen app from saved state
      const reopenedTab = store.openNewWindow(mockApp1.id);
      expect(useWorkspaceStore.getState().openTabs).toHaveLength(1);
      expect(useWorkspaceStore.getState().openTabs[0].appId).toBe(mockApp1.id);
      expect(useWorkspaceStore.getState().activeTabId).toBe(reopenedTab);
    });

    it('verifies that multiple views share the same application runtime, port, and status without duplication', () => {
      const store = useWorkspaceStore.getState();

      store.openNewWindow(mockApp1.id);
      store.openNewWindow(mockApp1.id);

      const openTabs = useWorkspaceStore.getState().openTabs;
      expect(openTabs).toHaveLength(2);

      // Both views reference the EXACT same appId
      expect(openTabs[0].appId).toBe(mockApp1.id);
      expect(openTabs[1].appId).toBe(mockApp1.id);

      // In the store, there remains only 1 instance of the app with its single port
      const appInStore = useWorkspaceStore.getState().connectedApps.find((a) => a.id === mockApp1.id);
      expect(appInStore?.port).toBe(4120);
      expect(appInStore?.status).toBe('running');

      // Status updates apply to all views sharing the same app
      store.updateAppStatus(mockApp1.id, 'stopped');
      expect(useWorkspaceStore.getState().connectedApps.find((a) => a.id === mockApp1.id)?.status).toBe('stopped');
      expect(useWorkspaceStore.getState().openTabs[0].status).toBe('stopped');
      expect(useWorkspaceStore.getState().openTabs[1].status).toBe('stopped');
    });
  });
});

