---
name: web.search
description: Search the configured RustXNG service while the app is Online.
---

Use only when current external information is needed or the user asks for web research. This sends the search query to the configured RustXNG endpoint. It is unavailable while Offline or when the browser reports no network. Search result snippets are discovery hints. Cite only returned page text whose `rawContentStatus` is `ok`; never treat a snippet as a verified quotation. Do not claim that a page was fully read when its text is truncated. Web search does not save content to Memory.
