# Authenticated Wiki User Auto-Whitelisting & Defense Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide zero-exception, instant whitelisting for all signed-in MediaWiki/XenForo users, expand registered user whitelisting to /24 IPv4 and /64 IPv6 subnets, harden the defense daemon to permanently protect web browsers, and unblock Chrobby's Firefox client.

**Architecture:** A multi-layered defense bypass and auto-whitelisting architecture: Nginx inspects MediaWiki/XenForo session and user cookies to bypass bot/IP blocks instantly and pipes authenticated client IPs into `/var/log/nginx/authenticated_ips.log`. MediaWiki's `UserLoggedIn` hook writes directly to this log on login. The defense daemon ingests this log into `/var/lib/ixwiki-defense/whitelist_ips.txt` and is hardened to forbid banning browser User-Agents. The hourly synchronizer computes `/24` and `/64` subnets for all registered users across Nginx, fail2ban, and Cloudflare.

**Tech Stack:** Nginx, MediaWiki (PHP), Python 3 (`ipaddress`), Bash, MySQL, Cloudflare API, systemd.

## Global Constraints
- Every signed-in user with valid MediaWiki/XenForo auth cookies must bypass Nginx bot/IP blocks unconditionally (0-latency).
- Registered users must have both their exact IPs and their /24 IPv4 and /64 IPv6 subnets whitelisted.
- Web browser User-Agents (Firefox, Chrome, Safari, Edge, Opera, Mobile) must NEVER be auto-blocked by `ixwiki-bot-defense.sh`.
- All changes must pass syntax checks (`nginx -t`, `python3 -m py_compile`, `php -l`, `bash -n`) before restarting or reloading services.

---

### Task 1: Unblock Chrobby & Purge False-Positive Browser User-Agents

**Files:**
- Modify: `/var/lib/ixwiki-defense/blocked_uas.txt`
- Modify: `/etc/nginx/conf.d/ixwiki-dynamic-bots.conf`

**Interfaces:**
- Consumes: Current `/var/lib/ixwiki-defense/blocked_uas.txt`
- Produces: Sanitized `blocked_uas.txt` and `ixwiki-dynamic-bots.conf` with Firefox 154, Mac Chrome, and Chrome 135-139 removed.

- [ ] **Step 1: Write a failing reproduction test for Chrobby's Firefox block**
Verify that Firefox 154 returns 403:
```bash
curl -k -s -o /dev/null -w "%{http_code}\n" -H "Host: ixwiki.com" -H "CF-Connecting-IP: 205.175.106.198" -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:154.0) Gecko/20100101 Firefox/154.0" https://127.0.0.1/wiki/Main_Page
```
Expected output: `403`

- [ ] **Step 2: Sanitize `/var/lib/ixwiki-defense/blocked_uas.txt`**
Remove lines containing Firefox, Mac Chrome, and Chrome 135-139 from `/var/lib/ixwiki-defense/blocked_uas.txt`:
```bash
sed -i '/Firefox\/154/d' /var/lib/ixwiki-defense/blocked_uas.txt
sed -i '/Macintosh.*Chrome/d' /var/lib/ixwiki-defense/blocked_uas.txt
sed -i '/Chrome\/13[5-9]/d' /var/lib/ixwiki-defense/blocked_uas.txt
```

- [ ] **Step 3: Regenerate `/etc/nginx/conf.d/ixwiki-dynamic-bots.conf` and reload Nginx**
Regenerate using `ixwiki-bot-defense.sh cleanup` (or rebuild map) and reload Nginx:
```bash
/usr/local/bin/ixwiki-bot-defense.sh cleanup
nginx -t && systemctl reload nginx
```

- [ ] **Step 4: Verify Chrobby's Firefox returns 200 OK**
```bash
curl -k -s -o /dev/null -w "%{http_code}\n" -H "Host: ixwiki.com" -H "CF-Connecting-IP: 205.175.106.198" -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:154.0) Gecko/20100101 Firefox/154.0" https://127.0.0.1/wiki/Main_Page
```
Expected output: `200`

- [ ] **Step 5: Verify Mac Chrome returns 200 OK**
```bash
curl -k -s -o /dev/null -w "%{http_code}\n" -H "Host: ixwiki.com" -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" https://127.0.0.1/wiki/Main_Page
```
Expected output: `200`

---

### Task 2: Nginx Instant Authentication Bypass & Real-Time Logging

**Files:**
- Modify: `/etc/nginx/conf.d/ixwiki-bots.conf`
- Modify: `/etc/nginx/sites-available/ixwiki.com`

**Interfaces:**
- Consumes: `$http_cookie` header
- Produces: `$is_authenticated_user` map variable, conditional `auth_ip` access logging to `/var/log/nginx/authenticated_ips.log`.

