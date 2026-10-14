/* ============================================================
   Tests: Authentication Flow & Profile Menu
   ============================================================ */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Sidebar } from '../components/Sidebar';
import { SettingsView } from '../components/SettingsView';
import { useWorkspaceStore } from '../store';
import { repomovaAuth } from '../lib/auth';

describe('Authentication Flow & Profile Menu', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    useWorkspaceStore.setState({
      theme: 'light',
      sidebarCollapsed: false,
      sidebarOpen: false,
      activeView: 'home',
      settingsTab: 'account',
      authMode: 'login',
      connectedApps: [],
      openTabs: [],
      activeTabId: null,
      bookmarkedAppIds: [],
      user: null,
      isAuthenticated: false,
    });
  });

  /* ------------------------------------------------------------
     1. Profile Menu for Signed-Out Users
     ------------------------------------------------------------ */
  describe('Profile Menu for Signed-Out Users', () => {
    it('removes standalone Settings from the main sidebar navigation', () => {
      render(<Sidebar />);
      expect(screen.getByRole('button', { name: /^Home/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Connected Apps/i })).toBeInTheDocument();
      // Standalone Settings must NOT be in the sidebar nav
      expect(screen.queryByRole('button', { name: /^Settings$/i })).not.toBeInTheDocument();
    });

    it('positions the profile icon at the bottom of the sidebar near the theme toggle', () => {
      render(<Sidebar />);
      const themeBtn = screen.getByRole('button', { name: /Dark Mode|Light Mode/i });
      const profileBtn = screen.getByRole('button', { name: /Profile/i });

      expect(themeBtn).toBeInTheDocument();
      expect(profileBtn).toBeInTheDocument();
      expect(profileBtn).toHaveAttribute('aria-haspopup', 'menu');
    });

    it('renders profile button in collapsed sidebar layout with tooltip', () => {
      useWorkspaceStore.setState({ sidebarCollapsed: true });
      render(<Sidebar />);

      const profileBtn = screen.getByRole('button', { name: /Profile/i });
      expect(profileBtn).toBeInTheDocument();
      expect(profileBtn).toHaveAttribute('title', 'Profile');
    });

    it('displays Sign In and Sign Up options in the profile menu for unauthenticated users', () => {
      render(<Sidebar />);
      const profileBtn = screen.getByRole('button', { name: /Profile/i });
      fireEvent.click(profileBtn);

      const menu = screen.getByRole('menu', { name: /Profile and account menu/i });
      expect(menu).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /^Sign In/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /^Sign Up/i })).toBeInTheDocument();

      // Does NOT show authenticated options to signed-out users
      expect(screen.queryByRole('menuitem', { name: /^Security/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /^Sign Out/i })).not.toBeInTheDocument();
    });

    it('selecting Sign In navigates to Settings account tab in login mode', () => {
      render(<Sidebar />);
      const profileBtn = screen.getByRole('button', { name: /Profile/i });
      fireEvent.click(profileBtn);

      const signInBtn = screen.getByRole('menuitem', { name: /^Sign In/i });
      fireEvent.click(signInBtn);

      expect(useWorkspaceStore.getState().activeView).toBe('settings');
      expect(useWorkspaceStore.getState().settingsTab).toBe('account');
      expect(useWorkspaceStore.getState().authMode).toBe('login');
      // Popover menu closes on selection
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('selecting Sign Up navigates to Settings account tab in signup mode', () => {
      render(<Sidebar />);
      const profileBtn = screen.getByRole('button', { name: /Profile/i });
      fireEvent.click(profileBtn);

      const signUpBtn = screen.getByRole('menuitem', { name: /^Sign Up/i });
      fireEvent.click(signUpBtn);

      expect(useWorkspaceStore.getState().activeView).toBe('settings');
      expect(useWorkspaceStore.getState().settingsTab).toBe('account');
      expect(useWorkspaceStore.getState().authMode).toBe('signup');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('closes the profile menu when pressing the Escape key', () => {
      render(<Sidebar />);
      const profileBtn = screen.getByRole('button', { name: /Profile/i });
      fireEvent.click(profileBtn);
      expect(screen.getByRole('menu')).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('closes the profile menu when clicking outside', () => {
      render(
        <div>
          <div data-testid="outside-area">Outside</div>
          <Sidebar />
        </div>
      );
      const profileBtn = screen.getByRole('button', { name: /Profile/i });
      fireEvent.click(profileBtn);
      expect(screen.getByRole('menu')).toBeInTheDocument();

      fireEvent.mouseDown(screen.getByTestId('outside-area'));
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  /* ------------------------------------------------------------
     2. Profile Menu for Signed-In Users
     ------------------------------------------------------------ */
  describe('Profile Menu for Signed-In Users', () => {
    const mockUser = {
      id: 'usr-123',
      email: 'alex@example.com',
      displayName: 'Alex Smith',
      createdAt: '2026-01-01T00:00:00Z',
    };

    beforeEach(() => {
      useWorkspaceStore.setState({
        user: mockUser,
        isAuthenticated: true,
      });
    });

    it('displays user avatar and info in the profile menu', () => {
      render(<Sidebar />);
      const profileBtn = screen.getByRole('button', { name: /Alex Smith/i });
      fireEvent.click(profileBtn);

      const menu = screen.getByRole('menu', { name: /Profile and account menu/i });
      expect(within(menu).getByText('Alex Smith')).toBeInTheDocument();
      expect(within(menu).getByText('alex@example.com')).toBeInTheDocument();
    });

    it('includes Profile, Settings, Security, and Sign Out options', () => {
      render(<Sidebar />);
      const profileBtn = screen.getByRole('button', { name: /Alex Smith/i });
      fireEvent.click(profileBtn);

      expect(screen.getByRole('menuitem', { name: /^Profile/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /^Settings/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /^Security/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /^Sign Out/i })).toBeInTheDocument();

      // Does NOT show unauthenticated options
      expect(screen.queryByRole('menuitem', { name: /^Sign In/i })).not.toBeInTheDocument();
    });

    it('selecting Settings navigates to Settings view', () => {
      render(<Sidebar />);
      const profileBtn = screen.getByRole('button', { name: /Alex Smith/i });
      fireEvent.click(profileBtn);

      const settingsBtn = screen.getByRole('menuitem', { name: /^Settings/i });
      fireEvent.click(settingsBtn);

      expect(useWorkspaceStore.getState().activeView).toBe('settings');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('selecting Security navigates to security settings', () => {
      render(<Sidebar />);
      const profileBtn = screen.getByRole('button', { name: /Alex Smith/i });
      fireEvent.click(profileBtn);

      const securityBtn = screen.getByRole('menuitem', { name: /^Security/i });
      fireEvent.click(securityBtn);

      expect(useWorkspaceStore.getState().activeView).toBe('settings');
      expect(useWorkspaceStore.getState().settingsTab).toBe('security');
    });

    it('selecting Sign Out invokes signOut and clears user state', async () => {
      const signOutSpy = vi.spyOn(repomovaAuth, 'signOut').mockResolvedValue({ error: null });

      render(<Sidebar />);
      const profileBtn = screen.getByRole('button', { name: /Alex Smith/i });
      fireEvent.click(profileBtn);

      const signOutBtn = screen.getByRole('menuitem', { name: /^Sign Out/i });
      fireEvent.click(signOutBtn);

      await waitFor(() => {
        expect(signOutSpy).toHaveBeenCalled();
        expect(useWorkspaceStore.getState().user).toBeNull();
        expect(useWorkspaceStore.getState().isAuthenticated).toBe(false);
      });
    });
  });

  /* ------------------------------------------------------------
     3. Sign-In & Sign-Up Logic (SettingsView / AccountSettings)
     ------------------------------------------------------------ */
  describe('Sign-In & Sign-Up Functionality', () => {
    it('renders Sign In form with email and password inputs', () => {
      useWorkspaceStore.setState({ authMode: 'login' });
      render(<SettingsView />);

      expect(screen.getByRole('heading', { name: /Sign In/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Sign In/i })).toBeInTheDocument();
    });

    it('switches between Sign In and Sign Up modes', () => {
      render(<SettingsView />);
      expect(screen.getByRole('heading', { name: /Sign In/i })).toBeInTheDocument();

      // Click "Don't have an account? Sign up"
      fireEvent.click(screen.getByText(/Don't have an account\? Sign up/i));
      expect(useWorkspaceStore.getState().authMode).toBe('signup');
      expect(screen.getByRole('heading', { name: /Create Account/i })).toBeInTheDocument();

      // Switch back
      fireEvent.click(screen.getByText(/Already have an account\? Sign in/i));
      expect(useWorkspaceStore.getState().authMode).toBe('login');
      expect(screen.getByRole('heading', { name: /Sign In/i })).toBeInTheDocument();
    });

    it('validates password length of at least 6 characters', async () => {
      render(<SettingsView />);

      fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
        target: { value: 'user@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
        target: { value: '123' },
      });

      fireEvent.click(screen.getByRole('button', { name: /^Sign In/i }));

      await waitFor(() => {
        expect(screen.getByText(/Password must be at least 6 characters long/i)).toBeInTheDocument();
      });
    });

    it('validates email format before submitting', async () => {
      render(<SettingsView />);

      fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
        target: { value: 'invalid-email-address' },
      });
      fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
        target: { value: 'validPassword123' },
      });

      fireEvent.click(screen.getByRole('button', { name: /^Sign In/i }));

      await waitFor(() => {
        expect(screen.getByText(/Please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    it('signs in successfully and updates user store immediately', async () => {
      const mockSession = {
        user: {
          id: 'user-real-999',
          email: 'jane@example.com',
          displayName: 'Jane Doe',
          createdAt: '2026-03-01T00:00:00Z',
        },
        token: 'token-abc-123',
      };

      vi.spyOn(repomovaAuth, 'signIn').mockResolvedValue({
        data: { user: mockSession.user, session: mockSession },
        user: mockSession.user,
        session: mockSession,
        error: null,
      });

      render(<SettingsView />);

      fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
        target: { value: 'jane@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
        target: { value: 'validPassword123' },
      });

      fireEvent.click(screen.getByRole('button', { name: /^Sign In/i }));

      await waitFor(() => {
        expect(useWorkspaceStore.getState().user).toEqual(
          expect.objectContaining({
            id: 'user-real-999',
            email: 'jane@example.com',
            displayName: 'Jane Doe',
          })
        );
        expect(useWorkspaceStore.getState().isAuthenticated).toBe(true);
      });
    });

    it('displays user-friendly error message on invalid credentials', async () => {
      vi.spyOn(repomovaAuth, 'signIn').mockResolvedValue({
        data: { user: null, session: null },
        user: null,
        session: null,
        error: new Error('Invalid email or password. Please verify your credentials and try again.'),
      });

      render(<SettingsView />);

      fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
        target: { value: 'wrong@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
        target: { value: 'wrongPassword123' },
      });

      fireEvent.click(screen.getByRole('button', { name: /^Sign In/i }));

      await waitFor(() => {
        expect(screen.getByText(/Invalid email or password/i)).toBeInTheDocument();
      });
    });

    it('validates password confirmation matching on registration', async () => {
      useWorkspaceStore.setState({ authMode: 'signup' });
      render(<SettingsView />);

      fireEvent.change(screen.getByPlaceholderText('Jane Doe'), {
        target: { value: 'Alex Tester' },
      });
      fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
        target: { value: 'alex@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('•••••••• (min 6 characters)'), {
        target: { value: 'mypassword123' },
      });
      fireEvent.change(screen.getByPlaceholderText('•••••••• (re-enter password)'), {
        target: { value: 'mismatch456' },
      });

      fireEvent.click(screen.getByRole('button', { name: /^Create Account/i }));

      await waitFor(() => {
        expect(screen.getByText(/Passwords do not match. Please re-enter your password/i)).toBeInTheDocument();
      });
    });

    it('registers new user successfully with password confirmation and updates store', async () => {
      useWorkspaceStore.setState({ authMode: 'signup' });

      const mockRegisteredUser = {
        id: 'new-user-123',
        email: 'alex@example.com',
        displayName: 'Alex Tester',
        createdAt: '2026-03-01T00:00:00Z',
      };

      const signUpSpy = vi.spyOn(repomovaAuth, 'signUp').mockResolvedValue({
        data: {
          user: mockRegisteredUser,
          session: { user: mockRegisteredUser, token: 'token-reg-123' },
        },
        user: mockRegisteredUser,
        session: { user: mockRegisteredUser, token: 'token-reg-123' },
        error: null,
        message: 'Account created and signed in successfully!',
      });

      render(<SettingsView />);

      fireEvent.change(screen.getByPlaceholderText('Jane Doe'), {
        target: { value: 'Alex Tester' },
      });
      fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
        target: { value: 'alex@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('•••••••• (min 6 characters)'), {
        target: { value: 'securePass123' },
      });
      fireEvent.change(screen.getByPlaceholderText('•••••••• (re-enter password)'), {
        target: { value: 'securePass123' },
      });

      fireEvent.click(screen.getByRole('button', { name: /^Create Account/i }));

      await waitFor(() => {
        expect(signUpSpy).toHaveBeenCalledWith({
          email: 'alex@example.com',
          password: 'securePass123',
          confirmPassword: 'securePass123',
          displayName: 'Alex Tester',
        });
        expect(useWorkspaceStore.getState().user).toEqual(
          expect.objectContaining({
            id: 'new-user-123',
            email: 'alex@example.com',
            displayName: 'Alex Tester',
          })
        );
        expect(useWorkspaceStore.getState().isAuthenticated).toBe(true);
        expect(screen.getByText(/Account created and signed in successfully!/i)).toBeInTheDocument();
      });
    });

    it('detects duplicate user on sign-up and guides user to sign in', async () => {
      useWorkspaceStore.setState({ authMode: 'signup' });

      vi.spyOn(repomovaAuth, 'signUp').mockResolvedValue({
        data: { user: null, session: null },
        user: null,
        session: null,
        error: new Error('An account with this email address already exists. Please sign in instead.'),
      });

      render(<SettingsView />);

      fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
        target: { value: 'existing@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('•••••••• (min 6 characters)'), {
        target: { value: 'securePass123' },
      });
      fireEvent.change(screen.getByPlaceholderText('•••••••• (re-enter password)'), {
        target: { value: 'securePass123' },
      });

      fireEvent.click(screen.getByRole('button', { name: /^Create Account/i }));

      await waitFor(() => {
        expect(screen.getByText(/An account with this email address already exists. Please sign in instead/i)).toBeInTheDocument();
      });
    });

    it('allows signed-in users to update their display name', async () => {
      useWorkspaceStore.setState({
        user: {
          id: 'user-update-1',
          email: 'developer@example.com',
          displayName: 'Old Name',
          createdAt: '2026-01-01T00:00:00Z',
        },
        isAuthenticated: true,
      });

      const updateSpy = vi.spyOn(repomovaAuth, 'updateUser').mockResolvedValue({
        data: {
          user: {
            id: 'user-update-1',
            email: 'developer@example.com',
            displayName: 'Updated Name',
            createdAt: '2026-01-01T00:00:00Z',
          },
        },
        user: {
          id: 'user-update-1',
          email: 'developer@example.com',
          displayName: 'Updated Name',
          createdAt: '2026-01-01T00:00:00Z',
        },
        error: null,
      });

      render(<SettingsView />);

      const nameInput = screen.getByDisplayValue('Old Name');
      fireEvent.change(nameInput, { target: { value: 'Updated Name' } });

      const saveBtn = screen.getByRole('button', { name: /Save/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith({
          displayName: 'Updated Name',
        });
        expect(useWorkspaceStore.getState().user?.displayName).toBe('Updated Name');
        expect(screen.getByText(/Profile updated successfully!/i)).toBeInTheDocument();
      });
    });
  });
});
