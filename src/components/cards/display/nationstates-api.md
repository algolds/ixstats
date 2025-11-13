The NationStates API helps scripts and bots interact with the site. It is faster than scraping regular HTML pages, easier on our servers, and the data format is guaranteed not to change unexpectedly. It is also the only way to legally automatically perform certain actions, such as sending telegrams and answering issues.

If your script interacts with regular HTML NationStates pages instead of using this API, you are bound by a bunch of special rules: Please read these Script Rules for HTML site.

If you're just getting started, you might want to use a pre-written wrapper rather than interact with this API directly! See Examples: Wrappers.

Please post feedback and questions in the API forum thread.

Table of Contents
Daily Data Dumps
APIs
Nation API
Standard
Public Shards
Private Shards
Private Commands
Region API
Standard
Shards
World API
Shards
World Assembly API
Shards
Telegrams API
Trading Cards API
Verification API
Server-Sent Events
Rate Limits
Terms of Use
API Versions
Help
Examples & Wrappers
Daily Data Dumps
If you need data on large numbers of nations or regions, it's fastest to use a daily dump file, which combines info on every nation/region/card/whatever into a single file. These are generated once per day at around 22:30 PST. They are fairly large (approx. 40MB for nations, 7MB for regions, and 12MB for cards) and compressed with gzip.

Regions
https://www.nationstates.net/pages/regions.xml.gz

Nations
https://www.nationstates.net/pages/nations.xml.gz

The advantage of the Daily Dump is it gives you data for far more nations and regions than you can practically retrieve via API calls. The disadvantages are that the data is up to 24 hours old, not live, and it doesn't include all the information you might want (not all shards).

Some people use a combination of API calls and dump files. This is a good idea if you want to compare a nation to others in its region. Since regions can contain thousands of nations, it's not practical to request data on all a nation's neighbors at once via the API. Instead, try building region-wide stats (e.g. total region population) using the most recent daily dump, and only drawing on the API for up-to-the-second information on the nation in question.

Daily Dumps from the past are archived here.

There's also a one-off dump for Trading Cards, generated shortly after the start of each new season. It's not refreshed because cards are permanently inscribed (barrying modly intervention) and thedata doesn't change over time.

Trading Cards
https://www.nationstates.net/pages/cardlist_S(season number).xml.gz

APIs
Nation API
Standard
A compendium of the most commonly sought information. If you don't need most of this data, please use shards (below) instead.

https://www.nationstates.net/cgi-bin/api.cgi?nation=(name)

... where (name) is the name of a nation (e.g. "The Grendels" or "the_grendels"). Names are not case-sensitive, but spaces in URLs generally need to be encoded, i.e. replaced with + or %20 or _.

Public Shards
Request exactly what you want! This is faster for us to generate, and can be used to request data not available from the Standard API.

https://www.nationstates.net/cgi-bin/api.cgi?nation=(name)&q=(shard1)+(shard2)+(...)

... where you can string together as many shards as you like, separated by + signs. Public shards provide information on any nation in the world and don't require authentication. They are:

admirable admirables animal animaltrait answered banner* banners* capital category census** crime currency customleader customcapital customreligion dbid deaths demonym demonym2 demonym2plural dispatches dispatchlist endorsements factbooks factbooklist firstlogin flag founded foundedtime freedom fullname gavote gdp govt govtdesc govtpriority happenings income industrydesc influence influencenum lastactivity lastlogin leader legislation majorindustry motto name notable notables nstats policies poorest population publicsector rcensus region religion richest scvote sectors sensibilities tax tgcanrecruit*** tgcancampaign*** type wa wabadges wcensus zombie****

* banner: Returns one Rift banner code that should be displayed for this nation: the nation's primary banner, if one is set; otherwise a randomly chosen eligible banner. The banners shard returns a list of Rift banners that should be displayed: the nation's primary banner (if any) is always listed first, with the remainder in random order. Banner codes can be converted into image URLs by prepending "/images/banners/" and appending ".jpg".

** census: By default, returns the score, rank, and region rank on today's featured World Census scale. Can be optionally configured with additional parameters:

scale=(census ID/s): Specify the World Census scale(s) to list, using numerical IDs. The IDs can be found here or in the URL of World Census pages. Separate multiple scales with +. For all scales, use all.
mode=(name/s): Specify the data you want, separating multiple modes with +.
score: Raw value
rank: World rank (e.g. "334" means 334th in the world)
rrank: Region rank
prank: World rank as a percentage (e.g. "15" means "Top 15%")
prrank: Region rank as a percentage
history: This is a special mode that cannot be combined with other modes, as only scores are available, not ranks. When requesting history, you can optionally specify a time window, using Unix epoch times:
from=(timestamp)
to=(timestamp)
*** tgcanrecruit / tgcancampaign: Returns 1 if the nation will receive a telegram of this type, and 0 if not (because it has blocked recruitment TGs, for example, or is a Class nation). You may optionally supply from=(region_name) which allows the check to also examine whether nations will deny a telegram from that region in particular due to having received one too recently.

