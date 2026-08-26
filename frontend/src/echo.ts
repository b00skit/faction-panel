import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

declare global {
    interface Window {
        Pusher: typeof Pusher;
        Echo: Echo<any>;
    }
}

window.Pusher = Pusher;

const reverbKey = import.meta.env.VITE_REVERB_APP_KEY;

if (!reverbKey) {
    console.warn('Reverb App Key is missing. Real-time features will be disabled.');
}

const getFallbackHost = (): string => {
    try {
        if (import.meta.env.VITE_API_BASE_URL) {
            return new URL(import.meta.env.VITE_API_BASE_URL).hostname;
        }
    } catch {
        // Fall back to window location
    }
    return window.location.hostname;
};

const port = import.meta.env.VITE_REVERB_PORT ? Number(import.meta.env.VITE_REVERB_PORT) : 443;
const scheme = import.meta.env.VITE_REVERB_SCHEME ?? 'https';
const host = import.meta.env.VITE_REVERB_HOST || getFallbackHost();

const echo = new Echo({
    broadcaster: 'reverb',
    key: reverbKey || 'missing-key',
    wsHost: host,
    wssHost: host,
    wsPort: port,
    wssPort: port,
    forceTLS: scheme === 'https',
    enabledTransports: ['ws', 'wss'],
    authEndpoint: (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000') + '/broadcasting/auth',
    auth: {
        headers: {
            get Authorization() {
                return `Bearer ${localStorage.getItem('access_token')}`;
            },
            'X-API-Auth-Key': import.meta.env.VITE_API_AUTH_KEY,
        },
    },
});

export default echo;
