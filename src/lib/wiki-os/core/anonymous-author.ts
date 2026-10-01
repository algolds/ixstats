/**
 * anonymous-author.ts — telling the name of an anonymous editor from an account's.
 *
 * MediaWiki names an editor who was not logged in by their IP address.
 */

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
/** At least two colons, hex digits and (for a mapped IPv4 tail) dots only. */
const IPV6 = /^(?=(?:[^:]*:){2})[0-9a-f:.]+$/i;

/** Whether `name` is an IP address: MediaWiki's name for an editor who was not logged in. */
export function isAnonymousAuthor(name: string): boolean {
  return IPV4.test(name) || IPV6.test(name);
}