**** zombie: For use during Z-Day (October 31), when NationStates is traditionally overrun with zombies.

If you are looking for the Number of WA Endorsements, use q=census;scale=66;mode=score or count the entries returned by endorsements.

Where possible, please combine multiple shards into a single request, rather than making multiple requests for different shards for the same nation.

Private Shards
These provide access to information that can only be viewed by a logged-in nation, such as its telegrams or issues. They follow the exact same format as public shards, and indeed you can mix and match public and private shards in a single request. However, any request that includes a private shard must authenticate. They are:

dossier* issues issuesummary nextissue nextissuetime notices* packs ping** rdossier* unread

* notices by default displays only new (unread) notices, as well as notices less than 48 hours old, just like on the regular site. For more notices, supply the optional parameter from=(timestamp), where (timestamp) is a Unix epoch time.

** ping is ideal for when you don't want to do anything except register a login, to prevent the nation from ceasing to exist due to inactivity.

See: Authenticating for Private Shards.

Private Commands
Private Commands allow your nation to do things, such as answer issues. They are very similar in practice to Private Shards, but are for taking action, rather than simply gathering information. They are requested with c=(command name), rather than "q=(shard name)".

You must authenticate for Private Commands in the exact same way as for Private Shards.

Most Private Commands require a two-step process: first you must prepare the request, then execute it (see below).

Available Private Commands:

issue: Address an Issue

To answer an issue, specify c=issue as well as issue=(number) option=(number)

To dismiss an issue, send option=-1

You can fetch the associated text for an issue by using the issues Nation Private Shard. Note that Option ID numbers begin counting at zero.

This command will return XML describing the result of the passed legislation. It may include these XML elements: OK ERROR DESC RANKINGS UNLOCKS RECLASSIFICATIONS NEW_POLICIES REMOVED_POLICIES

Example: To enact legislation in Testlandia for Issue #111 using Option #2:

curl -H "X-Password: hunter2" -A "UserAgent Example" "https://www.nationstates.net/cgi-bin/api.cgi" --data "nation=testlandia&c=issue&issue=111&option=2"

giftcard: Gift a Trading Card

BETA: Currently in development. Subject to change without warning.

To send a Trading Card you own to another nation, specify c=giftcard as well as cardid=(number) season=(number) to=(nation name)

Follow the two-step process to first prepare and then execute a Private Command.

Example: To send a Season 1 "Mindless contempt" card from Testlandia to Frisbeeteria:

curl -H "X-Password: hunter2" -A "UserAgent Example" "https://www.nationstates.net/cgi-bin/api.cgi" --data "nation=testlandia&c=giftcard&cardid=159058&season=1&to=frisbeeteria&mode=prepare

curl -H "X-Pin: 1234567890" -A "UserAgent Example" "https://www.nationstates.net/cgi-bin/api.cgi" --data "nation=testlandia&c=giftcard&cardid=159058&season=1&to=frisbeeteria&mode=execute&token=123456789abcdefg

junkcard: Junk a Trading Card

BETA: Currently in development. Subject to change without warning.

To junk a Trading Card, specify c=junkcard as well as cardid=(number) season=(number)

Follow the two-step process to first prepare and then execute a Private Command.

Example: To junk a Season 1 "Mindless contempt" card:

curl -H "X-Password: hunter2" -A "UserAgent Example" "https://www.nationstates.net/cgi-bin/api.cgi" --data "nation=testlandia&c=junkcard&cardid=159058&season=1&mode=prepare

curl -H "X-Pin: 1234567890" -A "UserAgent Example" "https://www.nationstates.net/cgi-bin/api.cgi" --data "nation=testlandia&c=junkcard&cardid=159058&season=1&mode=execute&token=123456789abcdefg

dispatch: Write a Dispatch

BETA: Currently in development. Subject to change without warning.

To add, edit, or remove a dispatch, specify c=dispatch as well as dispatch=(action) where the action is one of these three values: add edit remove

When adding or editing a dispatch, specify: title=(text) text=(text) category=(number) subcategory=(number)

When editing or removing a dispatch, you must also specify: dispatchid=(number)

Follow the two-step process to first prepare and then execute a Private Command.

Examples: To create a new dispatch:

