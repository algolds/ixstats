-- Stored notification links to legacy URLs, whose redirects are gone, rewritten to the pages those redirects led to.
-- "Notification"."href" is the only link column. Writers store a path: NotificationAPI's resolveHref prefixes the
-- production basePath (/projects/ixstates), which each statement keeps as group 1; others store it bare. Older rows
-- carry the old basePath /projects/ixstats. A query string and fragment are kept unless a comment says otherwise.
-- Statements run in order, each only on the rows its pattern matches; one that can take another's output comes after
-- it, and no pattern matches a link the file has rewritten, so running the file again changes nothing.

-- The old basePath /projects/ixstats goes (the app adds the current one to a bare path): /projects/ixstats/x → /x.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?(?:/projects/ixstats)+(?:/|(?=[?#])|$)', '\1/') WHERE "href" ~ '^(/projects/ixstates)?(?:/projects/ixstats)+(?:/|(?=[?#])|$)';
-- The forum bridge's conversations, /forum/conversations[/<id>] → /messages.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/forum/conversations(?:/[^?#]*)?(?=[?#]|$)', '\1/messages') WHERE "href" ~ '^(/projects/ixstates)?/forum/conversations(?:/[^?#]*)?(?=[?#]|$)';
-- The forum bridge's /forum, /forum/search, /forum/new-thread and /forum/bookmarks (exact) → /thinkpages; the XenForo thread, post, node and member routes stay, for the XenForo import's apply to point at native pages (import-notification-links.ts).
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/forum(?:/search|/new-thread|/bookmarks)?/?(?=[?#]|$)', '\1/thinkpages') WHERE "href" ~ '^(/projects/ixstates)?/forum(?:/search|/new-thread|/bookmarks)?/?(?=[?#]|$)';
-- /thinkpages/forum → /thinkpages (with ?realm=, the next statement takes it to the realm's Hub).
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/thinkpages/forum/?(?=[?#]|$)', '\1/thinkpages') WHERE "href" ~ '^(/projects/ixstates)?/thinkpages/forum/?(?=[?#]|$)';
-- /thinkpages?realm=<slug> → /thinkpages/r/<slug>/hub; the rest of the query goes, as the old redirect dropped it.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/thinkpages/?\?realm=([^&#]+)(?:&[^#]*)?', '\1/thinkpages/r/\2/hub') WHERE "href" ~ '^(/projects/ixstates)?/thinkpages/?\?realm=([^&#]+)(?:&[^#]*)?';
-- /thinkpages/feed → /dashboard.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/thinkpages/feed/?(?=[?#]|$)', '\1/dashboard') WHERE "href" ~ '^(/projects/ixstates)?/thinkpages/feed/?(?=[?#]|$)';
-- /thinkpages/saved → /dashboard/saved.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/thinkpages/saved/?(?=[?#]|$)', '\1/dashboard/saved') WHERE "href" ~ '^(/projects/ixstates)?/thinkpages/saved/?(?=[?#]|$)';
-- /thinkpages/profile/<username> → /dashboard/profile/<username>.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/thinkpages/profile/([^/?#]+)/?(?=[?#]|$)', '\1/dashboard/profile/\2') WHERE "href" ~ '^(/projects/ixstates)?/thinkpages/profile/([^/?#]+)/?(?=[?#]|$)';
-- /thinkpages/thinkshare → /messages.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/thinkpages/thinkshare/?(?=[?#]|$)', '\1/messages') WHERE "href" ~ '^(/projects/ixstates)?/thinkpages/thinkshare/?(?=[?#]|$)';
-- /thinkpages/thinktanks → /thinktanks.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/thinkpages/thinktanks/?(?=[?#]|$)', '\1/thinktanks') WHERE "href" ~ '^(/projects/ixstates)?/thinkpages/thinktanks/?(?=[?#]|$)';
-- /thinkpages/stashed → /stashes.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/thinkpages/stashed/?(?=[?#]|$)', '\1/stashes') WHERE "href" ~ '^(/projects/ixstates)?/thinkpages/stashed/?(?=[?#]|$)';
-- Ixnay's former slug, /r/ixworld[/...] → /r/ixnay[/...].
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/r/ixworld(?=[/?#]|$)', '\1/r/ixnay') WHERE "href" ~ '^(/projects/ixstates)?/r/ixworld(?=[/?#]|$)';
-- /r/<realm>/board → /thinkpages/r/<realm>.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/r/([^/?#]+)/board/?(?=[?#]|$)', '\1/thinkpages/r/\2') WHERE "href" ~ '^(/projects/ixstates)?/r/([^/?#]+)/board/?(?=[?#]|$)';
-- /thinkpages/r/ixworld[/...] → /thinkpages/r/ixnay[/...], after the ?realm= statement that can write it.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/thinkpages/r/ixworld(?=[/?#]|$)', '\1/thinkpages/r/ixnay') WHERE "href" ~ '^(/projects/ixstates)?/thinkpages/r/ixworld(?=[/?#]|$)';
-- /id/@<handle>/<tab> and /@<handle>/<tab> with a query → /@<handle>?tab=<tab>&<query>.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?(?:/id)?/@([^/?#]+)/([^/?#]+)/?\?', '\1/@\2?tab=\3&') WHERE "href" ~ '^(/projects/ixstates)?(?:/id)?/@([^/?#]+)/([^/?#]+)/?\?';
-- /id/@<handle>/<tab> and /@<handle>/<tab> without a query → /@<handle>?tab=<tab>.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?(?:/id)?/@([^/?#]+)/([^/?#]+)/?(?=#|$)', '\1/@\2?tab=\3') WHERE "href" ~ '^(/projects/ixstates)?(?:/id)?/@([^/?#]+)/([^/?#]+)/?(?=#|$)';
-- /id/@<handle> → /@<handle>.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/id/@([^/?#]+)/?(?=[?#]|$)', '\1/@\2') WHERE "href" ~ '^(/projects/ixstates)?/id/@([^/?#]+)/?(?=[?#]|$)';
-- /profile[/<sub>] → /settings; the sub path goes, as /settings has no sub pages.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/profile(?:/[^?#]*)?(?=[?#]|$)', '\1/settings') WHERE "href" ~ '^(/projects/ixstates)?/profile(?:/[^?#]*)?(?=[?#]|$)';
-- /achievements → /vault/achievements (?a=<key> kept).
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/achievements/?(?=[?#]|$)', '\1/vault/achievements') WHERE "href" ~ '^(/projects/ixstates)?/achievements/?(?=[?#]|$)';
-- /vault/exchange → /labs/exchange.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/vault/exchange/?(?=[?#]|$)', '\1/labs/exchange') WHERE "href" ~ '^(/projects/ixstates)?/vault/exchange/?(?=[?#]|$)';
-- /vault/marketplace → /vault/store.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/vault/marketplace/?(?=[?#]|$)', '\1/vault/store') WHERE "href" ~ '^(/projects/ixstates)?/vault/marketplace/?(?=[?#]|$)';
-- /vault/market with a query → /vault/store?tab=auctions&<query>.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/vault/market/?\?', '\1/vault/store?tab=auctions&') WHERE "href" ~ '^(/projects/ixstates)?/vault/market/?\?';
-- /vault/market without a query → /vault/store?tab=auctions.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/vault/market/?(?=#|$)', '\1/vault/store?tab=auctions') WHERE "href" ~ '^(/projects/ixstates)?/vault/market/?(?=#|$)';
-- /vault/packs with a query → /vault/store?tab=store&<query>.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/vault/packs/?\?', '\1/vault/store?tab=store&') WHERE "href" ~ '^(/projects/ixstates)?/vault/packs/?\?';
-- /vault/packs without a query → /vault/store?tab=store.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/vault/packs/?(?=#|$)', '\1/vault/store?tab=store') WHERE "href" ~ '^(/projects/ixstates)?/vault/packs/?(?=#|$)';
-- /vault/trading with a query → /vault/store?tab=trading&<query>.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/vault/trading/?\?', '\1/vault/store?tab=trading&') WHERE "href" ~ '^(/projects/ixstates)?/vault/trading/?\?';
-- /vault/trading without a query → /vault/store?tab=trading.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/vault/trading/?(?=#|$)', '\1/vault/store?tab=trading') WHERE "href" ~ '^(/projects/ixstates)?/vault/trading/?(?=#|$)';
-- /builder/import with a query → /builder?import=1&<query>.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/builder/import/?\?', '\1/builder?import=1&') WHERE "href" ~ '^(/projects/ixstates)?/builder/import/?\?';
-- /builder/import without a query → /builder?import=1.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/builder/import/?(?=#|$)', '\1/builder?import=1') WHERE "href" ~ '^(/projects/ixstates)?/builder/import/?(?=#|$)';
-- /mycountry/builder?section=import with more query → /builder?import=1&<query> (the founding flow reads only import=1).
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/mycountry/builder/?\?section=import&', '\1/builder?import=1&') WHERE "href" ~ '^(/projects/ixstates)?/mycountry/builder/?\?section=import&';
-- /mycountry/builder?section=import without more query → /builder?import=1.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/mycountry/builder/?\?section=import(?=#|$)', '\1/builder?import=1') WHERE "href" ~ '^(/projects/ixstates)?/mycountry/builder/?\?section=import(?=#|$)';
-- /mycountry/builder → /builder.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/mycountry/builder/?(?=[?#]|$)', '\1/builder') WHERE "href" ~ '^(/projects/ixstates)?/mycountry/builder/?(?=[?#]|$)';
-- /countries/<slug>/factbook → /countries/<slug>; the section routes (/factbook/economy, ...) stay.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/countries/([^/?#]+)/factbook/?(?=[?#]|$)', '\1/countries/\2') WHERE "href" ~ '^(/projects/ixstates)?/countries/([^/?#]+)/factbook/?(?=[?#]|$)';
-- /explore (exact) → /countries; /explore/collections stays.
UPDATE "Notification" SET "href" = regexp_replace("href", '^(/projects/ixstates)?/explore/?(?=[?#]|$)', '\1/countries') WHERE "href" ~ '^(/projects/ixstates)?/explore/?(?=[?#]|$)';