- [ ] **Step 1: Define `$is_authenticated_user` in `/etc/nginx/conf.d/ixwiki-bots.conf`**
Add/update the authenticated user detection map:
```nginx
# Map for authenticated user detection (MediaWiki & XenForo)
map $http_cookie $is_authenticated_user {
    default 0;
    "~*ixwikiUserID=[1-9]" 1;
    "~*ixwiki_session="    1;
    "~*ixwikiToken="       1;
    "~*xf_user="           1;
    "~*xf_session="        1;
}
```

- [ ] **Step 2: Update `/etc/nginx/sites-available/ixwiki.com` for conditional logging & defense bypass**
Add authenticated access log:
```nginx
    access_log /var/log/nginx/authenticated_ips.log auth_ip if=$is_authenticated_user;
```
And guard bot defense blocks:
```nginx
    # === Bot Defense & Rate Limiting ===
    set $should_block 0;
    if ($bad_bot) {
        set $should_block 1;
    }
    if ($dynamic_bad_bot) {
        set $should_block 1;
    }
    if ($dynamic_blocked_ip) {
        set $should_block 1;
    }
    # Authenticated users bypass all bot & IP block rules unconditionally
    if ($is_authenticated_user) {
        set $should_block 0;
    }
    if ($should_block) {
        return 403;
    }

    if ($block_expensive_mediawiki_query) {
        set $block_expensive 1;
    }
    if ($is_authenticated_user) {
        set $block_expensive 0;
    }
    if ($block_expensive) {
        return 429;
    }
```

- [ ] **Step 3: Test configuration and reload Nginx**
```bash
nginx -t && systemctl reload nginx
```
Expected: `syntax is ok`, `test is successful`.

- [ ] **Step 4: Verify authenticated bypass**
Send a request with a known blocked bot User-Agent (e.g. `AhrefsBot`) but with `Cookie: ixwikiUserID=91; ixwiki_session=xyz`:
```bash
curl -k -s -o /dev/null -w "%{http_code}\n" -H "Host: ixwiki.com" -H "Cookie: ixwikiUserID=91; ixwiki_session=123" -A "AhrefsBot" https://127.0.0.1/wiki/Main_Page
```
Expected output: `200` (bypasses 403 block).
Verify request without cookie returns `403`:
```bash
curl -k -s -o /dev/null -w "%{http_code}\n" -H "Host: ixwiki.com" -A "AhrefsBot" https://127.0.0.1/wiki/Main_Page
```
Expected output: `403`.

- [ ] **Step 5: Verify authenticated IP logging**
Check `/var/log/nginx/authenticated_ips.log` to confirm client IP was logged.

---

### Task 3: MediaWiki Application Login Hook

**Files:**
- Modify: `/ixwiki/config/LocalSettings.php`

**Interfaces:**
- Consumes: MediaWiki `UserLoggedIn` hook
- Produces: Line written to `/var/log/nginx/authenticated_ips.log` upon user login.

- [ ] **Step 1: Inspect hook configuration in `LocalSettings.php`**
Check end of `/ixwiki/config/LocalSettings.php` for existing hooks.

- [ ] **Step 2: Add `UserLoggedIn` hook to `/ixwiki/config/LocalSettings.php`**
```php
// Auto-whitelist authenticated wiki users in bot defense
$wgHooks['UserLoggedIn'][] = function ( User $user ) {
    $ip = RequestContext::getMain()->getRequest()->getIP();
    if ( $ip && ! $user->isAnon() ) {
        @file_put_contents(
            '/var/log/nginx/authenticated_ips.log',
            $ip . "\n",
            FILE_APPEND | LOCK_EX
        );
    }
    return true;
};
```

- [ ] **Step 3: Validate PHP syntax**
```bash
php -l /ixwiki/config/LocalSettings.php
```
Expected: `No syntax errors detected in /ixwiki/config/LocalSettings.php`.

---

### Task 4: Defense Daemon Hardening (`ixwiki-bot-defense.sh`)

**Files:**
- Modify: `/usr/local/bin/ixwiki-bot-defense.sh`

**Interfaces:**
- Consumes: `/var/log/nginx/authenticated_ips.log`, `/var/log/nginx/access.log`
- Produces: Daemon that never auto-blocks legitimate browser User-Agents and ingests authenticated IPs in real time.

- [ ] **Step 1: Add `is_legitimate_browser()` helper to `ixwiki-bot-defense.sh`**
```bash
is_legitimate_browser() {
    local ua="$1"
    # Never block standard web browsers: Firefox, Chrome, Safari, Edge, Opera, Mobile
    if echo "$ua" | grep -qiE "(firefox/|rv:[0-9.]+.*gecko|chrome/[0-9.]+|safari/[0-9.]+|edg/[0-9.]+|opera/|opr/[0-9.]+|mobile.*safari)"; then
        # Except ancient known botnet versions explicitly flagged
        if ! echo "$ua" | grep -qE "Chrome/(9[0-9]|10[0-9]|11[0-2])\."; then
            return 0
        fi
    fi
    return 1
}
```