curl -H "X-Password: hunter2" -A "UserAgent Example" "https://www.nationstates.net/cgi-bin/api.cgi" --data "nation=testlandia&c=dispatch&dispatch=add&title=Test%20Dispatch&text=Hello%20there.&category=1&subcategory=105&mode=prepare"

curl -H "X-Pin: 1234567890" -A "UserAgent Example" "https://www.nationstates.net/cgi-bin/api.cgi" --data "nation=testlandia&c=dispatch&dispatch=add&title=Test%20Dispatch&text=Hello%20there.&category=1&subcategory=105&mode=execute&token=1234567890abcdefg"

Example: To edit that dispatch:

curl -H "X-Pin: 1234567890" -A "UserAgent Example" "https://www.nationstates.net/cgi-bin/api.cgi" --data "nation=testlandia&c=dispatch&dispatch=edit&dispatchid=123456&title=Test%20Dispatch%20Edited&text=I%20Was%20Edited.&category=1&subcategory=105&mode=prepare"

curl -H "X-Pin: 1234567890" -A "UserAgent Example" "https://www.nationstates.net/cgi-bin/api.cgi" --data "nation=testlandia&c=dispatch&dispatch=edit&dispatchid=123456&title=Test%20Dispatch%20Edited&text=I%20Was%20Edited.&category=1&subcategory=105&mode=execute&token=1234567890abcdefg"

Example: To remove that dispatch:

curl -H "X-Pin: 1234567890" -A "UserAgent Example" "https://www.nationstates.net/cgi-bin/api.cgi" --data "nation=testlandia&c=dispatch&dispatch=remove&dispatchid=123456&mode=prepare"

curl -H "X-Pin: 1234567890" -A "UserAgent Example" "https://www.nationstates.net/cgi-bin/api.cgi" --data "nation=testlandia&c=dispatch&dispatch=remove&dispatchid=123456&mode=execute&token=1234567890abcdefg"

rmbpost: Post to a regional RMB

BETA: Currently in development. Subject to change without warning.

To post a message to a regional message board, specify c=rmbpost as well as these three parameters: nation=(text) region=(text) text=(text) mode=(text)

Follow the two-step process to first prepare and then execute a Private Command.

Examples: To create a new dispatch:

curl -H "X-Password: hunter2" -A "UserAgent Example" "https://www.nationstates.net/cgi-bin/api.cgi" --data "nation=testlandia&c=rmbpost&region=testregionia&text=Hello%20there.&mode=prepare"

curl -H "X-Pin: 1234567890" -A "UserAgent Example" "https://www.nationstates.net/cgi-bin/api.cgi" --data "nation=testlandia&c=rmbpost&region=testregionia&text=Hello%20there.&mode=execute&token=1234567890abcdefg"

Preparing & Executing Private Commands
All Private Commands except issue should be performed as a two step process:

First prepare the command, by sending your request to the API with the following parameter appended: mode=prepare

Now execute the command by re-sending the same request, only this time appending the following two parameters, using the data that the server returned to you in the first step: mode=execute token=(string)

The server will not honor duplicate requests; i.e. attempts to perform the same action multiple times with the same token. You need to perform the two-step process each time: prepare, then execute.

Since you will probably be performing these two requests in quick succession, be aware of how Authenticating For Private Shards & Commands work. In particular, note that you cannot login twice in quick succession with X-Password or X-Autologin: instead, you should use X-Pin for your subsequent requests.

Authenticating For Private Shards & Commands
In order to access a private shard, you must:

Connect via HTTPS (not HTTP)

Include one or more of the following headers:

X-Pin An integer like: 1234567890

X-Password A string like: hunter2

X-Autologin A string like: rjK,CEu9b6T5A45zkvHtA

For example, if Testlandia's password were "hunter2", you could use curl to retrieve its unread notifications like this:

curl -H "X-Password: hunter2" -A "UserAgent Example" "https://www.nationstates.net/cgi-bin/api.cgi?nation=testlandia&q=unread"

This example also sets a UserAgent, which is mandatory, and identifies your script to us.

The authentication process works like this:

A flowchart of API authentication process. Requests with a valid PIN always succeed, while other requests may throw a 409 Conflict error.

The first time you access a private shard, you will probably provide X-Password, since that's all you know. It's fine to keep doing this for all requests in some circumstances, such as if you are running your own script on your own computer, which only makes one request every so often. However, you may want to switch to X-Autologin, which is an encrypted version of your password, to avoid having to store it anywhere in plaintext. Whenever you authenticate with X-Password, the server response will include an X-Autologin header with the code you need, which will work until the nation's password is changed.

