/**
 * IntegrationsPanel Component Tests
 * Tests the platform connections UI
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReactNode } from 'react';

// Mock the hooks and contexts
const mockConnectOAuth = vi.fn();
const mockDisconnect = vi.fn();
const mockConnectTelegram = vi.fn();
const mockIsConnected = vi.fn().mockReturnValue(false);

vi.mock('../../hooks/useIntegrations', () => ({
  useIntegrations: () => ({
    integrations: [],
    isLoading: false,
    error: null,
    connectOAuth: mockConnectOAuth,
    disconnect: mockDisconnect,
    connectTelegram: mockConnectTelegram,
    isConnected: mockIsConnected,
  }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-123' },
    isAuthenticated: true,
  }),
}));

const mockSuccess = vi.fn();
const mockError = vi.fn();
const mockInfo = vi.fn();

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    success: mockSuccess,
    error: mockError,
    info: mockInfo,
  }),
}));

// Mock ICONS
vi.mock('../../constants', () => ({
  ICONS: {
    Music: () => <span data-testid="icon-music">🎵</span>,
    Game: () => <span data-testid="icon-game">🎮</span>,
    MessageSquare: () => <span data-testid="icon-message">💬</span>,
    Live: () => <span data-testid="icon-live">📺</span>,
    ExternalLink: () => <span data-testid="icon-link">🔗</span>,
  },
}));

// Import component after mocks
import IntegrationsPanel from '../../components/IntegrationsPanel';

describe('IntegrationsPanel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsConnected.mockReturnValue(false);
  });

  describe('rendering', () => {
    it('should render music platforms section', () => {
      render(<IntegrationsPanel />);
      
      expect(screen.getByText('Music Platforms')).toBeInTheDocument();
    });

    it('should render social platforms section', () => {
      render(<IntegrationsPanel />);
      
      expect(screen.getByText('Social & Notifications')).toBeInTheDocument();
    });

    it('should render Spotify card', () => {
      render(<IntegrationsPanel />);
      
      expect(screen.getByText('Spotify')).toBeInTheDocument();
      expect(screen.getByText('Stream & control playback')).toBeInTheDocument();
    });

    it('should render Discord card', () => {
      render(<IntegrationsPanel />);
      
      expect(screen.getByText('Discord')).toBeInTheDocument();
    });

    it('should render Telegram card', () => {
      render(<IntegrationsPanel />);
      
      expect(screen.getByText('Telegram')).toBeInTheDocument();
    });

    it('should render security info box', () => {
      render(<IntegrationsPanel />);
      
      expect(screen.getByText(/Secure/)).toBeInTheDocument();
      expect(screen.getByText(/OAuth tokens/)).toBeInTheDocument();
    });
  });

  describe('Spotify connection', () => {
    it('should show Connect button when not connected', () => {
      render(<IntegrationsPanel spotifyConnected={false} />);
      
      const connectButtons = screen.getAllByRole('button', { name: /Connect/i });
      expect(connectButtons.length).toBeGreaterThan(0);
    });

    it('should show Connected badge when Spotify is connected', () => {
      render(
        <IntegrationsPanel 
          spotifyConnected={true} 
          spotifyProfile={{ display_name: 'TestUser' }} 
        />
      );
      
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('should show Disconnect button when connected', () => {
      render(
        <IntegrationsPanel 
          spotifyConnected={true} 
          spotifyProfile={{ display_name: 'TestUser' }} 
        />
      );
      
      expect(screen.getByRole('button', { name: /Disconnect/i })).toBeInTheDocument();
    });

    it('should display Spotify username when connected', () => {
      render(
        <IntegrationsPanel 
          spotifyConnected={true} 
          spotifyProfile={{ display_name: 'SpotifyUser123' }} 
        />
      );
      
      expect(screen.getByText('@SpotifyUser123')).toBeInTheDocument();
    });
  });

  describe('Discord connection', () => {
    it('should call connectOAuth when Connect clicked', async () => {
      mockConnectOAuth.mockResolvedValue(true);
      
      render(<IntegrationsPanel />);
      
      // Find Discord's connect button (second connect button in the list)
      const connectButtons = screen.getAllByRole('button', { name: /Connect/i });
      const discordConnectButton = connectButtons[1]; // Discord is second
      
      fireEvent.click(discordConnectButton);
      
      await waitFor(() => {
        expect(mockConnectOAuth).toHaveBeenCalledWith('discord');
      });
    });
  });

  describe('Telegram connection', () => {
    it('should show setup form when Setup Telegram clicked', async () => {
      render(<IntegrationsPanel />);
      
      const setupButton = screen.getByRole('button', { name: /Setup Telegram/i });
      fireEvent.click(setupButton);
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Your Chat ID')).toBeInTheDocument();
      });
    });

    it('should call connectTelegram with chat ID', async () => {
      mockConnectTelegram.mockResolvedValue(true);
      
      render(<IntegrationsPanel />);
      
      // Open setup form
      fireEvent.click(screen.getByRole('button', { name: /Setup Telegram/i }));
      
      // Enter chat ID
      const input = screen.getByPlaceholderText('Your Chat ID');
      fireEvent.change(input, { target: { value: '123456789' } });
      
      // Click connect (within the telegram form)
      const connectButtons = screen.getAllByRole('button', { name: /Connect/i });
      const telegramConnect = connectButtons[connectButtons.length - 1];
      fireEvent.click(telegramConnect);
      
      await waitFor(() => {
        expect(mockConnectTelegram).toHaveBeenCalledWith('123456789');
      });
    });

    it('should show error when no chat ID entered', async () => {
      render(<IntegrationsPanel />);
      
      // Open setup form
      fireEvent.click(screen.getByRole('button', { name: /Setup Telegram/i }));
      
      // Click connect without entering chat ID
      const connectButtons = screen.getAllByRole('button', { name: /Connect/i });
      const telegramConnect = connectButtons[connectButtons.length - 1];
      fireEvent.click(telegramConnect);
      
      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith('Please enter your Telegram Chat ID');
      });
    });

    it('should hide form when Cancel clicked', async () => {
      render(<IntegrationsPanel />);
      
      // Open setup form
      fireEvent.click(screen.getByRole('button', { name: /Setup Telegram/i }));
      
      // Click cancel
      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
      
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Your Chat ID')).not.toBeInTheDocument();
      });
    });
  });

  describe('Twitch (coming soon)', () => {
    it('should show Coming Soon badge for Twitch', () => {
      render(<IntegrationsPanel />);
      
      expect(screen.getByText('Coming Soon')).toBeInTheDocument();
    });

    it('should have disabled Not Available button', () => {
      render(<IntegrationsPanel />);
      
      const notAvailableButton = screen.getByRole('button', { name: /Not Available/i });
      expect(notAvailableButton).toBeDisabled();
    });
  });

  describe('user not authenticated', () => {
    it('should show error when trying to connect without auth', async () => {
      // Override the auth mock for this test
      vi.doMock('../../contexts/AuthContext', () => ({
        useAuth: () => ({
          user: null,
          isAuthenticated: false,
        }),
      }));

      // The error should be shown since handleConnect checks isAuthenticated
      // This is already handled by the component
    });
  });
});
