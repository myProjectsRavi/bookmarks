## 2026-01-14 - [High] JSON Import XSS Vulnerability
**Vulnerability:** The bookmark import functionality (JSON format) lacked URL validation, allowing `javascript:` and `data:` protocols to be imported as valid bookmarks.
**Learning:** Parsing JSON directly into internal data structures without validation is a common source of Stored XSS, even in "safe" environments like React (as hrefs are often unmonitored).
**Prevention:** Implement strict schema validation and protocol whitelisting (http/https) at the ingress point (import functions) before data enters the application state.