If you plan on making multiple requests for private shards in quick succession for the same nation, you need to use X-Pin. This is a session identifier, created when the nation logs in, and persisting until it logs out or goes idle for two hours. Whenever you authenticate with either X-Password or X-Autologin, the server response will include an X-Pin header with the number you need. This number will work until the nation logs out.

The advantage of X-Pin is it skips the heavy authentication checks that are required when a nation logs in, allowing you to quickly make multiple requests. Without this, you may encounter a 409 Conflict error, which is triggered when a nation attempts to log in via the API despite having successfully logged in very recently (within a few seconds). To make multiple requests in a short period of time, then, your script should first authenticate with X-Password or X-Autologin, note the value of the X-Pin header returned, and for future requests supply that in your own X-Pin header.

You can supply one, two, or all three authentication headers with each request, and these will be processed as shown by the flowchart above—notably, X-Pin will always be used first if it's valid.

The Gotcha: Logging in cancels any existing session, invalidating its Pin. This means that if you have a script running in the background while also browsing NationStates manually, the two will fight each other, with a request from one logging out the other. This can go unnoticed in your browser, assuming you have autologin turned on, because you don't realize you are silently reauthenticating with each click. But you will notice it via the API because too-frequent logins generate a 409 Conflict error.

This will also happen if you have multiple scripts that don't share Pins. If each one only keeps track of its own session, then a request from one will invalidate the Pin of the other.

See also: The Nations Daily Dump.

Region API
Standard
https://www.nationstates.net/cgi-bin/api.cgi?region=(name)

Shards
https://www.nationstates.net/cgi-bin/api.cgi?region=(name)&q=(shard1)+(shard2)+(...)

Available shards:

banlist banner bannerby bannerurl census* censusranks* dbid delegate delegateauth** delegatevotes dispatches embassies embassyrmb*** factbook flag founded foundedtime founder frontier gavote governor governortitle happenings history lastupdate lastmajorupdate lastminorupdate magnetism messages**** name nations numnations wanations numwanations officers** poll power recruiters scvote tags wabadges zombie*****

* For details, see the Nation shard census / the World shard censusranks.

** Authorities are represented by letter codes:

X: Executive
W: World Assembly
S: Succession
A: Appearance
B: Border Control
C: Communications
E: Embassies
P: Polls
*** embassyrmb: Return status is:

0: No embassy posting
con: Delegates & Founders of embassy regions
off: Officers of embassy regions
com: Officers of embassy regions with Communications authority
all: All residents of embassy regions
**** messages: Returns messages posted on a regional message board. By default, returns the 10 most recent messages, sorted from oldest to newest. Accepts additional optional parameters:

limit=(maximum number of messages): Return this many messages. Must be in the range 1-100.
offset=(number): Skip the most recent (number) messages.
fromid=(post ID number): Instead of returning the most recent messages, return messages starting from this post ID.
To interpret the STATUS of a post:

0: A regular post
1: Post is suppressed but viewable. In this case, there will also be a SUPPRESSOR field with the name of the nation who suppressed the post.
2: Post was deleted by the author and is not viewable.
9: Post was suppressed by a moderator and is not viewable.
***** See the nation zombie shard for details.

See also: The Regions Daily Dump.

World API
Shards
Look up data about the game world.

https://www.nationstates.net/cgi-bin/api.cgi?q=(shard1)+(shard2)+(...)

Available shards:

banner1 census2 censusid censusdesc3 censusname3 censusranks3 censusscale3 censustitle3 dispatch dispatchlist4 faction5 factions5 featuredregion happenings6 lasteventid nations newnations newnationdetails numnations numregions poll regions regionsbytag7 tgqueue

1 banner: Supply a comma-separated list of banner IDs with banner=(list)

2 census: See the nation shard for details.

3 censusname, censusscale, etc: Return information on the day's featured World Census ranking by default. You can optionally specify a scale by adding scale=(ID number).

3 censusranks: Accepts an optional parameter start=(rank number).

4 dispatchlist: Configure by appending optional extra parameters:

dispatchauthor=(nation name) to list dispatches authored by a particular nation.
dispatchcategory=(category name) to list dispatches belonging to a particular category, such as "Factbook" or "Bulletin".
dispatchcategory=(category name):(subcategory name) to list dispatches belonging to a particular subcategory, such as "Factbook:Geography".
dispatchsort=(sort type) to specify a sort type: "new" or "best". (Default: new.)
You can combine the above, e.g. Best ever Factbook:History dispatches.

Full individual dispatches (including text) can be looked up with the dispatch shard.

5 faction and factions are only available during N-Day, when nations are conducting nuclear exchanges.

