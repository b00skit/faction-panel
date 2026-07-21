# Laravel Reverb Production Setup Guide (Ubuntu + HestiaCP)

This document explains how to configure and deploy Laravel Reverb for real-time rosters on your Ubuntu server using HestiaCP for the backend and Portainer for the frontend.

## 1. Backend Configuration (.env)

Navigate to `/home/booskit/web/fp-api.booskit.dev/public_html/backend` and update your `.env`:

```env
BROADCAST_CONNECTION=reverb

# Reverb Server Settings
REVERB_SERVER_HOST=0.0.0.0
REVERB_SERVER_PORT=8080
REVERB_HOST=fp-api.booskit.dev
REVERB_PORT=443
REVERB_SCHEME=https

# Reverb Credentials (Generate via php artisan reverb:install if not present)
REVERB_APP_ID=your-app-id
REVERB_APP_KEY=your-app-key
REVERB_APP_SECRET=your-app-secret
```

## 2. Nginx Reverse Proxy (HestiaCP)

Since Reverb runs on port 8080 but your API is served over HTTPS (443), you need to configure Nginx to proxy WebSocket requests.

1.  In HestiaCP, go to **Web** -> **fp-api.booskit.dev** -> **Edit**.
2.  Under **Advanced Options**, look for **Nginx Customizations** or edit the proxy template.
3.  Add the following location block to your Nginx configuration (usually in the `SSL` tab or custom configuration file):

```nginx
location /app {
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header Scheme $scheme;
    proxy_set_header SERVER_PORT $server_port;
    proxy_set_header REMOTE_ADDR $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";

    proxy_pass http://127.0.0.1:8080;
}
```

## 3. Process Management (Supervisor)

Reverb must run as a persistent background process. Install Supervisor:

```bash
sudo apt update && sudo apt install supervisor -y
```

Create a new configuration file: `/etc/supervisor/conf.d/reverb.conf`

```ini
[program:reverb]
process_name=%(program_name)s_%(process_num)02d
command=php /home/booskit/web/fp-api.booskit.dev/public_html/backend/artisan reverb:start
autostart=true
autorestart=true
user=booskit
redirect_stderr=true
stdout_logfile=/home/booskit/web/fp-api.booskit.dev/public_html/backend/storage/logs/reverb.log
stopwaitsecs=3600
```

Update Supervisor:
```bash
sudo reread
sudo update
sudo start reverb
```

## 4. Frontend Configuration (Portainer/Docker)

In your Portainer container environment variables for **fp.booskit.dev**, ensure the following are set:

```env
VITE_REVERB_APP_KEY=your-app-key
VITE_REVERB_HOST=fp-api.booskit.dev
VITE_REVERB_PORT=443
VITE_REVERB_SCHEME=https
```

## 5. Local Development

If you are developing locally, copy the new variables to your `.env` files:

### Backend (`backend/.env`)
```env
BROADCAST_CONNECTION=reverb
REVERB_APP_ID=123456
REVERB_APP_KEY=your-key
REVERB_APP_SECRET=your-secret
REVERB_HOST="localhost"
REVERB_PORT=8080
REVERB_SCHEME=http
```

### Frontend (`frontend/.env`)
```env
VITE_REVERB_APP_KEY=your-key
VITE_REVERB_HOST=localhost
VITE_REVERB_PORT=8080
VITE_REVERB_SCHEME=http
```

## 6. Firewall (UFW)

Ensure port 8080 is either:
- **Closed** to the public (recommended, as Nginx proxies it locally).
- **Open** only if you are not using a reverse proxy (not recommended for HTTPS).

If you are proxying via Nginx, you don't need to open 8080 to the world.

## 6. Troubleshooting

- **Check Logs:** `tail -f /home/booskit/web/fp-api.booskit.dev/public_html/backend/storage/logs/reverb.log`
- **Check Status:** `sudo supervisorctl status`
- **Network Tab:** In Chrome DevTools, check the "WS" (WebSockets) tab. Look for the connection to `wss://fp-api.booskit.dev/app/...`. If it's `101 Switching Protocols`, it's working.
