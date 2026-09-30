<?php
/**
 * WikiOS v1 cutover settings for classic MediaWiki (plan 417).            *** NOT APPLIED ***
 *
 * Load from /ixwiki/config/LocalSettings.php with:
 *
 *     require_once '/ixwiki/public/projects/ixstats/scripts/ops/mediawiki/wikios-localsettings.php';
 *
 * (or copy this file next to LocalSettings.php and require it from there). Apply it in the order given
 * in docs/operations/wikios-v1-cutover.md: steps 6 and 8 differ by ONE line, $wgArticlePath below.
 * To stage it before the cutover, set WIKIOS_KEEP_WIKI_ARTICLE_PATH=1 in the PHP-FPM pool environment
 * (or define( 'WIKIOS_KEEP_WIKI_ARTICLE_PATH', true ) before the require) so $wgArticlePath stays
 * '/wiki/$1' until the nginx takeover is installed.
 *
 * What it does:
 *   1. Moves classic MediaWiki page URLs to /classic/$1 so WikiOS can own /wiki/*.
 *   2. Points canonical URLs of existing content pages at WikiOS.
 *   3. Defines the `wikios-mirror` group used by the WikiOS bot account (WikiOSMirror).
 *   4. Notifies WikiOS of every saved page (PageSaveComplete -> /api/wiki/sync-webhook).
 */

use MediaWiki\Deferred\DeferredUpdates;
use MediaWiki\MediaWikiServices;

if ( !defined( 'MEDIAWIKI' ) ) {
	exit;
}

// ---------------------------------------------------------------------------------------------
// 1. Classic MediaWiki moves to /classic/ (nginx: `location ^~ /classic/` in wikios-takeover.conf).
//    $wgScriptPath stays '' and $wgServer stays 'https://ixwiki.com'.
// ---------------------------------------------------------------------------------------------
if ( !defined( 'WIKIOS_KEEP_WIKI_ARTICLE_PATH' ) && !getenv( 'WIKIOS_KEEP_WIKI_ARTICLE_PATH' ) ) {
	$wgArticlePath = '/classic/$1';
}

// ---------------------------------------------------------------------------------------------
// 2. Canonical URL -> WikiOS, for existing content pages shown as an article only. Edit forms,
//    history, diffs, Special pages, missing pages and non-content namespaces keep MediaWiki's own.
// ---------------------------------------------------------------------------------------------
$wgHooks['BeforePageDisplay'][] = static function ( $out, $skin ) {
	$title = $out->getTitle();
	if ( !$title || !$out->isArticle() || !$title->exists() || !$title->isContentPage() ) {
		return;
	}
	$out->setCanonicalUrl( 'https://ixwiki.com/wiki/' . wfUrlencode( $title->getPrefixedDBkey() ) );
};

// ---------------------------------------------------------------------------------------------
// 3. The WikiOS mirror bot. Create the account `WikiOSMirror`, add it to this group, and create a
//    bot password (Special:BotPasswords) with the matching grants. WikiOS logs in as
//    WikiOSMirror@<bot-name> (env WIKIOS_MEDIAWIKI_BOT_USER / WIKIOS_MEDIAWIKI_BOT_TOKEN).
// ---------------------------------------------------------------------------------------------
$wgEnableBotPasswords = true;

foreach ( [
	'edit',
	'bot',
	'autoconfirmed',
	'import',
	'importupload',
	'upload',
	'reupload',
	'reupload-shared',
	'noratelimit',
	'skipcaptcha',
	// WikiOS enforces its own page protection before it pushes a head; without this right a page
	// that is protected in MediaWiki could never be mirrored and the two sides would diverge.
	'editprotected',
] as $right ) {
	$wgGroupPermissions['wikios-mirror'][$right] = true;
}

// Deliberately NOT granted: editinterface, editsitecss, editsitejs (and editsitejson/edituserjs/...).
// WikiOS keeps the Template:, Module: and MediaWiki: namespaces admin-only, so the mirror account
// must not be able to rewrite the wiki's interface messages, site CSS or site JS even if its bot
// password leaks. Those pages are edited on classic MediaWiki by a real administrator.

// ---------------------------------------------------------------------------------------------
// 4. Inbound webhook: tell WikiOS about every saved page, so it imports the edit right away
//    (src/app/api/wiki/sync-webhook/route.ts: POST, JSON {"title": "..."}, header
//    x-wiki-webhook-secret, answered 401 without the secret and 503 when WikiOS has none).
//
//    The secret comes from the PHP-FPM pool environment, never from this file:
//        env[WIKIOS_WEBHOOK_SECRET] = <same value as WIKI_SYNC_WEBHOOK_SECRET in the WikiOS env>
//    in /etc/php/8.4/fpm/pool.d/www.conf (PHP-FPM clears the environment unless it is listed
//    there), then `systemctl reload php8.4-fpm`. Without it the hook does nothing.
// ---------------------------------------------------------------------------------------------
$wgHooks['PageSaveComplete'][] = static function (
	$wikiPage,
	$userIdentity,
	$summary,
	$flags,
	$revisionRecord,
	$editResult
) {
	$secret = getenv( 'WIKIOS_WEBHOOK_SECRET' );
	if ( $secret === false || $secret === '' ) {
		return;
	}

	$services = MediaWikiServices::getInstance();

	// Echo guard: edits WikiOS pushed through the mirror account must not be announced back to it.
	if ( in_array( 'wikios-mirror', $services->getUserGroupManager()->getUserGroups( $userIdentity ), true ) ) {
		return;
	}

	$title = $wikiPage->getTitle()->getPrefixedText();
	$requestFactory = $services->getHttpRequestFactory();

	DeferredUpdates::addCallableUpdate( static function () use ( $requestFactory, $secret, $title ) {
		$request = $requestFactory->create(
			'http://127.0.0.1:3560/api/wiki/sync-webhook',
			[
				'method' => 'POST',
				'postData' => json_encode( [ 'title' => $title ] ),
				'timeout' => 3,
				'connectTimeout' => 3,
			],
			__METHOD__
		);
		$request->setHeader( 'Content-Type', 'application/json' );
		$request->setHeader( 'x-wiki-webhook-secret', $secret );

		$status = $request->execute();
		if ( !$status->isOK() ) {
			wfDebugLog( 'wikios', "sync-webhook failed for [[$title]]: " . $status->getWikiText() );
		}
	} );
};
