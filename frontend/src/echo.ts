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

const echo = new Echo({
    broadcaster: 'reverb',
    key: reverbKey || 'missing-key',
    wsHost: import.meta.env.VITE_REVERB_HOST || window.location.hostname,
    wsPort: import.meta.env.VITE_REVERB_PORT ?? 80,
    wssPort: import.meta.env.VITE_REVERB_PORT ?? 443,
    forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https',
    enabledTransports: ['ws', 'wss'],
    authEndpoint: (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000') + '/broadcasting/auth',
    auth: {
        headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
            'X-API-Auth-Key': import.meta.env.VITE_API_AUTH_KEY,
        },
    },
});

export default echo;
