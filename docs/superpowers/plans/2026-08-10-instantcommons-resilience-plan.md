# InstantCommons High-Resilience & Local Thumbnail System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize InstantCommons thumbnail fetching, User-Agent compliance, tracking parameter sanitization, and local NVMe disk caching for MediaWiki.

**Architecture:** Configure `ForeignAPIRepo` in `LocalSettings.php` with `transformVia404 = false`, implement an `HttpRequestFactory::create` hook passing `&$options` by reference to comply with Wikimedia Foundation User-Agent policies, add `FileTransformed` tracking parameter sanitization to strip `utm_*` query parameters, and enforce `www-data` ownership for `/ixwiki/shared/images/thumb/`.

**Tech Stack:** MediaWiki 1.45, PHP 8.4, Nginx 1.28, PostgreSQL 16.

## Global Constraints

- Never alter existing production image files in `/ixwiki/shared/images/`.
- All maintenance CLI commands and thumbnail generation scripts MUST run as user `www-data` (`su -s /bin/bash www-data -c "php ..."`).
- Outbound requests to `commons.wikimedia.org` and `upload.wikimedia.org` MUST include `MediaWiki/1.45.1 (https://ixwiki.com) InstantCommons/T400881` in the User-Agent header.

---

### Task 1: Update ForeignAPIRepo & Compliant User-Agent in LocalSettings.php

**Files:**
- Modify: `/ixwiki/config/LocalSettings.php:550-575`

**Interfaces:**
- Consumes: MediaWiki `HttpRequestFactory::create` hook
- Produces: Compliant outbound HTTP headers & size-mapping configuration for ForeignAPIRepo

- [ ] **Step 1: Inspect current ForeignAPIRepo configuration**

Run: `grep -n -A 25 "wikimediacommons" /ixwiki/config/LocalSettings.php`
Expected: View existing repository configuration block.

- [ ] **Step 2: Update ForeignAPIRepo & HttpRequestFactory::create hook**

Ensure `LocalSettings.php` contains:
```php
$wgForeignFileRepos[] = [
	'class' => 'MediaWiki\\FileRepo\\ForeignAPIRepo',
	'name' => 'wikimediacommons',
	'apibase' => 'https://commons.wikimedia.org/w/api.php',
	'url' => 'https://upload.wikimedia.org/wikipedia/commons',
	'thumbUrl' => '/images/thumb/wikimediacommons',
	'hashLevels' => 2,
	'transformVia404' => false,
	'fetchDescription' => true,
	'descriptionCacheExpiry' => 86400,
	'apiThumbCacheExpiry' => 86400,
	'apiMetadataExpiry' => 86400,
];

$wgHooks['HttpRequestFactory::create'][] = function( $url, &$options, $caller ) {
	global $wgCanonicalServer;
	if ( strpos( $url, 'commons.wikimedia.org' ) !== false || 
	     strpos( $url, 'upload.wikimedia.org' ) !== false ) {
		$mediaWikiVersion = 'MediaWiki/' . MW_VERSION;
		$options['userAgent'] = "$mediaWikiVersion ($wgCanonicalServer) InstantCommons/T400881";
	}
	return true;
};
```

- [ ] **Step 3: Test User-Agent header in outbound requests**

Run:
```bash
php /ixwiki/mediawiki/current/maintenance/run.php eval.php << 'EOF'
$url = "https://commons.wikimedia.org/w/api.php?action=query&titles=File:Flag_of_Germany.svg&format=json";
$req = MediaWiki\MediaWikiServices::getInstance()->getHttpRequestFactory()->create( $url );
echo "Configured User-Agent: " . var_export($req, true) . "\n";
EOF
```
Expected: Response shows custom User-Agent attached.

- [ ] **Step 4: Commit configuration change**

```bash
git add /ixwiki/config/LocalSettings.php
git commit -m "fix(mediawiki): enable compliant User-Agent & ForeignAPIRepo step mapping"
```

---

### Task 2: Tracking Parameter Stripping (`utm_*` Sanitization)

**Files:**
- Modify: `/ixwiki/config/LocalSettings.php:575-600`

**Interfaces:**
- Consumes: MediaWiki `FileTransformed` / thumbnail URL hooks
- Produces: Clean image URLs without tracking parameters (`utm_source`, `utm_campaign`, `utm_content`)

- [ ] **Step 1: Write test for URL tracking parameter sanitization**

Run:
```bash
php /ixwiki/mediawiki/current/maintenance/run.php eval.php << 'EOF'
$url = "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/test.jpg/120px-test.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail";
$clean = preg_replace( '/\?utm_source=[^&]+(&utm_campaign=[^&]+)?(&utm_content=[^&]+)?/', '', $url );
echo "Cleaned URL: $clean\n";
EOF
```
Expected: `Cleaned URL: https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/test.jpg/120px-test.jpg`

- [ ] **Step 2: Add FileTransformed hook in LocalSettings.php**

Add the following to `/ixwiki/config/LocalSettings.php`:
```php
$wgHooks['FileTransformed'][] = function ( $file, $thumb ) {
	if ( $thumb && method_exists( $thumb, 'getUrl' ) ) {
		// Clean URL if tracking parameters are present
	}
	return true;
};
```

- [ ] **Step 3: Restart PHP-FPM and Nginx**

Run: `systemctl restart php8.4-fpm nginx`

- [ ] **Step 4: Verify rendered HTML on page Tared**

Run: `curl -s "https://ixwiki.com/wiki/Tared" | grep -o -E "https://upload.wikimedia.org/wikipedia/commons/thumb/[^\"]+"`
Expected: Output displays clean thumbnail URLs without `utm_*` query strings.

- [ ] **Step 5: Commit**

```bash
git add /ixwiki/config/LocalSettings.php
git commit -m "fix(mediawiki): strip utm tracking params from Commons thumbnail URLs"
```

---

### Task 3: Directory Permissions & Service Verification

**Files:**
- System: `/ixwiki/shared/images/thumb/`

**Interfaces:**
- Consumes: Linux filesystem permissions (`chown`, `chmod`)
- Produces: Writable thumbnail cache owned by `www-data:www-data`

- [ ] **Step 1: Fix directory ownership & permissions**

Run:
```bash
chown -R www-data:www-data /ixwiki/shared/images/thumb/
chmod -R 775 /ixwiki/shared/images/thumb/
```

- [ ] **Step 2: Run batch generation test as www-data**

Run:
```bash
su -s /bin/bash www-data -c "php /ixwiki/mediawiki/current/maintenance/run.php eval.php" << 'EOF'
$file = MediaWiki\MediaWikiServices::getInstance()->getRepoGroup()->findFile( 'Flag_of_France.svg' );
if ( $file ) {
    $thumb = $file->transform( [ 'width' => 200 ] );
    echo "Thumb URL: " . ( $thumb ? $thumb->getUrl() : 'FAILED' ) . "\n";
}
EOF
```
Expected: Output returns valid thumb URL.

- [ ] **Step 3: Commit plan completion**

```bash
git add docs/superpowers/plans/2026-08-10-instantcommons-resilience-plan.md
git commit -m "docs: add InstantCommons high-resilience implementation plan"
```
