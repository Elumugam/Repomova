import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWorkspaceStore } from '../store';
import { Topbar } from '../components/Topbar';
import { ConnectModal } from '../components/ConnectModal';
import { ConfigModal } from '../components/ConfigModal';
import { AppPreview } from '../components/AppPreview';
import type { ConnectedApp } from '../types';

describe('Workspace Surgical Features & Improvements', () => {
  beforeEach(() => {
    localStorage.clear();
    const store = useWorkspaceStore.getState();
    store.setConnectedApps([]);
    store.closeTab('all');
    store.setConnectModalOpen(false);
  });

  describe('Requirement 1: "+" Button for Opening New Application Windows', () => {
    const testApp: ConnectedApp = {
      id: 'app-win-test',
      userId: 'user-1',
      repoOwner: 'owner',
      repoName: 'react-dashboard',
      repoFullName: 'owner/react-dashboard',
      repoUrl: 'https://github.com/owner/react-dashboard',
      defaultBranch: 'main',
      cloneStatus: 'cloned',
      runtimeType: 'react',
      status: 'running',
      port: 3000,
      lastOpened: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('renders "+" button with accessible label in workspace topbar', () => {
      useWorkspaceStore.setState({
        connectedApps: [testApp],
        openTabs: [{ id: 'tab-1', appId: testApp.id, title: 'react-dashboard', status: 'running' }],
        activeTabId: 'tab-1',
      });

      render(<Topbar />);
      const plusBtn = screen.getByRole('button', { name: /open new application window/i });
      expect(plusBtn).toBeInTheDocument();
    });

    it('clicking "+" button opens a new empty workspace without duplicating the active application', () => {
      useWorkspaceStore.setState({
        connectedApps: [testApp],
        openTabs: [{ id: 'tab-1', appId: testApp.id, title: 'react-dashboard', status: 'running' }],
        activeTabId: 'tab-1',
      });

      render(<Topbar />);
      const plusBtn = screen.getByRole('button', { name: /open new application window/i });
      fireEvent.click(plusBtn);

      const tabs = useWorkspaceStore.getState().openTabs;
      expect(tabs.length).toBe(2);
      expect(tabs[1].title).toBe('New Workspace');
      expect(tabs[1].appId).toBe('');
      expect(tabs[1].appId).not.toBe(testApp.id);
      expect(useWorkspaceStore.getState().activeTabId).toBe(tabs[1].id);
      expect(tabs[0].appId).toBe(testApp.id);
      expect(tabs[0].status).toBe('running');
    });

    it('closing an individual window view preserves the connected repository and running status', () => {
      useWorkspaceStore.setState({
        connectedApps: [testApp],
        openTabs: [
          { id: 'tab-1', appId: testApp.id, title: 'react-dashboard', status: 'running' },
          { id: 'tab-2', appId: testApp.id, title: 'react-dashboard (2)', status: 'running' },
        ],
        activeTabId: 'tab-2',
      });

      render(<Topbar />);
      // Find close window icons
      const closeButtons = screen.getAllByTitle('Close window');
      expect(closeButtons.length).toBe(2);

      // Close the second tab
      fireEvent.click(closeButtons[1]);

      expect(useWorkspaceStore.getState().openTabs.length).toBe(1);
      expect(useWorkspaceStore.getState().openTabs[0].id).toBe('tab-1');

      // Crucial: Repository must remain connected and running in connectedApps!
      const apps = useWorkspaceStore.getState().connectedApps;
      expect(apps.length).toBe(1);
      expect(apps[0].id).toBe(testApp.id);
      expect(apps[0].status).toBe('running');
    });

    it('does not render "+" icon beside Repomova label when no tabs are open, and renders Sign In button for unauthenticated users', () => {
      useWorkspaceStore.setState({
        connectedApps: [],
        openTabs: [],
        activeTabId: null,
        isAuthenticated: false,
        user: null,
      });

      const { unmount } = render(<Topbar />);

      // Repomova label is visible
      expect(screen.getByText('Repomova')).toBeInTheDocument();

      // "+" button beside Repomova is NOT rendered
      expect(screen.queryByRole('button', { name: /open new application window/i })).toBeNull();

      // "Sign In" button is in Topbar and navigates to signin view
      const signInBtn = screen.getByRole('button', { name: /^Sign In/i });
      expect(signInBtn).toBeInTheDocument();
      fireEvent.click(signInBtn);
      expect(useWorkspaceStore.getState().activeView).toBe('signin');

      // "Connect" option is visible and functional
      const connectBtn = screen.getByRole('button', { name: /Connect/i });
      expect(connectBtn).toBeInTheDocument();
      fireEvent.click(connectBtn);
      expect(useWorkspaceStore.getState().connectModalOpen).toBe(true);

      unmount();

      // Also when connectedApps has items but no tabs are open
      useWorkspaceStore.setState({
        connectedApps: [testApp],
        openTabs: [],
        activeTabId: null,
        connectModalOpen: false,
        isAuthenticated: false,
        user: null,
      });

      render(<Topbar />);
      expect(screen.getByText('Repomova')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /open new application window/i })).toBeNull();
      expect(screen.getByRole('button', { name: /^Sign In/i })).toBeInTheDocument();
    });
  });

  describe('Requirement 2: Fix Blank Screens for Repositories Without a Frontend', () => {
    it('displays custom Repomova Project Overview page instead of blank iframe for backend-only APIs', () => {
      const backendApp: ConnectedApp = {
        id: 'app-backend-1',
        userId: 'user-1',
        repoOwner: 'octocat',
        repoName: 'order-service-api',
        repoFullName: 'octocat/order-service-api',
        repoUrl: 'https://github.com/octocat/order-service-api',
        defaultBranch: 'main',
        cloneStatus: 'cloned',
        runtimeType: 'backend',
        hasWebInterface: false,
        status: 'stopped',
        entryPoint: 'server.js',
        lastOpened: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      render(<AppPreview app={backendApp} />);

      // Must NOT render an iframe for non-frontend repos
      const iframe = document.querySelector('iframe');
      expect(iframe).toBeNull();

      // Must display Project Overview page
      const badges = screen.getAllByText('Backend API / Service');
      expect(badges.length).toBeGreaterThan(0);
      expect(screen.getByText('order-service-api')).toBeInTheDocument();
      expect(screen.getByText(/octocat\/order-service-api/i)).toBeInTheDocument();

      // Explains why graphical interface is unavailable
      expect(screen.getByText('Graphical Browser Interface Unavailable')).toBeInTheDocument();
      expect(screen.getByText(/backend API or service/i)).toBeInTheDocument();

      // Displays actionable buttons: Start Service, Check Health, View Logs, Configure
      expect(screen.getByRole('button', { name: /Start Service/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Configure Project/i })).toBeInTheDocument();

      // Does not show a false "Running" status
      expect(screen.queryByText(/^Running$/i)).toBeNull();
    });

    it('displays custom Project Overview page for CLI tools and libraries', () => {
      const cliApp: ConnectedApp = {
        id: 'app-cli-1',
        userId: 'user-1',
        repoOwner: 'developer',
        repoName: 'csv-parser-cli',
        repoFullName: 'developer/csv-parser-cli',
        repoUrl: 'https://github.com/developer/csv-parser-cli',
        defaultBranch: 'main',
        cloneStatus: 'cloned',
        runtimeType: 'cli',
        hasWebInterface: false,
        status: 'stopped',
        lastOpened: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      render(<AppPreview app={cliApp} />);

      expect(document.querySelector('iframe')).toBeNull();
      const cliBadges = screen.getAllByText('CLI Tool');
      expect(cliBadges.length).toBeGreaterThan(0);
      expect(screen.getByText(/command-line interface \(CLI\) tool/i)).toBeInTheDocument();
    });
  });

  describe('Requirement 3: Repository Connection Guidance Note', () => {
    it('displays exact required guidance note text in connection modal', () => {
      useWorkspaceStore.setState({ connectModalOpen: true });
      render(<ConnectModal />);

      const expectedNote =
        'For the best Repomova experience, connect a repository containing a runnable frontend or web application. Projects built with React, Vite, Next.js, Vue, HTML/CSS/JavaScript, and other supported frontend frameworks can be opened in the workspace. Backend-only projects, CLI tools, and libraries may require additional configuration and might not provide a graphical interface.';

      expect(screen.getByText(expectedNote)).toBeInTheDocument();
    });
  });

  describe('Requirement 4: Actionable Application Launch Errors', () => {
    it('displays actionable error cause, explanation, and resolution steps when launch fails', () => {
      const failedApp: ConnectedApp = {
        id: 'app-failed-1',
        userId: 'user-1',
        repoOwner: 'test',
        repoName: 'broken-app',
        repoFullName: 'test/broken-app',
        repoUrl: 'https://github.com/test/broken-app',
        defaultBranch: 'main',
        cloneStatus: 'cloned',
        runtimeType: 'vite',
        status: 'failed',
        lastError: 'listen EADDRINUSE: address already in use :::5173',
        port: 5173,
        lastOpened: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      render(<AppPreview app={failedApp} />);

      // Clear error title and detected cause
      expect(screen.getByText('Port Conflict Detected')).toBeInTheDocument();
      expect(screen.getByText(/Port 5173 is currently unavailable or in use by another application/i)).toBeInTheDocument();
      expect(screen.getByText(/another local process is occupying this port/i)).toBeInTheDocument();

      // Step by step resolution instructions
      expect(screen.getByText(/How to resolve this issue/i)).toBeInTheDocument();

      // Quick fix field for port is provided
      expect(screen.getByText(/Override Application Port/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g. 4150')).toBeInTheDocument();

      // Retry and Configure actions
      expect(screen.getByRole('button', { name: /Retry Launch/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Configure Project/i })).toBeInTheDocument();

      // Logs toggle
      expect(screen.getByRole('button', { name: /View Logs/i })).toBeInTheDocument();
    });

    it('identifies missing start command error with actionable advice and quick-fix input', () => {
      const missingCmdApp: ConnectedApp = {
        id: 'app-failed-2',
        userId: 'user-1',
        repoOwner: 'test',
        repoName: 'no-script-app',
        repoFullName: 'test/no-script-app',
        repoUrl: 'https://github.com/test/no-script-app',
        defaultBranch: 'main',
        cloneStatus: 'cloned',
        runtimeType: 'react',
        status: 'failed',
        lastError: 'npm ERR! Missing script: "dev"',
        lastOpened: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      render(<AppPreview app={missingCmdApp} />);

      expect(screen.getByText('Start Command Execution Failure')).toBeInTheDocument();
      expect(screen.getByText(/The start command "npm start" could not be found or exited with an error/i)).toBeInTheDocument();
      expect(screen.getByText('Update Start Command')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g. npm run dev')).toBeInTheDocument();
    });
  });

  describe('Requirement 5: Redesigned Configuration Wizard', () => {
    const staticApp: ConnectedApp = {
      id: 'app-cfg-static',
      userId: 'user-1',
      repoOwner: 'nolangz',
      repoName: 'pixel2motion',
      repoFullName: 'nolangz/pixel2motion',
      repoUrl: 'https://github.com/nolangz/pixel2motion',
      defaultBranch: 'main',
      cloneStatus: 'cloned',
      runtimeType: 'static',
      status: 'connected',
      entryPoint: 'docs/index.html',
      detectionDetails: 'Static HTML5 website (entry file: docs/index.html)',
      lastOpened: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nodeApp: ConnectedApp = {
      id: 'app-cfg-node',
      userId: 'user-1',
      repoOwner: 'acme',
      repoName: 'shop-dashboard',
      repoFullName: 'acme/shop-dashboard',
      repoUrl: 'https://github.com/acme/shop-dashboard',
      defaultBranch: 'main',
      cloneStatus: 'cloned',
      runtimeType: 'vite',
      status: 'connected',
      startCommand: 'npm run dev',
      detectedEnvVars: [
        { key: 'API_SECRET_KEY', required: true, isSecret: true },
        { key: 'VITE_PUBLIC_URL', required: false, isSecret: false },
      ],
      lastOpened: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('renders Claude-inspired minimal header with repo name, project type badge, and close button', () => {
      render(<ConfigModal app={staticApp} isOpen={true} onClose={() => {}} />);

      expect(screen.getByText('Configuration Wizard — pixel2motion')).toBeInTheDocument();
      expect(screen.getByText('nolangz/pixel2motion • main')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Close configuration wizard/i })).toBeInTheDocument();
    });

    it('displays read-only auto-configured settings for static sites without unnecessary framework inputs', () => {
      render(<ConfigModal app={staticApp} isOpen={true} onClose={() => {}} />);

      // Shows auto-configured static server badge
      expect(screen.getByText(/Start Command: Built-in Static Server/i)).toBeInTheDocument();
      expect(screen.getByText(/Auto-configured/i)).toBeInTheDocument();
      expect(screen.getByText(/Build Command: None \(Static Files\)/i)).toBeInTheDocument();

      // Does not render editable start command text input for static sites
      expect(screen.queryByLabelText(/Start Command \*/i)).toBeNull();
    });

    it('validates required fields, masks secrets, and saves configuration for web applications', async () => {
      useWorkspaceStore.setState({ connectedApps: [nodeApp] });

      render(<ConfigModal app={nodeApp} isOpen={true} onClose={() => {}} />);

      // Start command input is present for framework app
      const startCmdInput = screen.getByLabelText(/Start Command \*/i);
      expect(startCmdInput).toHaveValue('npm run dev');

      // Secret environment variable is masked
      const secretInput = screen.getByPlaceholderText(/Enter secret value/i);
      expect(secretInput).toHaveAttribute('type', 'password');

      // Eye toggle button reveals secret
      const eyeBtn = screen.getByTitle(/Reveal/i);
      fireEvent.click(eyeBtn);
      expect(secretInput).toHaveAttribute('type', 'text');

      // Fill in required secret
      fireEvent.change(secretInput, { target: { value: 'super-secret-key-123' } });

      // Save configuration
      const saveBtn = screen.getByRole('button', { name: /Save Configuration|Save & Resume Launch/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        const updated = useWorkspaceStore.getState().connectedApps.find((a) => a.id === nodeApp.id);
        expect(updated?.envVars?.API_SECRET_KEY).toBe('super-secret-key-123');
      });
    });

    it('validates start command and blocks saving if empty for non-static app', () => {
      render(<ConfigModal app={nodeApp} isOpen={true} onClose={() => {}} />);

      const startCmdInput = screen.getByLabelText(/Start Command \*/i);
      fireEvent.change(startCmdInput, { target: { value: '' } });

      const saveBtn = screen.getByRole('button', { name: /Save Configuration|Save & Resume Launch/i });
      fireEvent.click(saveBtn);

      expect(screen.getByText(/Start command is required for application execution/i)).toBeInTheDocument();
    });
  });
});