6 happenings: Configure by appending optional extra parameters:

view=(type) to confine the results to a particular set of nations. Valid view types are:
view=nation.(nation name) One particular nation
view=nation.(comma-separated nation names) A list of nations
view=region.(region name) Residents of one particular region
view=region.(comma-separated region names) A list of regions
filter=(type) to specify a list of filters, separated by +. Available filters: law change dispatch rmb embassy eject admin move founding cte vote resolution member endo
limit=(number) to set a maximum number of results
sinceid=(number) to restrict results to only those with a higher EVENT ID than the number specified. You may want to use this when regularly polling the API, to avoid having to process the same results over and over.
beforeid=(number) The opposite of the above. Useful if you want to allow paging through data, by only returning results older than a particular EVENT ID.
sincetime=(timestamp) to restrict results to only those that occurred more recently than the given timestamp.
beforetime=(timestamp) to restrict results to only those that occurred earlier than the given timestamp.
You may combine the above; for example, like this.

The happenings shard has a 28-second delay between a nation doing something and it becoming visible via this API. This is reflected in the id of the event shown through lasteventid: the lasteventid shard shows the event id of the last event currently available through the happenings shard.

7 regionsbytag: You can add tag names as ;tags=(tagname1),(tagname2), up to a maximum of 10 tags. This will list all regions belonging to any of the named tags. Tags can be preceded by a - to select regions which do not have that tag; for example, like this. For a full list of tag names, see the Tag Cloud.

World Assembly API
Shards
Look up data about the World Assembly.

https://www.nationstates.net/cgi-bin/api.cgi?wa=(council_id)&q=(shard1)+(shard2)+(...)

... where council_id is 1 for the General Assembly and 2 for the Security Council. In the case of shards that return data for the overall World Assembly (e.g. numnations), it doesn't matter which council_id you use: either will return the same result.

Available shards:

numnations numdelegates delegates members happenings proposals resolution voters* votetrack* dellog* delvotes* lastresolution

* Shards marked with an asterisk, such as dellog, are only available when used in conjunction with resolution for the current at-vote resolution.

You can also specify a resolution with id:

https://www.nationstates.net/cgi-bin/api.cgi?wa=(council_id)&id=(resolution_id)&q=resolution

If you omit id, you will get information on the current at-vote resolution.

Telegrams API
The Telegrams API exists to support things that aren't possible using the in-game Mass Telegram system; for example, automatically targeting telegrams at nations with capitalist leanings in regions with more than 50 residents. It's also possible to duplicate what the in-game system offers you via Telegram Stamps, only slower.

Important Note: You must use this API if you want to send telegrams with a script or browser tool. Using a script or tool to send telegrams from the regular Telegrams page is a violation of our Script Rules, and may lead to deletion of your nation as well as penalties for the region for which you are recruiting.

Telegram API Rate Limits
The Telegrams API imposes an additional rate limit:

Recruitment TGs: 1 telegram per 180 seconds

Non-recruitment TGs: 1 telegram per 30 seconds

(These rate limits may change in the future.)

If you attempt to send telegrams faster than this, your request will fail, and the response will include a 'X-Retry-After' header with information on when you can try again successfully. There is no penalty for trying too soon, although each request does count toward your overall API Rate Limit.

The Telegrams API Rate Limit works by checking the amount of time that has passed since your last successful request. For example, if you sent a telegram via the API 60 seconds ago, you can now successfully send a non-recruitment telegram (since 60 is greater than 30), but not a recruitment telegram (since 60 is less than 180).

Telegrams API Client Key
Unlike the rest of the API, to use the Telegrams API you need an API Client Key. Currently, you can do this by lodging a Help Request with the moderators, describing:

The purpose of your script (e.g. to send recruitment TGs, welcome-to-my-region TGs...)

The region your script will be serving

The nation primarily responsible for the script

API Client Keys are tied to a particular region, and each region may only have one (although they can be revoked and re-issued). Multiple people and scripts within a region can use the same API Client Key. If they do, they will be bound by the same rate limit: that is, when anyone uses the API Client Key to send a recruitment telegram, no-one else using the same API Client Key will be able to send more messages until the rate limit expires.

Once approved, a moderator will telegram you an API Client Key, which you can use for future API calls.

You are responsible for all use of your Telegrams API Client Key. If you suspect that it is not being used appropriately, please immediately contact the moderators.

(This process is still being developed and may change in the future. It is currently mostly geared around the idea of using the Telegrams API to send recruitment telegrams for a particular region, and may be confusing to people wishing to do other things as well. If you are unsure, please file a Help Request or post in the Technical Forum.)

To send telegrams via the API
If you haven't already, obtain a Telegrams API Client Key, as described above.

