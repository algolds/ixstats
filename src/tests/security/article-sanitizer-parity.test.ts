/** @jest-environment node */
// Plan 415 (COMPAT-10), on the server: no window, so the module builds its own jsdom window.
import { describeArticleSanitizerParity } from "./article-sanitizer-cases";

describeArticleSanitizerParity();
