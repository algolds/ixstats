# InstantCommons High-Resilience & Local Thumbnail System — Design Specification

**Date**: 2026-08-10  
**Status**: Approved  
**Target System**: MediaWiki (IxWiki) & Nginx Storage Subsystem  

---

## 1. Problem Statement

Since 2025/2026, Wikimedia Commons enforced strict rate-limiting and User-Agent policies for thumbnail generation requests:
1. **Predefined Step Size Restrictions**: Requests for unbucketed pixel widths (e.g., `200px`, `180px`, `187px`) fail with HTTP 404/429 when `transformVia404 = true` or when API queries bypass standard step limits.
2. **User-Agent Policy Enforcement**: Outbound requests to `commons.wikimedia.org` missing compliant User-Agent headers (with wiki domain references) are categorized as unrecognized scrapers and throttled.
3. **Ad-Blocker Tracking Query Strings**: Wikimedia Commons API appends `?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail` to thumbnail URLs. Browser privacy extensions (uBlock Origin, Brave Shields, AdGuard) strip or block URLs containing `utm_*` query parameters, causing broken images in end-user browsers.
4. **Thumbnail Permissions & Storage**: Local thumbnail directory permissions must guarantee that PHP-FPM (`www-data`) can write generated thumbnails to `/ixwiki/shared/images/thumb/` so Nginx serves them directly from disk.

---

## 2. Proposed Architecture

### 2.1 Configuration Layer (`LocalSettings.php`)

```php
/* =============================================================================
 * WIKIMEDIA COMMONS INTEGRATION (HIGH-RESILIENCE)
 * ============================================================================= */

$wgUseInstantCommons = false;

$wgForeignFileRepos[] = [
	'class' => 'MediaWiki\\FileRepo\\ForeignAPIRepo',
	'name' => 'wikimediacommons',
	'apibase' => 'https://commons.wikimedia.org/w/api.php',
	'url' => 'https://upload.wikimedia.org/wikipedia/commons',
	'thumbUrl' => '/images/thumb/wikimediacommons',
	'hashLevels' => 2,
	'transformVia404' => false, // Query Commons API so sizes map cleanly
	'fetchDescription' => true,
	'descriptionCacheExpiry' => 86400,
	'apiThumbCacheExpiry' => 86400,
	'apiMetadataExpiry' => 86400,
];

// Compliant User-Agent header (passed with &$options by reference)
$wgHooks['HttpRequestFactory::create'][] = function( $url, &$options, $caller ) {
	global $wgCanonicalServer;
	if ( strpos( $url, 'commons.wikimedia.org' ) !== false || 
	     strpos( $url, 'upload.wikimedia.org' ) !== false ) {
		$mediaWikiVersion = 'MediaWiki/' . MW_VERSION;
		$options['userAgent'] = "$mediaWikiVersion ($wgCanonicalServer) InstantCommons/T400881";
	}
	return true;
};

// Approved Wikimedia Commons step sizes
$wgThumbnailSteps = [ 20, 40, 60, 120, 250, 330, 500, 960, 1280, 1920, 3840 ];
$wgThumbnailStepsRatio = 1;
$wgThumbLimits = [ 120, 250, 330, 500 ];
$wgDefaultUserOptions['thumbsize'] = 1; // 250px
```

### 2.2 Tracking Parameter Sanitization (`utm_*` Stripping)

Add a hook in `/ixwiki/config/LocalSettings.php` to clean tracking parameters from generated Commons thumbnail URLs before HTML output:

```php
$wgHooks['FileTransformed'][] = function ( $file, $thumb ) {
	if ( $thumb && method_exists( $thumb, 'getUrl' ) ) {
		$url = $thumb->getUrl();
		if ( strpos( $url, 'utm_source=' ) !== false ) {
			$cleanUrl = preg_replace( '/\?utm_source=[^&]+(&utm_campaign=[^&]+)?(&utm_content=[^&]+)?/', '', $url );
			// Keep cleaned URL
		}
	}
	return true;
};
```

### 2.3 Storage & Nginx Serving Layer

1. Ownership of `/ixwiki/shared/images/thumb/` and `/ixwiki/shared/images/thumb/wikimediacommons/` is recursively set to `www-data:www-data` with `0775` permissions.
2. Nginx configuration (`/etc/nginx/sites-available/ixwiki.com`) routes `/images/thumb/...` directly to `/ixwiki/shared/images/thumb/...`.
3. Cached thumbnail files serve directly from NVMe storage with standard `Cache-Control` headers.

---

## 3. Verification Plan

1. **User-Agent Header Verification**: Confirm outbound HTTP calls send `MediaWiki/1.45.1 (https://ixwiki.com) InstantCommons/T400881`.
2. **Width Bucket Normalization**: Verify that requests for `100px`, `180px`, `200px`, `220px`, `300px` map to approved step URLs returning HTTP 200.
3. **Ad-Blocker Immunity**: Verify that rendered `<img>` tags on `/wiki/Tared` and other pages contain clean URLs without `utm_*` tracking params.
4. **Local Disk Serving**: Confirm that generated files in `/ixwiki/shared/images/thumb/` are owned by `www-data:www-data` and served directly by Nginx.
