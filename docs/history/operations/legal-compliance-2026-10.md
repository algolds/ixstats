# Runbook: legal compliance (2026-10)

The server-side steps that make the October 2026 Terms of Service and Privacy Policy true. The policy promises these
retention limits in its section 5.3 table; the code cannot enforce them because they live in server configuration.
Run each step on the production host over SSH (`ssh ixwiki`). Every step is safe to repeat.

| Step | What                                            | Policy promise                           |
| ---- | ----------------------------------------------- | ---------------------------------------- |
| 1    | Nginx access logs                               | Server access logs: up to 30 days        |
| 2    | App and PM2 logs                                | Server access logs: up to 30 days        |
| 3    | journald                                        | Server access logs: up to 30 days        |
| 4    | Database backups                                | Backups: within 35 days                  |
| 5    | IxWiki CheckUser                                | IxWiki edit IP records: 90 days          |
| 6    | Schema SQL, before the code deploy              | Account deletion, content warnings       |
| 7    | After the code deploy: enable `account-erasure` | Erasure 14 days after a deletion request |

## 1. Nginx access logs

Check the current rotation:

```bash
grep -nE "daily|weekly|rotate|maxage" /etc/logrotate.d/nginx
```

Inside the `/var/log/nginx/*.log { ... }` block, make sure these lines are present (the Debian default is `daily` and
`rotate 14`, which already meets the promise; `maxage` keeps it true if someone raises `rotate` later):

```
    daily
    rotate 14
    maxage 30
```

Then check the syntax: `logrotate -d /etc/logrotate.d/nginx 2>&1 | tail -5`.

## 2. App and PM2 logs

`/etc/logrotate.d/ixwiki-custom` rotates `/ixwiki/private/logs/*.log` and `/var/log/pm2/*.log` by size only, so a
quiet log can keep IP addresses for months. Add `maxage 30` to both blocks:

```bash
sudo sed -i '/copytruncate/a\    maxage 30' /etc/logrotate.d/ixwiki-custom
grep -c "maxage 30" /etc/logrotate.d/ixwiki-custom   # expect 2
logrotate -d /etc/logrotate.d/ixwiki-custom 2>&1 | tail -5
```

## 3. journald

The journal holds service output, which can include request IPs. It is capped at 300M by size; add an age cap to the
same drop-in:

```bash
grep -q MaxRetentionSec /etc/systemd/journald.conf.d/99-ixwiki-size.conf \
  || echo "MaxRetentionSec=30day" | sudo tee -a /etc/systemd/journald.conf.d/99-ixwiki-size.conf
sudo systemctl restart systemd-journald
```

## 4. Database backups

Find the backup job and where it writes:

```bash
grep -rnE "pg_dump|pg_basebackup|backup" /etc/cron.d /etc/crontab /var/spool/cron/crontabs /ixwiki/private/scripts 2>/dev/null
```

The job, or a cron line next to it, must delete dumps older than 35 days. If it does not already prune, add to the
backup script after the dump succeeds (replace the directory with the one the job writes to):

```bash
find /ixwiki/private/backups -name '*.sql*' -mtime +35 -delete
```

Off-site copies, if any, need the same 35-day expiry on the remote side.

## 5. IxWiki CheckUser

CheckUser keeps the IP address of each edit for `$wgCUDMaxAge` seconds; its default is 90 days. Confirm nothing
overrides it:

```bash
grep -n "wgCUDMaxAge" /ixwiki/config/LocalSettings*.php
```

No match means the default (90 days) applies. If it is set to anything else, change it to
`$wgCUDMaxAge = 90 * 24 * 3600;`.

## 6. Schema SQL (before the code deploy)

Additive and nullable; the old build ignores both columns, the new build needs them.

```bash
cd /ixwiki/public/projects/ixstats
docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
  < scripts/migrations/2026-10-legal/l1-deletion-and-content-warning.sql
```

## 7. Enable the account-erasure job (after the code deploy)

Add `account-erasure` to `CRON_ENABLED_JOBS` in the production environment and restart the cron process. It runs
daily and erases every account whose deletion request is more than 14 days old. An erased user's flags and coats of
arms are held for removal and purged by `realm-inactivity`, so that job must be enabled too. Check the first run:

```sql
SELECT count(*) FROM "User" WHERE "deletionRequestedAt" IS NOT NULL AND "clerkUserId" NOT LIKE 'erased:%';
```