Compose your telegram, addressing it to tag:api and click Send. (Tip: When composing, you may wish to make use of the %NATION% macro—see here.)

Your telegram will be registered as an API template, and you will be shown instructions on how to deliver it. This entails noting two pieces of information: its TGID and its Secret Key. You can then use these to make API calls to:

https://www.nationstates.net/cgi-bin/api.cgi?a=sendTG&client=(Client Key)&tgid=(TGID)&key=(Secret Key)&to=(nation_name)

You must make one API call per recipient. If, for example, you want to send a message to 1,000 recipients, you need to compose the telegram, send it to tag:api, then make 1,000 API calls, spaced sufficiently far apart to abide by the ratelimit, to deliver all copies.

Never share your telegram's Secret Key, as this will allow others to send your telegram to the recipients of their choice. You are responsible for all usage of your keys.

If you need to look up your telegram's TGID or Secret Key again, it can be found in the Delivery Reports section of your telegram, in your Sent Items folder.

Trading Cards API
BETA: Currently in development. Subject to change without warning.

The Cards API provides information on Trading Cards. To perform actions via the API, such as gifting cards to another nation, see Nation Private Commands.

Individual Cards
To request information on a specific card:

https://www.nationstates.net/cgi-bin/api.cgi?q=card+(shard1)+(shard2)+(...);cardid=(shard1);season=(season)

Valid shards are: (none) info markets1 owners trades2

1markets lists all active Bids and Asks.

2trades: Optionally supply one or more additional parameters:

limit=(number) to view a maximum number of results. Default: 50.
sincetime=(timestamp) to view trades that occurred more recently than the given timestamp.
beforetime=(timestamp) to view trades that occurred earlier than the given timestamp.
Decks
To view all cards owned by a particular nation:

https://www.nationstates.net/cgi-bin/api.cgi?q=cards+deck;nationname=(name)

or:

https://www.nationstates.net/cgi-bin/api.cgi?q=cards+deck;nationid=(number)

Deck Owner Info
To view deck-related information about a particular nation:

https://www.nationstates.net/cgi-bin/api.cgi?q=cards+info;nationname=(name)

or:

https://www.nationstates.net/cgi-bin/api.cgi?q=cards+info;nationid=(number)

Asks and Bids
To view Asks and Bids made by a particular nation:

https://www.nationstates.net/cgi-bin/api.cgi?q=cards+asksbids;nationname=(name)

or:

https://www.nationstates.net/cgi-bin/api.cgi?q=cards+asksbids;nationid=(number)

Collections
To view the collections created by a particular nation:

https://www.nationstates.net/cgi-bin/api.cgi?q=cards+collections;nationname=(name)

or:

https://www.nationstates.net/cgi-bin/api.cgi?q=cards+collections;nationid=(number)

To view a particular Collection:

https://www.nationstates.net/cgi-bin/api.cgi?q=cards+collection;collectionid=(number)

Auctions
To view all cards currently at auction:

https://www.nationstates.net/cgi-bin/api.cgi?q=cards+auctions

Trades
To view Trades of all cards:

https://www.nationstates.net/cgi-bin/api.cgi?q=cards+trades

The same optional extra parameters are supported here as per the trades shard under Individual Cards above: limit sincetime beforetime

See also: The Trading Cards Daily Dump (for lots of card data at once) and Nation Private Commands (for gifting cards).

Verification API
This can be used by a third-party website to verify that a user owns a particular nation, without requiring that user to divulge sensitive information.

Steps:

Ask the user to visit https://www.nationstates.net/page=verify_login and enter the code displayed into your website.

Have your site make a request to:

https://www.nationstates.net/cgi-bin/api.cgi?a=verify&nation=(Nation Name)&checksum=(code)

The API will return 1 if the checksum code is correct for the specified logged-in nation. If the code is incorrect, or the nation does not exist, or is not currently logged in, the API will return 0.

The code will expire if the nation logs out, if it performs a significant in-game action such as moving regions or endorsing another nation, and after it is successfully verified.

The code only allows nation verification by a third party website, and does not provide any extra access to or control over the nation.

Adding a site-specific token
For additional security, a third-party site can optionally add its own token to the verification process. This means that the generated checksum code will only be valid for that site. Without this, it is possible for a third-party site to use the user's supplied checksum code to impersonate them on a separate third-party site.

Steps:

Append ?token=(Your token) to the verify_login URL you ask the user to visit, where your token is a string of characters you generate and is unique to that nation. The important thing is that you should be able to re-generate the same token given the same nation name, but nobody else knows how you do it. For example, you might produce an MD5 hash of the nation name using a private key. Your user then fetches their code from this URL: https://www.nationstates.net/page=verify_login?token=(Your token).

