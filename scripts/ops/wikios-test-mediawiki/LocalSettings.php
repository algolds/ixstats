<?php
/**
 * LocalSettings.php of the WikiOS test MediaWiki (plan 417). DEV ONLY.
 *
 * Mounted at /config/LocalSettings.php and selected through MW_CONFIG_FILE (see setup.sh), so the
 * MediaWiki installer, which refuses to run when $IP/LocalSettings.php exists, is not in its way.
 */
if ( !defined( 'MEDIAWIKI' ) ) {
	exit;
}

$secretKey = getenv( 'WIKIOS_TEST_MW_SECRET_KEY' );
if ( !$secretKey ) {
	die( "WIKIOS_TEST_MW_SECRET_KEY is not set: start the wiki with ./setup.sh\n" );
}

$wgSitename = 'WikiOS Test Wiki';
$wgMetaNamespace = 'WikiOS_Test_Wiki';
$wgScriptPath = '';
$wgServer = 'http://127.0.0.1:8089';
$wgResourceBasePath = $wgScriptPath;
$wgLanguageCode = 'en';
$wgSecretKey = $secretKey;

// SQLite in a named volume: the file is created by the installer in /var/www/data.
$wgDBtype = 'sqlite';
$wgDBname = 'wikios_test';
$wgSQLiteDataDir = '/var/www/data';

// Dev: always render fresh, never call out to the internet.
$wgMainCacheType = CACHE_NONE;
$wgParserCacheType = CACHE_NONE;
$wgMessageCacheType = CACHE_NONE;
$wgUseInstantCommons = false;
$wgShowExceptionDetails = true;

$wgEnableUploads = true;
$wgUploadDirectory = "$IP/images";
$wgUploadPath = "$wgScriptPath/images";
$wgRawHtml = false;

wfLoadSkin( 'Vector' );
$wgDefaultSkin = 'vector';

// Extensions WikiOS relies on when it renders wikitext through action=parse.
wfLoadExtensions( [
	'ParserFunctions',
	'Scribunto',
	'Cite',
	'TemplateStyles',
	'TemplateData',
	'SyntaxHighlight_GeSHi',
	'Poem',
	'PageImages',
	'TextExtracts',
	'Gadgets',
] );
$wgScribuntoDefaultEngine = 'luastandalone';

// Keep the test wiki's own article paths (/index.php/Title): only the rest of the production snippet
// (canonical URL, `wikios-mirror` group, bot passwords, sync webhook) is being exercised here.
define( 'WIKIOS_KEEP_WIKI_ARTICLE_PATH', true );
require_once '/config/wikios-localsettings.php';
