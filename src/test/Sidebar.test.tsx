import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../components/Sidebar';
import { useWorkspaceStore } from '../store';

describe('Sidebar Component', () => {
  beforeEach(() => {
    localStorage.clear();
    useWorkspaceStore.setState({
      sidebarCollapsed: true, // fresh session default
      sidebarOpen: false,
      activeView: 'home',
      connectedApps: [],
      openTabs: [],
      connectModalOpen: false,
      theme: 'light',
      user: null,
      bookmarkedAppIds: [],
    });
  });

  it('starts collapsed by default on a fresh session', () => {
    render(<Sidebar />);
    const sidebar = screen.getByRole('complementary', { name: /Main Navigation/i });
    expect(sidebar).toHaveClass('collapsed');

    // Expand button is visible with proper accessible label
    const expandBtn = screen.getByRole('button', { name: /Expand sidebar/i });
    expect(expandBtn).toBeInTheDocument();
    expect(expandBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('expand/collapse control is always visible and functional in both states', () => {
    render(<Sidebar />);
    const sidebar = screen.getByRole('complementary', { name: /Main Navigation/i });

    // In collapsed state, toggle button exists
    const toggleBtn = screen.getByRole('button', { name: /Expand sidebar/i });
    expect(toggleBtn).toBeInTheDocument();

    // Click to expand
    fireEvent.click(toggleBtn);
    expect(useWorkspaceStore.getState().sidebarCollapsed).toBe(false);
    expect(sidebar).not.toHaveClass('collapsed');

    // In expanded state, toggle button still exists with updated label
    const collapseBtn = screen.getByRole('button', { name: /Collapse sidebar/i });
    expect(collapseBtn).toBeInTheDocument();
    expect(collapseBtn).toHaveAttribute('aria-expanded', 'true');

    // Click to collapse again
    fireEvent.click(collapseBtn);
    expect(useWorkspaceStore.getState().sidebarCollapsed).toBe(true);
    expect(sidebar).toHaveClass('collapsed');
  });

  it('displays brand mark and icons with tooltips in collapsed mode', () => {
    render(<Sidebar />);

    // Brand logo visible
    const logo = screen.getByAltText('Repomova');
    expect(logo).toBeInTheDocument();

    // Icon navigation items exist with tooltips and accessible labels
    const homeBtn = screen.getByRole('button', { name: /^Home/i });
    expect(homeBtn).toBeInTheDocument();
    expect(homeBtn).toHaveAttribute('title', 'Home');

    const appsBtn = screen.getByRole('button', { name: /^Connected Apps/i });
    expect(appsBtn).toBeInTheDocument();
    expect(appsBtn).toHaveAttribute('title', 'Connected Apps');

    // Standalone Settings is removed from sidebar nav items
    expect(screen.queryByRole('button', { name: /^Settings$/i })).not.toBeInTheDocument();

    const connectBtn = screen.getByRole('button', { name: /^Connect Repository/i });
    expect(connectBtn).toBeInTheDocument();
    expect(connectBtn).toHaveAttribute('title', 'Connect Repository');

    // Profile button exists at bottom near theme toggle
    const profileBtn = screen.getByRole('button', { name: /^Profile/i });
    expect(profileBtn).toBeInTheDocument();
    expect(profileBtn).toHaveAttribute('title', 'Profile');
  });

  it('navigation works correctly in collapsed state', () => {
    render(<Sidebar />);

    // Click Connected Apps
    const appsBtn = screen.getByRole('button', { name: /^Connected Apps/i });
    fireEvent.click(appsBtn);
    expect(useWorkspaceStore.getState().activeView).toBe('apps');

    // Profile menu opens and does not have Sign In / Sign Up, but Settings is accessible
    const profileBtn = screen.getByRole('button', { name: /^Profile/i });
    fireEvent.click(profileBtn);

    expect(screen.queryByRole('menuitem', { name: /^Sign In/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /^Sign Up/i })).not.toBeInTheDocument();

    const settingsMenuItem = screen.getByRole('menuitem', { name: /^Settings/i });
    expect(settingsMenuItem).toBeInTheDocument();
    fireEvent.click(settingsMenuItem);
    expect(useWorkspaceStore.getState().activeView).toBe('settings');

    // Click Home
    const homeBtn = screen.getByRole('button', { name: /^Home/i });
    fireEvent.click(homeBtn);
    expect(useWorkspaceStore.getState().activeView).toBe('home');

    // Click Connect Repository opens modal
    const connectBtn = screen.getByRole('button', { name: /^Connect Repository/i });
    fireEvent.click(connectBtn);
    expect(useWorkspaceStore.getState().connectModalOpen).toBe(true);
  });

  it('maintains correct active navigation indicators', () => {
    useWorkspaceStore.setState({ activeView: 'apps' });
    render(<Sidebar />);

    const appsBtn = screen.getByRole('button', { name: /^Connected Apps/i });
    expect(appsBtn).toHaveClass('active');
    expect(appsBtn).toHaveAttribute('aria-current', 'page');

    const homeBtn = screen.getByRole('button', { name: /^Home/i });
    expect(homeBtn).not.toHaveClass('active');
  });

  it('persists sidebar collapsed preference in localStorage', () => {
    render(<Sidebar />);
    const toggleBtn = screen.getByRole('button', { name: /Expand sidebar/i });

    // Toggle expand
    fireEvent.click(toggleBtn);
    expect(localStorage.getItem('repomova-sidebar-collapsed')).toBe('false');

    // Toggle collapse
    fireEvent.click(toggleBtn);
    expect(localStorage.getItem('repomova-sidebar-collapsed')).toBe('true');
  });

  it('bottom Theme Toggle and Profile icons remain accessible in both expanded and collapsed layouts', () => {
    // 1. Collapsed layout
    const { unmount } = render(<Sidebar />);
    const themeBtnCollapsed = screen.getByRole('button', { name: /Dark Mode|Light Mode/i });
    const profileBtnCollapsed = screen.getByRole('button', { name: /^Profile/i });

    expect(themeBtnCollapsed).toBeInTheDocument();
    expect(profileBtnCollapsed).toBeInTheDocument();

    // Toggle theme works from bottom icon
    fireEvent.click(themeBtnCollapsed);
    expect(useWorkspaceStore.getState().theme).toBe('dark');
    unmount();

    // 2. Expanded layout
    useWorkspaceStore.setState({ sidebarCollapsed: false });
    render(<Sidebar />);
    const themeBtnExpanded = screen.getByRole('button', { name: /Dark Mode|Light Mode/i });
    const profileBtnExpanded = screen.getByRole('button', { name: /^Profile/i });

    expect(themeBtnExpanded).toBeInTheDocument();
    expect(profileBtnExpanded).toBeInTheDocument();
  });

  it('bottom options remain visible and accessible when many bookmarks are present', () => {
    useWorkspaceStore.setState({
      sidebarCollapsed: false,
      connectedApps: [
        { id: 'app-1', userId: 'u1', repoOwner: 'o', repoName: 'App Alpha', repoFullName: 'o/app-1', repoUrl: 'https://github.com/o/app-1', defaultBranch: 'main', cloneStatus: 'cloned', runtimeType: 'static', status: 'running', lastOpened: null, createdAt: '', updatedAt: '' },
        { id: 'app-2', userId: 'u1', repoOwner: 'o', repoName: 'App Beta', repoFullName: 'o/app-2', repoUrl: 'https://github.com/o/app-2', defaultBranch: 'main', cloneStatus: 'cloned', runtimeType: 'react', status: 'running', lastOpened: null, createdAt: '', updatedAt: '' },
        { id: 'app-3', userId: 'u1', repoOwner: 'o', repoName: 'App Gamma', repoFullName: 'o/app-3', repoUrl: 'https://github.com/o/app-3', defaultBranch: 'main', cloneStatus: 'cloned', runtimeType: 'nextjs', status: 'stopped', lastOpened: null, createdAt: '', updatedAt: '' },
      ],
      bookmarkedAppIds: ['app-1', 'app-2', 'app-3'],
    });

    render(<Sidebar />);

    // Bookmarked items appear in the navigation area
    expect(screen.getByRole('button', { name: /Open bookmarked App Alpha/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open bookmarked App Beta/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open bookmarked App Gamma/i })).toBeInTheDocument();

    // Bottom controls (Theme Toggle and Profile) remain accessible and visible
    expect(screen.getByRole('button', { name: /Dark Mode|Light Mode/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Profile/i })).toBeInTheDocument();
  });

  it('renders mobile overlay and closes sidebar when clicking overlay on mobile screens', () => {
    useWorkspaceStore.setState({ sidebarOpen: true });
    render(<Sidebar />);

    const sidebar = screen.getByRole('complementary', { name: /Main Navigation/i });
    expect(sidebar).toHaveClass('open');

    // Click outside overlay to close mobile sidebar
    const overlay = document.querySelector('.modal-overlay');
    expect(overlay).toBeInTheDocument();
    fireEvent.click(overlay!);

    expect(useWorkspaceStore.getState().sidebarOpen).toBe(false);
  });
});