- [ ] **Step 2: Protect `block_user_agent()` and `analyze_traffic()` from blocking browsers**
In `block_user_agent()`:
```bash
    if is_legitimate_browser "$ua"; then
        log "SKIP_UA" "Skipping auto-block for legitimate browser UA: $ua (will rely on IP rate-limiting)"
        return 0
    fi
```
In `analyze_traffic()`:
Ensure that high traffic from legitimate browsers only triggers IP analysis and never calls `block_user_agent`.

- [ ] **Step 3: Ensure `whitelist_authenticated_users()` reads `/var/log/nginx/authenticated_ips.log` properly**
Verify that newly logged IPs in `authenticated_ips.log` are appended to `whitelist_ips.txt`, unbanned from `blocked_ips.txt` and fail2ban, and Nginx blocks updated.

- [ ] **Step 4: Check script syntax and restart daemon**
```bash
bash -n /usr/local/bin/ixwiki-bot-defense.sh
systemctl restart ixwiki-bot-defense.service
systemctl status ixwiki-bot-defense.service --no-pager
```
Expected: `active (running)`.

---

### Task 5: Subnet Whitelist Synchronizer & Ban Purger Expansion

**Files:**
- Modify: `/usr/local/bin/ixwiki-sync-whitelist.py`
- Modify: `/usr/local/bin/ixwiki-check-whitelist.sh`

**Interfaces:**
- Consumes: MySQL user tables, CheckUser tables, XenForo IP tables
- Produces: `/var/lib/ixwiki-defense/whitelist_ips.txt` with exact IPs, IPv4 `/24` subnets, and IPv6 `/64` subnets.

- [ ] **Step 1: Update `/usr/local/bin/ixwiki-sync-whitelist.py` for `/24` IPv4 and `/64` IPv6**
Enhance subnet computation:
```python
def compute_user_subnets(ips):
    v4_subnets = set()
    v6_subnets = set()
    for ip_str in ips:
        try:
            ip_obj = ipaddress.ip_address(ip_str)
            if ip_obj.version == 4:
                # /24 covers dynamic residential leases
                net = ipaddress.ip_network(f"{ip_str}/24", strict=False)
                v4_subnets.add(str(net))
            elif ip_obj.version == 6:
                # /64 covers SLAAC privacy address rotation
                net = ipaddress.ip_network(f"{ip_str}/64", strict=False)
                v6_subnets.add(str(net))
        except ValueError:
            continue
    return v4_subnets, v6_subnets
```
And add automatic sanitization of `blocked_uas.txt` to strip any browser strings.

- [ ] **Step 2: Update `/usr/local/bin/ixwiki-check-whitelist.sh` for `/24` and `/64` CIDR checks**
Support checking IPv4 `/24` CIDRs and IPv6 `/64` CIDRs with python `ipaddress` fallback for robust matching.

- [ ] **Step 3: Run the sync script and verify output**
```bash
/usr/local/bin/ixwiki-sync-whitelist.py
```
Expected: All registered users and their /24 and /64 subnets synced.

- [ ] **Step 4: Verify subnet check with `ixwiki-check-whitelist.sh`**
Test an IP in Chrobby's `/24` (e.g., `205.175.106.1`):
```bash
/usr/local/bin/ixwiki-check-whitelist.sh 205.175.106.1
```
Expected: `Whitelisted: 205.175.106.1 (matches ... in whitelist)` with exit code 0.

---

### Task 6: Final End-to-End Verification & Commit

- [ ] **Step 1: Test Firefox against live Nginx**
```bash
curl -k -I -H "Host: ixwiki.com" -H "CF-Connecting-IP: 205.175.106.198" -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:154.0) Gecko/20100101 Firefox/154.0" https://127.0.0.1/wiki/Main_Page
```
Expected: `HTTP/2 200`.

- [ ] **Step 2: Test Edge against live Nginx**
```bash
curl -k -I -H "Host: ixwiki.com" -H "CF-Connecting-IP: 205.175.106.198" -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0" https://127.0.0.1/wiki/Main_Page
```
Expected: `HTTP/2 200`.

- [ ] **Step 3: Test Mac Chrome against live Nginx**
```bash
curl -k -I -H "Host: ixwiki.com" -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" https://127.0.0.1/wiki/Main_Page
```
Expected: `HTTP/2 200`.

- [ ] **Step 4: Test Authenticated Cookie Bypass**
```bash
curl -k -I -H "Host: ixwiki.com" -H "Cookie: ixwikiUserID=91; ixwiki_session=xyz" -A "AhrefsBot" https://127.0.0.1/wiki/Main_Page
```
Expected: `HTTP/2 200`.

- [ ] **Step 5: Commit documentation and configuration updates**
```bash
git add docs/superpowers/plans/2026-09-03-authenticated-user-whitelisting.md
git commit -m "docs: add implementation plan for authenticated user auto-whitelisting"
```
