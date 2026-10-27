// Plan 415 (COMPAT-10), in a browser-like environment (Jest's jsdom window): the article sanitizer's own
// DOMPurify instance is created on that window, apart from the shared one the other sanitizers use.
import { describeArticleSanitizerParity } from "./article-sanitizer-cases";

describeArticleSanitizerParity();
