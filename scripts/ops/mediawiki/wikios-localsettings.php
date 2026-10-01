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
 *   3. Defines the `wikios-mirror` group used by the WikiOS bot account (WikiOSMirror), which also uploads files
 *      (plan 411: `upload`, `reupload`; svg and pdf are added to the file types).
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
// 2. Canonical URL -> WikiOS, for the current version of an existing content page only. MediaWiki
//    marks old revisions (?oldid=) and diffs (?diff=) as articles too, so those are excluded here:
//    they get no WikiOS canonical (MediaWiki adds none of its own there), which keeps /wiki/Foo (the
//    current text) from being named as the canonical URL of a specific old revision. Edit forms,
//    history, Special pages, missing pages and non-content namespaces get none either.
// ---------------------------------------------------------------------------------------------
$wgHooks['BeforePageDisplay'][] = static function ( $out, $skin ) {
	$title = $out->getTitle();
	if ( !$title || !$out->isArticle() || !$title->exists() || !$title->isContentPage() ) {
		return;
	}
	$request = $out->getRequest();
	if ( $request->getCheck( 'oldid' ) || $request->getCheck( 'diff' ) ) {
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
	'editsemiprotected',
	'upload',
	'reupload',
	'noratelimit',
	'skipcaptcha',
	// Broader than a plain mirror needs, kept on purpose. A bot password only carries these rights
	// if its grants include them (createBotPassword --grants ...), so a leaked bot password is
	// limited to the grants chosen when it was created; the group itself is what caps the account.
	//
	// - editprotected: WikiOS enforces its own page protection before it pushes a head. Without
	//   this right a page that is protected in MediaWiki could never be mirrored and the two sides
	//   would diverge. `editsemiprotected` above is the same reasoning for semi-protection.
	// - import, importupload: WikiOS' XML import writes
	//   through Special:Import / action=import, which needs both rights (owner scope: XML
//   export-0.11 import and export). The `basic` grant already carries editsemiprotected.
	'editprotected',
	'import',
	'importupload',
	// The page-operation mirror jobs (plan 407): a move, delete, undelete or protection made in WikiOS is
	// repeated here by this account, the same way. `move` and `move-subpages` are also a default of every
	// signed-in account, listed so the group does not depend on that; `suppressredirect` is a move that
	// leaves no redirect (WikiOS lets a mover ask for that). The bot password needs the matching grants:
	// `createeditmovepage` for the moves (it has suppressredirect), `delete` for delete and undelete, and
	// `protect`. Without delete/undelete/protect here those jobs fail with `permissiondenied` and end up dead.
	// None of this reaches the interface: the MediaWiki: namespace stays behind `editinterface`, which
	// the group does not have, for deleting, moving and protecting too (see the paragraph below).
	'move',
	'move-subpages',
	'suppressredirect',
	'delete',
	'undelete',
	'protect',
] as $right ) {
	$wgGroupPermissions['wikios-mirror'][$right] = true;
}

// Uploads (plan 411): the mirror's `upload` job puts the files WikiOS holds in MediaWiki with action=upload (the file
// itself in the request: `upload_by_url` is not needed and not granted). `upload` makes a file, `reupload` a new version
// of one that exists; both are in the list above. The bot password needs the grants `uploadfile` and
// `uploadeditmovefile` (docs/operations/wikios-v1-cutover.md, 3c).
//
// MediaWiki must also accept the file types WikiOS accepts (png jpg jpeg gif webp svg pdf), or a file of another
// type ends its job dead with `filetype-banned`. This only ADDS the two types a stock wiki lacks.
foreach ( [ 'png', 'gif', 'jpg', 'jpeg', 'webp', 'svg', 'pdf' ] as $extension ) {
	if ( !in_array( $extension, $wgFileExtensions, true ) ) {
		$wgFileExtensions[] = $extension;
	}
}

// Deliberately NOT granted: editinterface, editsitecss, editsitejs (and editsitejson/edituserjs/...),
// upload_by_url, reupload-shared (overwrites files of a shared repository, which this wiki does not use) and
// movefile (WikiOS refuses to move File: pages in v1, so no mirror job ever moves one: files are moved on classic
// MediaWiki by an administrator. The bot password's `uploadeditmovefile` grant would carry the right only if the
// group had it).
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
//
//    Only web requests (PHP-FPM) announce their edits. Edits made from the command line
//    (maintenance/edit.php, importDump.php, job runners, other CLI scripts) run outside the pool
//    and have no WIKIOS_WEBHOOK_SECRET in their environment, so they send nothing. That is
//    intended: WikiOS' `wiki-recentchanges` cron job (every 10 minutes, runAutoSyncCycle)
//    reads MediaWiki's recent changes and imports whatever the webhook did not announce.
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
