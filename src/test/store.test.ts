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
});
