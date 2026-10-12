import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { WelcomeScreen } from '../components/WelcomeScreen';
import { useWorkspaceStore } from '../store';
import type { ConnectedApp } from '../types';

describe('Overview Dashboard (WelcomeScreen)', () => {
  const mockApp1: ConnectedApp = {
    id: 'app-abc',
    userId: 'usr-1',
    repoOwner: 'acme',
    repoName: 'my-saas-dashboard',
    repoFullName: 'acme/my-saas-dashboard',
    repoUrl: 'https://github.com/acme/my-saas-dashboard',
    defaultBranch: 'main',
    cloneStatus: 'cloned',
    runtimeType: 'nextjs',
    status: 'running',
    lastOpened: new Date(Date.now() - 3600000).toISOString(),
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  };

  const mockApp2: ConnectedApp = {
    id: 'app-def',
    userId: 'usr-1',
    repoOwner: 'acme',
    repoName: 'backend-api',
    repoFullName: 'acme/backend-api',
    repoUrl: 'https://github.com/acme/backend-api',
    defaultBranch: 'main',
    cloneStatus: 'cloned',
    runtimeType: 'node',
    status: 'stopped',
    lastOpened: null,
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  };

  const mockApp3: ConnectedApp = {
    id: 'app-ghi',
    userId: 'usr-1',
    repoOwner: 'acme',
    repoName: 'broken-service',
    repoFullName: 'acme/broken-service',
    repoUrl: 'https://github.com/acme/broken-service',
    defaultBranch: 'main',
    cloneStatus: 'failed',
    runtimeType: 'docker',
    status: 'failed',
    lastOpened: null,
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    updatedAt: new Date(Date.now() - 259200000).toISOString(),
  };

  beforeEach(() => {
    useWorkspaceStore.setState({
      connectedApps: [],
      connectModalOpen: false,
      activeView: 'home',
      openTabs: [],
      activeTabId: null,
      appsLoading: false,
      appsError: null,
    });
  });

  it('renders correct page header with title, subtitle, and no prominent Connect button', () => {
    render(<WelcomeScreen />);

    expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByText('Your workspace at a glance.')).toBeInTheDocument();

    // Verify there is no oversized welcome heading
    expect(screen.queryByText('Welcome to Repomova')).not.toBeInTheDocument();
    expect(screen.queryByText('Every repository. One workspace.')).not.toBeInTheDocument();

    // Verify no prominent Connect Repository button on home page content
    expect(screen.queryByRole('button', { name: /Connect Repository/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Connect Your First Repository/i })).not.toBeInTheDocument();
  });

  it('renders accurate workspace statistics reflecting actual counts (zeros when empty)', () => {
    render(<WelcomeScreen />);

    expect(screen.getByTestId('stat-total')).toHaveTextContent('0');
    expect(screen.getByTestId('stat-running')).toHaveTextContent('0');
    expect(screen.getByTestId('stat-stopped')).toHaveTextContent('0');
    expect(screen.getByTestId('stat-attention')).toHaveTextContent('0');
  });

  it('renders accurate statistics when applications exist', () => {
    useWorkspaceStore.setState({
      connectedApps: [mockApp1, mockApp2, mockApp3],
    });

    render(<WelcomeScreen />);

    expect(screen.getByTestId('stat-total')).toHaveTextContent('3');
    expect(screen.getByTestId('stat-running')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-stopped')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-attention')).toHaveTextContent('1');
  });

  it('renders loading and error states properly', () => {
    const { rerender } = render(<WelcomeScreen isLoading={true} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading workspace data...');

    rerender(<WelcomeScreen isLoading={false} error="Failed to fetch workspace apps" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to fetch workspace apps');
  });

  it('renders compact empty states when no applications are connected', () => {
    render(<WelcomeScreen />);

    expect(screen.getByText('No connected applications yet')).toBeInTheDocument();
    expect(
      screen.getByText('Your connected applications will appear here once you add a repository.')
    ).toBeInTheDocument();
    expect(screen.getByText('No recent activity')).toBeInTheDocument();
  });

  it('renders actual application data in cardless borderless rows', () => {
    useWorkspaceStore.setState({
      connectedApps: [mockApp1, mockApp2],
    });

    render(<WelcomeScreen />);

    const row1 = screen.getByTestId('app-row-app-abc');
    expect(within(row1).getByText('my-saas-dashboard')).toBeInTheDocument();
    expect(within(row1).getByText('acme/my-saas-dashboard')).toBeInTheDocument();
    expect(within(row1).getByText('Next.js')).toBeInTheDocument();
    expect(within(row1).getByText('Running')).toBeInTheDocument();

    const row2 = screen.getByTestId('app-row-app-def');
    expect(within(row2).getByText('backend-api')).toBeInTheDocument();
    expect(within(row2).getByText('acme/backend-api')).toBeInTheDocument();
    expect(within(row2).getByText('Node.js')).toBeInTheDocument();
    expect(within(row2).getByText('Stopped')).toBeInTheDocument();
  });

  it('Open action launches the correct application tab', () => {
    useWorkspaceStore.setState({
      connectedApps: [mockApp1],
    });

    render(<WelcomeScreen />);

    const openBtn = screen.getByRole('button', { name: 'Open my-saas-dashboard' });
    fireEvent.click(openBtn);

    const store = useWorkspaceStore.getState();
    expect(store.openTabs).toHaveLength(1);
    expect(store.openTabs[0].appId).toBe('app-abc');
    expect(store.activeTabId).toBe('tab-app-abc');
  });

  it('View all navigates to Connected Apps view', () => {
    useWorkspaceStore.setState({
      connectedApps: [mockApp1],
    });

    render(<WelcomeScreen />);

    const viewAllBtn = screen.getByRole('button', { name: /View all connected applications/i });
    fireEvent.click(viewAllBtn);

    expect(useWorkspaceStore.getState().activeView).toBe('apps');
  });

  it('displays real recorded events under Recent Activity with no fabricated data', () => {
    useWorkspaceStore.setState({
      connectedApps: [mockApp1],
    });

    render(<WelcomeScreen />);

    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    // mockApp1 has createdAt ("Repository connected"), cloneStatus ("Clone completed"), status running ("Application started")
    expect(screen.getByText('Repository connected')).toBeInTheDocument();
    expect(screen.getByText('Clone completed')).toBeInTheDocument();
    expect(screen.getByText('Application started')).toBeInTheDocument();
  });

  it('Quick Access functional links navigate and open apps properly', () => {
    useWorkspaceStore.setState({
      connectedApps: [mockApp1],
    });

    render(<WelcomeScreen />);

    // Click All connected applications
    fireEvent.click(screen.getByText('All connected applications'));
    expect(useWorkspaceStore.getState().activeView).toBe('apps');

    // Reset view
    act(() => {
      useWorkspaceStore.setState({ activeView: 'home' });
    });

    // Click Settings
    fireEvent.click(screen.getByText('Settings'));
    expect(useWorkspaceStore.getState().activeView).toBe('settings');

    // Click Running applications launches the running app tab
    fireEvent.click(screen.getByText('Running applications'));
    expect(useWorkspaceStore.getState().openTabs.some((t) => t.appId === 'app-abc')).toBe(true);
  });
});
