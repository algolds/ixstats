/**
 * jsdom's test environment has no TextEncoder/TextDecoder, which jsdom itself (whatwg-url) needs when a test that
 * renders components also builds a JSDOM of its own. Import this first: it installs Node's.
 */
import { TextDecoder, TextEncoder } from "node:util";

Object.assign(globalThis, { TextDecoder, TextEncoder });
