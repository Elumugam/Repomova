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

    const settingsBtn = screen.getByRole('button', { name: /^Settings/i });
    expect(settingsBtn).toBeInTheDocument();
    expect(settingsBtn).toHaveAttribute('title', 'Settings');

    const connectBtn = screen.getByRole('button', { name: /^Connect Repository/i });
    expect(connectBtn).toBeInTheDocument();
    expect(connectBtn).toHaveAttribute('title', 'Connect Repository');
  });

  it('navigation works correctly in collapsed state', () => {
    render(<Sidebar />);

    // Click Connected Apps
    const appsBtn = screen.getByRole('button', { name: /^Connected Apps/i });
    fireEvent.click(appsBtn);
    expect(useWorkspaceStore.getState().activeView).toBe('apps');

    // Click Settings
    const settingsBtn = screen.getByRole('button', { name: /^Settings/i });
    fireEvent.click(settingsBtn);
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
});
