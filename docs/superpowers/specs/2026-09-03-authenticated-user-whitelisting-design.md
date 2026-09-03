# Authenticated Wiki User Auto-Whitelisting & Defense Hardening Design

## 1. Background & Problem Statement
Users registered on IxWiki (e.g., Bobbo, Nasastan, Chrobby) have faced blocks due to two issues in the bot defense infrastructure:
1. **False-Positive User-Agent Blocking**: The defense daemon `/usr/local/bin/ixwiki-bot-defense.sh` monitored traffic rate by User-Agent across all IPs. When aggregate traffic for a browser User-Agent exceeded 200 req/min (e.g., multiple users browsing, high asset counts, or a bot masquerading as Firefox), the daemon automatically wrote the full browser User-Agent string to `/var/lib/ixwiki-defense/blocked_uas.txt` and compiled it into `/etc/nginx/conf.d/ixwiki-dynamic-bots.conf`. This blocked Chrobby (and any user on Firefox 154) and all macOS Chrome users with HTTP 403.
2. **Missing Real-Time Authentication Bypass**: Nginx evaluated bot defense rules (`$bad_bot`, `$dynamic_bad_bot`, `$dynamic_blocked_ip`) unconditionally at the beginning of the server block without checking whether incoming requests came from authenticated users with valid MediaWiki or XenForo session cookies. Furthermore, `/var/log/nginx/authenticated_ips.log` was defined but never populated by Nginx.

## 2. Requirements & Goals
- **Zero-Exception Pass for Signed-in Users**: Any user signed into MediaWiki or XenForo with valid authentication cookies or active session must bypass all bot, IP, and query defense checks in Nginx with zero latency.
- **Subnet-Level Whitelisting for Registered Users**: Automatically whitelist the `/24` IPv4 subnet and `/64` IPv6 prefix for all registered wiki contributors in the database to accommodate dynamic ISP leases and mobile/SLAAC address shifts.
- **Real-Time IP Auto-Whitelisting**: Authenticated requests must immediately register the user's current IP in `/var/log/nginx/authenticated_ips.log`, which is ingested in real time by the defense daemon and synced to `/var/lib/ixwiki-defense/whitelist_ips.txt`.
- **MediaWiki Login Hook**: Hook MediaWiki authentication events (`UserLoggedIn`) in `LocalSettings.php` to immediately append the logging-in user's IP to the defense log.
- **Strict Protection for Web Browsers**: Ensure `/usr/local/bin/ixwiki-bot-defense.sh` never auto-blocks legitimate web browser User-Agents (Firefox, Chrome, Safari, Edge, Opera, Mobile). High traffic from browser UAs must be handled strictly by IP rate-limiting, protecting human users.
- **Immediate Resolution for Chrobby**: Unban Firefox 154 and macOS Chrome from Nginx configurations and verify HTTP 200 status.

---

## 3. Architecture & Component Design

### 3.1 Nginx Authentication & Bypass Layer
- **File**: `/etc/nginx/conf.d/ixwiki-bots.conf`
  Define the `$is_authenticated_user` map checking for active session and user credentials:
  ```nginx
  map $http_cookie $is_authenticated_user {
      default 0;
      "~*ixwikiUserID=[1-9]" 1;
      "~*ixwiki_session="    1;
      "~*ixwikiToken="       1;
      "~*xf_user="           1;
      "~*xf_session="        1;
  }
  ```
- **File**: `/etc/nginx/sites-available/ixwiki.com`
  1. Add conditional authenticated logging:
     ```nginx
     access_log /var/log/nginx/authenticated_ips.log auth_ip if=$is_authenticated_user;
     ```
  2. Protect defense blocks from affecting authenticated users:
     ```nginx
     # Combined check: only apply bot defenses to unauthenticated requests
     set $should_block 0;
     if ($bad_bot) { set $should_block 1; }
     if ($dynamic_bad_bot) { set $should_block 1; }
     if ($dynamic_blocked_ip) { set $should_block 1; }
     if ($is_authenticated_user) { set $should_block 0; }
     if ($should_block) { return 403; }
     ```

