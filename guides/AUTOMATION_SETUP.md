# GTA:W Sync Automation Setup Guide

This guide provides instructions on how to configure your production server to run the automated GTA:W synchronization system.

## 1. System Cron Job Configuration

The sync automation uses the Laravel Command Scheduler. To make the scheduler run, you need to add a single cron entry to your production server's cron tab.

1. SSH into your production server.
2. Open the crontab editor for the user running your web server (usually `www-data` or `nginx`):
   ```bash
   crontab -e
   ```
3. Add the following line to the file (replace `/path-to-your-project` with the absolute path to your Laravel root directory, usually `/var/www/faction-panel/backend`):
   ```cron
   * * * * * cd /path-to-your-project && php artisan schedule:run >> /dev/null 2>&1
   ```
4. Save and exit the editor.

This cron job will run every minute, triggering the Laravel scheduler, which in turn runs `php artisan gtaw:sync-automation` if there are any faction automations scheduled.

---

## 2. Queue Configuration (Optional)

All database operations and synchronization API calls run within a database transaction and are executed synchronously when the scheduler calls the command. You do not need to run queue workers for the sync automation itself. 

However, if you have other queued listeners or events (e.g. `RosterUpdated`), make sure your queue worker is running in production:
```bash
php artisan queue:work --queue=default
```

---

## 3. How the Automation Works (User-Bound Execution)

1. **Leader Validation**: When the scheduler triggers `gtaw:sync-automation`, it fetches the faction's current leader (`faction_leader` relation on the `Faction` model).
2. **Access Token Use**: It uses that leader's GTA:W access token (`gtaw_access_token` on the `User` model) to call the GTA:W API.
3. **Failures**:
   - If the faction leader changes or the leader has not linked their GTA:W account, a log entry is created with the error: `"Faction leader has not linked their GTA:W account."`
   - If the leader's access token has expired or is invalid, a log entry is created with the error message from the GTA:W API.
   - All errors are shown to the faction leader directly in the **Sync Execution History** section on the integration panel.
