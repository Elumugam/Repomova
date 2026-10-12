import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WelcomeScreen } from '../components/WelcomeScreen';
import { useWorkspaceStore } from '../store';

describe('WelcomeScreen Component', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      connectedApps: [],
      connectModalOpen: false,
      activeView: 'home',
      openTabs: [],
      activeTabId: null,
    });
  });

  it('renders empty welcome screen with action buttons', () => {
    render(<WelcomeScreen />);
    
    // Check heading
    expect(screen.getByText('Every repository. One workspace.')).toBeInTheDocument();
    
    // Check Connect Repository button
    const connectBtn = screen.getByRole('button', { name: /Connect Repository/i });
    expect(connectBtn).toBeInTheDocument();

    // Clicking it should open connect modal
    fireEvent.click(connectBtn);
    expect(useWorkspaceStore.getState().connectModalOpen).toBe(true);
  });

  it('renders connected apps list when apps exist', () => {
    useWorkspaceStore.setState({
      connectedApps: [
        {
          id: 'app-abc',
          userId: 'usr-1',
          repoOwner: 'acme',
          repoName: 'my-saas-dashboard',
          repoFullName: 'acme/my-saas-dashboard',
          repoUrl: 'https://github.com/acme/my-saas-dashboard',
          defaultBranch: 'main',
          cloneStatus: 'cloned',
          runtimeType: 'nextjs',
          status: 'connected',
          lastOpened: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    render(<WelcomeScreen />);
    expect(screen.getByText('my-saas-dashboard')).toBeInTheDocument();
  });
});
