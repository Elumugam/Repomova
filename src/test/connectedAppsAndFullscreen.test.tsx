/* ============================================================
   Connected Apps Grid, Fullscreen Mode, & Customization Tests
   ============================================================ */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { useWorkspaceStore } from '../store';
import { ConnectedAppsView } from '../components/ConnectedAppsView';
import { AppPreview } from '../components/AppPreview';
import { EditAppModal } from '../components/EditAppModal';
import { Topbar } from '../components/Topbar';
import type { ConnectedApp } from '../types';

describe('Connected Apps Grid, Full-Screen, and Customization', () => {
  const mockRunningApp: ConnectedApp = {
    id: 'app-running-1',
    userId: 'user-1',
    repoOwner: 'owner-x',
    repoName: 'dashboard-ui',
    repoFullName: 'owner-x/dashboard-ui',
    repoUrl: 'https://github.com/owner-x/dashboard-ui',
    defaultBranch: 'main',
    cloneStatus: 'cloned',
    runtimeType: 'react',
    status: 'running',
    port: 3000,
    previewUrl: 'http://127.0.0.1:3000',
    lastOpened: '2026-10-10T12:00:00.000Z',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockStoppedApp: ConnectedApp = {
    id: 'app-stopped-2',
    userId: 'user-1',
    repoOwner: 'owner-y',
    repoName: 'api-service',
    repoFullName: 'owner-y/api-service',
    repoUrl: 'https://github.com/owner-y/api-service',
    defaultBranch: 'main',
    cloneStatus: 'cloned',
    runtimeType: 'node',
    status: 'stopped',
    port: 4000,
    lastOpened: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockFailedApp: ConnectedApp = {
    id: 'app-failed-3',
    userId: 'user-1',
    repoOwner: 'owner-z',
    repoName: 'broken-service',
    repoFullName: 'owner-z/broken-service',
    repoUrl: 'https://github.com/owner-z/broken-service',
    defaultBranch: 'main',
    cloneStatus: 'cloned',
    runtimeType: 'vite',
    status: 'failed',
    lastError: 'Build failed with code 1',
    lastOpened: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    localStorage.clear();
    const store = useWorkspaceStore.getState();
    store.setConnectedApps([mockRunningApp, mockStoppedApp, mockFailedApp]);
    store.closeTab('all');
    store.setBookmarkedAppIds([]);
    store.setActiveView('apps');
  });

  // ==========================================================
  // 1. FULL-SCREEN APPLICATION VIEW
  // ==========================================================
  describe('1. Full-Screen Application View', () => {
    it('renders full-screen option in RunningAppView toolbar', () => {
      render(<AppPreview app={mockRunningApp} />);

      const fullscreenBtn = screen.getByRole('button', {
        name: /enter full-screen workspace view/i,
      });
      expect(fullscreenBtn).toBeInTheDocument();
    });

    it('entering full-screen hides standard toolbar and expands container without reload', async () => {
      render(<AppPreview app={mockRunningApp} />);

      const container = screen.getByTestId('running-app-view');
      expect(container).not.toHaveClass('preview-fullscreen');

      const initialIframe = screen.getByTitle(mockRunningApp.repoName);
      expect(initialIframe).toBeInTheDocument();

      const fullscreenBtn = screen.getByRole('button', {
        name: /enter full-screen workspace view/i,
      });
      fireEvent.click(fullscreenBtn);

      // Now in full-screen workspace mode
      expect(container).toHaveClass('preview-fullscreen');

      // Exit button is now visible
      const exitBtn = screen.getByRole('button', { name: /exit full screen/i });
      expect(exitBtn).toBeInTheDocument();

      // Standard toolbar buttons are hidden in full-screen mode
      expect(
        screen.queryByRole('button', { name: /enter full-screen workspace view/i })
      ).toBeNull();

      // Crucial: iframe remains continuously mounted and identical (running state preserved)
      const currentIframe = screen.getByTitle(mockRunningApp.repoName);
      expect(currentIframe).toBe(initialIframe);
    });

    it('clicking exit full-screen button restores normal workspace view', () => {
      render(<AppPreview app={mockRunningApp} />);

      const fullscreenBtn = screen.getByRole('button', {
        name: /enter full-screen workspace view/i,
      });
      fireEvent.click(fullscreenBtn);

      const exitBtn = screen.getByRole('button', { name: /exit full screen/i });
      fireEvent.click(exitBtn);

      const container = screen.getByTestId('running-app-view');
      expect(container).not.toHaveClass('preview-fullscreen');
      expect(screen.queryByRole('button', { name: /exit full screen/i })).toBeNull();
      expect(
        screen.getByRole('button', { name: /enter full-screen workspace view/i })
      ).toBeInTheDocument();
    });

    it('Escape (Esc) keyboard shortcut exits full-screen mode', () => {
      render(<AppPreview app={mockRunningApp} />);

      const fullscreenBtn = screen.getByRole('button', {
        name: /enter full-screen workspace view/i,
      });
      fireEvent.click(fullscreenBtn);

      const container = screen.getByTestId('running-app-view');
      expect(container).toHaveClass('preview-fullscreen');

      // Press Escape
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

      expect(container).not.toHaveClass('preview-fullscreen');
      expect(screen.queryByRole('button', { name: /exit full screen/i })).toBeNull();
    });

    it('handles browser Fullscreen API restrictions and failures gracefully', async () => {
      // Mock requestFullscreen to reject or throw (simulate browser permission restrictions)
      const requestMock = vi.fn().mockRejectedValue(new Error('Fullscreen request denied'));
      Element.prototype.requestFullscreen = requestMock;

      render(<AppPreview app={mockRunningApp} />);

      const fullscreenBtn = screen.getByRole('button', {
        name: /enter full-screen workspace view/i,
      });

      // Should not throw and should still enter Repomova workspace full-screen
      expect(() => fireEvent.click(fullscreenBtn)).not.toThrow();

      const container = screen.getByTestId('running-app-view');
      expect(container).toHaveClass('preview-fullscreen');
      expect(screen.getByRole('button', { name: /exit full screen/i })).toBeInTheDocument();
    });

    it('enters full screen when triggered via custom event from Topbar or Connected Apps', async () => {
      render(<AppPreview app={mockRunningApp} />);

      const container = screen.getByTestId('running-app-view');
      expect(container).not.toHaveClass('preview-fullscreen');

      // Dispatch event
      act(() => {
        window.dispatchEvent(
          new CustomEvent('repomova-enter-fullscreen', { detail: { appId: mockRunningApp.id } })
        );
      });

      await waitFor(() => {
        expect(container).toHaveClass('preview-fullscreen');
      });
    });

    it('renders full-screen action button in Topbar when running application tab is active', () => {
      useWorkspaceStore.setState({
        openTabs: [
          {
            id: `tab-${mockRunningApp.id}`,
            appId: mockRunningApp.id,
            title: mockRunningApp.repoName,
            status: 'running',
          },
        ],
        activeTabId: `tab-${mockRunningApp.id}`,
      });

      render(<Topbar />);

      const topbarFullscreenBtn = screen.getByRole('button', {
        name: /enter full-screen workspace view/i,
      });
      expect(topbarFullscreenBtn).toBeInTheDocument();
    });
  });

  // ==========================================================
  // 2. CONNECTED REPOSITORIES GRID
  // ==========================================================
  describe('2. Connected Repositories Grid', () => {
    it('renders modern, responsive grid with tiles for each connected repository', () => {
      render(<ConnectedAppsView />);

      const grid = screen.getByTestId('connected-apps-grid');
      expect(grid).toBeInTheDocument();
      expect(grid).toHaveClass('connected-apps-grid');

      // Three cards should be rendered
      expect(screen.getByTestId(`app-card-${mockRunningApp.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`app-card-${mockStoppedApp.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`app-card-${mockFailedApp.id}`)).toBeInTheDocument();
    });

    it('each tile displays repository name, owner, runtime, and status', () => {
      render(<ConnectedAppsView />);

      const card1 = screen.getByTestId(`app-card-${mockRunningApp.id}`);
      expect(within(card1).getByText('dashboard-ui')).toBeInTheDocument();
      expect(within(card1).getByText('owner-x/dashboard-ui')).toBeInTheDocument();
      expect(within(card1).getByText('Running')).toBeInTheDocument();
      expect(within(card1).getByText(':3000')).toBeInTheDocument();
      expect(within(card1).getAllByText('React').length).toBeGreaterThan(0);

      const card2 = screen.getByTestId(`app-card-${mockStoppedApp.id}`);
      expect(within(card2).getByText('api-service')).toBeInTheDocument();
      expect(within(card2).getByText('owner-y/api-service')).toBeInTheDocument();
      expect(within(card2).getByText('Stopped')).toBeInTheDocument();
      expect(within(card2).getAllByText('Node.js').length).toBeGreaterThan(0);
    });

    it('provides Stop action for running application and updates status to stopped', () => {
      render(<ConnectedAppsView />);

      const card1 = screen.getByTestId(`app-card-${mockRunningApp.id}`);
      const stopBtn = within(card1).getByRole('button', { name: `Stop ${mockRunningApp.repoName}` });
      expect(stopBtn).toBeInTheDocument();

      fireEvent.click(stopBtn);

      const app = useWorkspaceStore.getState().connectedApps.find((a) => a.id === mockRunningApp.id);
      expect(app?.status).toBe('stopped');
    });

    it('provides Launch action for stopped application', () => {
      render(<ConnectedAppsView />);

      const card2 = screen.getByTestId(`app-card-${mockStoppedApp.id}`);
      const launchBtn = within(card2).getByRole('button', { name: `Launch ${mockStoppedApp.repoName}` });
      expect(launchBtn).toBeInTheDocument();

      fireEvent.click(launchBtn);

      // Opens tab for this app
      const tabs = useWorkspaceStore.getState().openTabs;
      expect(tabs.some((t) => t.appId === mockStoppedApp.id)).toBe(true);
    });

    it('provides Open action to navigate to application in workspace', () => {
      render(<ConnectedAppsView />);

      const card1 = screen.getByTestId(`app-card-${mockRunningApp.id}`);
      const openBtn = within(card1).getByRole('button', { name: `Open ${mockRunningApp.repoName}` });
      fireEvent.click(openBtn);

      const store = useWorkspaceStore.getState();
      expect(store.openTabs.some((t) => t.appId === mockRunningApp.id)).toBe(true);
    });

    it('provides Bookmark action that toggles bookmark state', () => {
      render(<ConnectedAppsView />);

      const card1 = screen.getByTestId(`app-card-${mockRunningApp.id}`);
      const bookmarkBtn = within(card1).getByRole('button', { name: `Bookmark ${mockRunningApp.repoName}` });
      fireEvent.click(bookmarkBtn);

      expect(useWorkspaceStore.getState().isBookmarked(mockRunningApp.id)).toBe(true);

      // Click again to unbookmark
      const unbookmarkBtn = within(card1).getByRole('button', { name: `Unbookmark ${mockRunningApp.repoName}` });
      fireEvent.click(unbookmarkBtn);

      expect(useWorkspaceStore.getState().isBookmarked(mockRunningApp.id)).toBe(false);
    });

    it('provides Configure action that opens configuration modal', () => {
      render(<ConnectedAppsView />);

      const card1 = screen.getByTestId(`app-card-${mockRunningApp.id}`);
      const cfgBtn = within(card1).getByRole('button', { name: `Configure ${mockRunningApp.repoName}` });
      fireEvent.click(cfgBtn);

      expect(screen.getByText(/Configuration Wizard/i)).toBeInTheDocument();
    });

    it('search filter filters grid cards in real time', () => {
      render(<ConnectedAppsView />);

      const searchInput = screen.getByPlaceholderText(/Search applications/i);
      fireEvent.change(searchInput, { target: { value: 'dashboard' } });

      expect(screen.getByTestId(`app-card-${mockRunningApp.id}`)).toBeInTheDocument();
      expect(screen.queryByTestId(`app-card-${mockStoppedApp.id}`)).toBeNull();
    });

    it('status filter filters grid cards by running / stopped / failed status', () => {
      render(<ConnectedAppsView />);

      const select = screen.getByLabelText(/Filter applications by status/i);
      fireEvent.change(select, { target: { value: 'stopped' } });

      expect(screen.queryByTestId(`app-card-${mockRunningApp.id}`)).toBeNull();
      expect(screen.getByTestId(`app-card-${mockStoppedApp.id}`)).toBeInTheDocument();
      expect(screen.queryByTestId(`app-card-${mockFailedApp.id}`)).toBeNull();
    });
  });

  // ==========================================================
  // 3. EDIT CONNECTED APP NAME & PERSISTENCE
  // ==========================================================
  describe('3. Edit Connected App Name', () => {
    it('opens EditAppModal when edit button is clicked', () => {
      render(<ConnectedAppsView />);

      const card1 = screen.getByTestId(`app-card-${mockRunningApp.id}`);
      const editBtn = within(card1).getByRole('button', { name: `Edit ${mockRunningApp.repoName}` });
      fireEvent.click(editBtn);

      expect(screen.getByRole('heading', { name: /Edit Application/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/Display Name/i)).toHaveValue(mockRunningApp.repoName);
    });

    it('updates custom display name without modifying original GitHub repoName', async () => {
      render(<EditAppModal app={mockRunningApp} isOpen={true} onClose={() => {}} />);

      const nameInput = screen.getByLabelText(/Display Name/i);
      fireEvent.change(nameInput, { target: { value: 'Customer Portal V2' } });

      const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        const app = useWorkspaceStore.getState().connectedApps.find((a) => a.id === mockRunningApp.id);
        expect(app?.displayName).toBe('Customer Portal V2');
        // Original repo properties are strictly unchanged!
        expect(app?.repoName).toBe('dashboard-ui');
        expect(app?.repoFullName).toBe('owner-x/dashboard-ui');
        expect(app?.repoUrl).toBe('https://github.com/owner-x/dashboard-ui');
      });
    });

    it('validates display name and prevents saving empty or whitespace-only name', () => {
      render(<EditAppModal app={mockRunningApp} isOpen={true} onClose={() => {}} />);

      const nameInput = screen.getByLabelText(/Display Name/i);
      fireEvent.change(nameInput, { target: { value: '   ' } });

      expect(screen.getByText('Display name cannot be empty.')).toBeInTheDocument();
      const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
      expect(saveBtn).toBeDisabled();
    });

    it('persists custom display name in localStorage and restores after reload', () => {
      const store = useWorkspaceStore.getState();
      store.updateApp(mockRunningApp.id, { displayName: 'Persisted Analytics UI' });

      // Check localStorage
      const savedRaw = localStorage.getItem('repomova-app-customizations');
      expect(savedRaw).not.toBeNull();
      const saved = JSON.parse(savedRaw!);
      expect(saved[mockRunningApp.id].displayName).toBe('Persisted Analytics UI');

      // Simulate re-fetching fresh apps from GitHub without displayName
      const freshAppsFromGitHub: ConnectedApp[] = [
        { ...mockRunningApp, displayName: undefined },
      ];
      store.setConnectedApps(freshAppsFromGitHub);

      // Stored displayName should be seamlessly restored!
      const restored = useWorkspaceStore.getState().connectedApps[0];
      expect(restored.displayName).toBe('Persisted Analytics UI');
      expect(restored.repoName).toBe('dashboard-ui');
    });

    it('updating display name updates open tab title immediately', () => {
      const store = useWorkspaceStore.getState();
      store.openTab({
        id: `tab-${mockRunningApp.id}`,
        appId: mockRunningApp.id,
        title: mockRunningApp.repoName,
      });

      expect(useWorkspaceStore.getState().openTabs[0].title).toBe('dashboard-ui');

      store.updateApp(mockRunningApp.id, { displayName: 'Updated Workspace Tab Title' });

      expect(useWorkspaceStore.getState().openTabs[0].title).toBe('Updated Workspace Tab Title');
    });
  });

  // ==========================================================
  // 4. CUSTOM THUMBNAIL IMAGES & VALIDATION
  // ==========================================================
  describe('4. Custom Thumbnail Images', () => {
    it('displays default thumbnail with runtime badge when no custom image is selected', () => {
      render(<ConnectedAppsView />);

      const card1 = screen.getByTestId(`app-card-${mockRunningApp.id}`);
      // Default thumbnail tag showing 'React'
      expect(within(card1).getAllByText('React').length).toBeGreaterThan(0);
      expect(within(card1).queryByRole('img')).toBeNull();
    });

    it('renders custom image thumbnail when set on connected app', () => {
      const appWithThumb: ConnectedApp = {
        ...mockRunningApp,
        customThumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      };

      useWorkspaceStore.getState().setConnectedApps([appWithThumb]);

      render(<ConnectedAppsView />);

      const card = screen.getByTestId(`app-card-${appWithThumb.id}`);
      const img = within(card).getByRole('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', appWithThumb.customThumbnail);
    });

    it('validates uploaded image file format and rejects invalid extensions', () => {
      render(<EditAppModal app={mockRunningApp} isOpen={true} onClose={() => {}} />);

      // Find hidden file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();

      const invalidFile = new File(['dummy content'], 'report.pdf', { type: 'application/pdf' });
      fireEvent.change(fileInput, { target: { files: [invalidFile] } });

      expect(screen.getByText(/Unsupported format/i)).toBeInTheDocument();
    });

    it('validates uploaded image file size and rejects files exceeding 2MB', () => {
      render(<EditAppModal app={mockRunningApp} isOpen={true} onClose={() => {}} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      // 3MB file
      const largeContent = new Uint8Array(3 * 1024 * 1024);
      const largeFile = new File([largeContent], 'huge.png', { type: 'image/png' });

      fireEvent.change(fileInput, { target: { files: [largeFile] } });

      expect(screen.getByText(/File size exceeds 2MB limit/i)).toBeInTheDocument();
    });

    it('allows resetting custom thumbnail back to default', async () => {
      const appWithThumb: ConnectedApp = {
        ...mockRunningApp,
        customThumbnail: 'data:image/png;base64,mock',
      };

      render(<EditAppModal app={appWithThumb} isOpen={true} onClose={() => {}} />);

      const resetThumbBtn = screen.getByRole('button', { name: /Reset to default/i });
      fireEvent.click(resetThumbBtn);

      const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        const app = useWorkspaceStore.getState().connectedApps.find((a) => a.id === mockRunningApp.id);
        expect(app?.customThumbnail).toBeUndefined();
      });
    });

    it('persists custom thumbnail changes in localStorage across sessions', () => {
      const store = useWorkspaceStore.getState();
      const mockThumbData = 'data:image/png;base64,storedThumbnail123';
      store.updateApp(mockRunningApp.id, { customThumbnail: mockThumbData });

      const savedRaw = localStorage.getItem('repomova-app-customizations');
      expect(savedRaw).toContain('storedThumbnail123');

      // Re-initialize connectedApps
      store.setConnectedApps([{ ...mockRunningApp, customThumbnail: undefined }]);
      const restored = useWorkspaceStore.getState().connectedApps[0];
      expect(restored.customThumbnail).toBe(mockThumbData);
    });
  });

  // ==========================================================
  // 5. INDEPENDENT REPOSITORIES & NAVIGATION INTEGRITY
  // ==========================================================
  describe('5. Independent Repositories & Navigation', () => {
    it('launching one repository does not accidentally launch or switch another repository', () => {
      const store = useWorkspaceStore.getState();

      // Launch app 1
      store.openTab({
        id: `tab-${mockRunningApp.id}`,
        appId: mockRunningApp.id,
        title: mockRunningApp.repoName,
        status: 'running',
      });

      // App 2 remains stopped
      const app2 = store.connectedApps.find((a) => a.id === mockStoppedApp.id);
      expect(app2?.status).toBe('stopped');

      // Launch app 2 in another tab
      store.openTab({
        id: `tab-${mockStoppedApp.id}`,
        appId: mockStoppedApp.id,
        title: mockStoppedApp.repoName,
        status: 'stopped',
      });

      const tabs = useWorkspaceStore.getState().openTabs;
      expect(tabs).toHaveLength(2);
      expect(tabs[0].appId).toBe(mockRunningApp.id);
      expect(tabs[1].appId).toBe(mockStoppedApp.id);
      expect(tabs[0].status).toBe('running');
      expect(tabs[1].status).toBe('stopped');
    });

    it('failed applications display diagnostic launch error without crashing other applications', () => {
      render(<AppPreview app={mockFailedApp} />);

      expect(screen.getByText(/How to resolve this issue/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry Launch/i })).toBeInTheDocument();

      // Running app is completely unaffected
      const runningInStore = useWorkspaceStore.getState().connectedApps.find((a) => a.id === mockRunningApp.id);
      expect(runningInStore?.status).toBe('running');
    });
  });
});