Append the same token to your API request:

https://www.nationstates.net/cgi-bin/api.cgi?a=verify&nation=(Nation Name)&checksum=(code)&token=(Your token)

Combining verification with shards
You can combine verification with a request for nation data into a single call by appending &q=(shard). In this case, the result of the verification (1 or 0) is returned within <VERIFY> tags as XML:

https://www.nationstates.net/cgi-bin/api.cgi?a=verify&nation=(Nation Name)&checksum=(code)&q=(shard1)+(shard2)+(...)

Server-Sent Events
BETA: Currently in development. Subject to change without warning.

Server-Sent Events (SSE) allow you to receive real-time streams of NationStates Happenings data without repeatedly polling the API. You can subscribe to one or more "buckets" of events (e.g. law, change, dispatch). Benefits:

Real-time updates: You get notified as soon as an event happens

Your requests aren't limited by API Rate Limits

Reduced server load: Helps prevent our servers from catching fire

Basic Usage
To subscribe to an SSE feed, make a request to:

https://www.nationstates.net/api/(bucket1)+(bucket2)+(...)
where:

bucket1, bucket2, ... correspond to any of the buckets (described below) that you want to subscribe to. You may specify multiple buckets by joining them with +.
Buckets
The buckets you can subscribe to match the same event categories used by the World API happenings shard. These include:

law change dispatch rmb embassy eject admin move founding cte vote resolution member endo nation:(nation name) region:(region name)
Including multiple buckets will return all events belonging to any one of the buckets. For instance, dispatch+move+cte will include dispatch-related events, nation movements, and nations ceasing to exist.

Event Format
A typical event will be a JSON object with the following keys:

id: A unique identifier for the event.
time: The time at which the event occurred.
str: A string containing the full details of the happening such as nation/region names, and descriptive text.
Restrictions
As SSE connections can be held open indefinitely, there are two limits on its use: a limit per-IP, and a global limit for all users. If either of these limits are exceeded, the SSE endpoint will return status 429.

The per-IP limit is 5 concurrent connections. It is possible that connections are "held open" from our persepective for longer than you may expect, if the connection is not properly closed. If this limit is exceeded, you will receive status 429 with the message Too Many Requests: Connection limit exceeded for your IP. Please try again later. Attempts to circumvent this limit will be harshly punished.

The global limit is not publiscised. It is set sufficiently high that we do not anticipate it being exceeded by normal use of SSE. If this limit is exceeded, you will receive status 429 with the message Too Many Requests: The SSE server is full. Please try again later. If you encounter this message, we encourage you to notify us, via GHR or via forum post.

Rate Limits
The API is rate-limited and will temporarily lock you out if you send too many requests within a short period of time. (And return status 429: "Too Many Requests From Your IP Address.")

API Rate Limit: 50 requests per 30 seconds.

The API uses a so-called "flush bucket" to enforce this. In other words, when you send your first request, the API begins counting your requests for the next 30 seconds (the time window). If you send more than 50 in that time, it will return status 429 and the header 'Retry-After: n', where n is the number of seconds until you can make another request. Once the time window has elapsed, a new time window starts and you can send requests again. This means that if you hit on the rate limit a few times, the API won't penalize you, only locking you out until the time window ends. However, if the API detects that you are doing this a lot, it will lock you out for 15 minutes or longer. This is designed to let multiple sensible scripts running at the same time without much disruption.

Several headers are returned to help scripts obey rate limits without risk of locking out. These are based on current efforts to standardize rate limiting headers for HTTP; see here for details. These headers give scripts all the information they need to rate limit correctly without needing to hardcode values. You shouldn't hardcode the ratelimit, but rather use these headers. The headers that the API sends are:

RateLimit-Policy: Set to "50;w=30" and describes the API's policy for rate limiting.
RateLimit-Limit: Set to "50"; which means that there are a total of 50 requests available in the current time window (bucket). You should use this value rather than hardcoding 50.
RateLimit-Remaining: How many more requests can be made within the current time window.
RateLimit-Reset: Number of seconds remaining in the current time window.
Retry-After: Once blocked from accessing the API, your script should wait this amount of seconds before trying again.
A "request" is an HTTP request to the site for any amount of information and any number of shards. That is, an HTTP request like this is a single request, even though it gathers information on three shards.

As per the Telegrams API documentation, an additional limit applies when sending TGs.

Scraping
The API is designed to support scripts that need to fetch small amounts of real-time data quickly. If instead you need large amounts of world-wide or historical data, e.g. a region's entire Regional Message Board, or information from thousands of nations at once, you should not flood us with API requests.