### 3.2 MediaWiki Application Hook
- **File**: `/ixwiki/config/LocalSettings.php`
  Register a hook on `UserLoggedIn` to append the user's IP immediately to `/var/log/nginx/authenticated_ips.log`:
  ```php
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

### 3.3 Defense Daemon Hardening (`ixwiki-bot-defense.sh`)
- **File**: `/usr/local/bin/ixwiki-bot-defense.sh`
  1. Add an `is_legitimate_browser()` helper:
     ```bash
     is_legitimate_browser() {
         local ua="$1"
         if echo "$ua" | grep -qiE "(firefox/|rv:[0-9.]+.*gecko|chrome/[0-9.]+|safari/[0-9.]+|edg/[0-9.]+|opera/|opr/[0-9.]+|mobile.*safari)"; then
             if ! echo "$ua" | grep -qE "Chrome/(9[0-9]|10[0-9]|11[0-2])\."; then
                 return 0
             fi
         fi
         return 1
     }
     ```
  2. In `block_user_agent()`:
     Immediately return 0 if `is_legitimate_browser "$ua"` is true. Log that the browser UA was skipped from banning, directing rate control to IP-level blocking.
  3. In `analyze_traffic()`:
     Do not trigger `block_user_agent` on legitimate browser strings.
  4. Ensure `whitelist_authenticated_users()` reads `/var/log/nginx/authenticated_ips.log` and pushes new IPs into `/var/lib/ixwiki-defense/whitelist_ips.txt`.

### 3.4 Subnet-Level Whitelist Synchronizer (`ixwiki-sync-whitelist.py`)
- **File**: `/usr/local/bin/ixwiki-sync-whitelist.py`
  1. For every registered user IP retrieved from MediaWiki (`cu_changes`, `cu_log_event`, `cu_private_event`) and XenForo (`xf_user_ip`, `xf_ip`):
     - For IPv4: Calculate the `/24` subnet (`ipaddress.IPv4Network(f"{ip}/24", strict=False)`).
     - For IPv6: Calculate the `/64` subnet (`ipaddress.IPv6Network(f"{ip}/64", strict=False)`).
     - Include both the exact IP and the network CIDR in `whitelist_ips.txt`.
  2. Sanitize `blocked_uas.txt`: Automatically strip any legitimate browser patterns (e.g., `Firefox`, `Macintosh.*Chrome`, `Chrome/13[0-9]`) from `blocked_uas.txt` on every run.
  3. Purge user subnets from `blocked_ips.txt` and unban matching IPs from fail2ban.

### 3.5 Whitelist Checker Tool (`ixwiki-check-whitelist.sh`)
- **File**: `/usr/local/bin/ixwiki-check-whitelist.sh`
  Support exact matching, IPv4 CIDR matching (including `/24`), and IPv6 CIDR matching (including `/64`).

---

## 4. Verification & Testing Plan
1. **Chrobby Firefox Simulation**:
   - `curl -k -I -H "Host: ixwiki.com" -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:154.0) Gecko/20100101 Firefox/154.0" https://127.0.0.1/wiki/Main_Page` must return `HTTP/2 200 OK`.
2. **macOS Chrome Simulation**:
   - `curl -k -I -H "Host: ixwiki.com" -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" https://127.0.0.1/wiki/Main_Page` must return `HTTP/2 200 OK`.
3. **Authenticated Cookie Bypass**:
   - Test request simulating a blocked bot UA or blocked IP, but including Cookie `ixwikiUserID=91; ixwiki_session=xyz`. Must return `HTTP/2 200 OK`.
   - Verify that `/var/log/nginx/authenticated_ips.log` logs the client IP.
4. **Daemon Protection Test**:
   - Execute `/usr/local/bin/ixwiki-bot-defense.sh analyze` and verify it refuses to block any browser UA.
5. **Subnet Whitelist Coverage**:
   - Verify that `/usr/local/bin/ixwiki-check-whitelist.sh 205.175.106.50` (same `/24` as Chrobby) exits 0 with `Whitelisted`.