In particular, it is not feasible to use the API to gather data on every nation in a region at once. If you need region-wide stats that can only be gathered by examining nations, you should compile these from Daily Data Dumps rather than dozens/hundreds/thousands of real-time API requests. For example, if your script wants to allow users to compare their nation's Civil Rights to the rest of the region:

Wrong Way: Use the API to fetch Civil Rights scores for each nation in that region one at a time. Wrong because large regions will cause your script to exceed the Rate Limit (and/or be very slow), and because it must re-load the same nations each and every time a user from that region visits your site.

Right Way: Use Daily Dumps to build region-wide Civil Rights stats in advance, then use the API only to gather data from the user's nation. Alternately, use the Region API "censuscore" shard to request a single region-wide Civil Rights average.

The Daily Data Dumps are only updated once every 24 hours, and scripts should not download them more frequently.

If you must use the API for scraping historical data that isn't contained in Daily Dumps, please do so at a rate well below the maximum, e.g. 1 request per second. Please also respect copyright.

Terms of Use
Generally, you can use the API however you like, and if you try to do something that isn't allowed, your request will simply be denied. For example, there's no punishment for exceeding the rate limit; it simply won't work.

There are, however, a few basic rules you must follow, or we may remove your access to the API or the site in general.

Set a User Agent
You must set your script's UserAgent to something informative, such as the URL of your site or your e-mail address. It can be whatever you want, so long as it allows us to contact you if something goes wrong with your script. If you don't set a UserAgent, you will receive response status 403 "Forbidden" and some explanatory text.

Check your UserAgent here.

Do Not Sneakily Exceed Rate Limits
You must not deliberately attempt to avoid being rate-limited, e.g. by splitting your API requests across different IP addresses so that they appear to come from different people, or using puppet nations to obtain multiple Telegrams API Client Keys in order to send telegrams faster.

Be Transparent
You must not present deceptive or misleading information, e.g. spoofing an IP address, setting a misleading User Agent, obtaining an API Client Key under false pretenses.

API Versions
From time to time, the API may be updated to include new data or change format. If your scripts will regularly contact the server and might stop working when confronted with an unexpected new format, you can make them request a particular API version number. You do this by appending &v=1 to your request, replacing "1" with whichever version number you want.

For example, if the current API version when you write your script is 2, you can send requests like this:

https://www.nationstates.net/cgi-bin/api.cgi?nation=testlandia&v=2

... or this (using shards):

https://www.nationstates.net/cgi-bin/api.cgi?nation=testlandia&q=motto+animal+currency&v=2

... and if the API later changes to version 3, your scripts will continue to receive data in the unchanged version 2 format. This allows you to decide whether the new API version is worth upgrading to, and whether it will break anything, at your leisure.

Check the current API Version here.

If you omit the v parameter, you receive the most recent version of the API.

Note: The Daily Data Dumps are always compiled in the current API version—there is no way to retrieve a Data Dump in an older API version format, sorry. If you use Data Dumps, in order to prevent breakage your script should inspect the version number at the top of the XML file (e.g.: <NATIONS api_version="2">) and abort if it is different than you expect.

NationStates supports the two most recent API versions. Older versions may stop working without notice. For example, if the current API version is 6, then versions 5 and 6 are supported, but versions 1-4 are no longer maintained. You may find that an unsupported API version will suddently default to the most recent API version instead. Historically, each API version has remained current for 6-12 months.

Help
Discussion about the API and related tools takes place in the Technical Forum. There is some historical information you may find helpful in this thread.

Examples & Wrappers
Projects
Some notable sites and projects that use the NationStates API:

NSEconomy: an economic statistics calculator

NSDossier: a comprehensive suite of history tracking and calculator tools

NationStates++: a browser plug-in for enhanced functionality

Stately: an Android app

NSDroid: an Android app

Wrappers
These are unofficial libraries and wrappers that make it easier to access the API, since they take care of the details of making a connection and parsing results.

Node node-nsapi by Auralia

Java Agadar's Java Wrapper for the NationStates API • GitHub

Java NS-API by Laevendell and Afforess • Google Code (Laevendell version) • GitHub (Afforess version)

Python pyNationStates by The United Island Tribes • GitHub

Haskell NationStates for Haskell by The Vines • Hackage • GitHub • Docs

Simple Examples
How to connect directly to the API and fetch data.

Perl Example script by Unibot II

PHP Example script by Scoochi2

PHP Example script by Glen-Rhodes using SimpleXML

Visual Basic .NET Example script by Fischistan

LUA Example sScript by GraySoap