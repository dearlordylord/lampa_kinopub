# CDNServices / Kinopub TV: identity and playback protocol

Inspected 2026-10-24 UTC. Public HTML and JavaScript were downloaded as text, not executed or installed. No account was linked or credentials supplied to the inspected service.

## Identity and fork decision

The live site identifies as **Kinopub TV**, a standalone client, not a Lampa plugin. The distributed app embeds package metadata `tv.app`, version `1.2.5`, `license: MIT`, `private: true`. That metadata contains no author or repository. A complete upstream license/source repository was not established. Do not treat a minified deployment as a confirmed forkable source repository.

The [wals09 wrapper manifest](https://raw.githubusercontent.com/wals09/repo/main/kinopub_cdn_sl/kinopub_cdn_sl.manifest.json) is evidence of distribution, not authorship. The wrapper's old `kpms.cc/chat` source link is stale. The live app uses a different support link. Further primary-source attribution notes follow below.

## Playback protocol

Primary executable-code source, inspected as text: [player chunk 4](https://cdnservices.link/static/js/4.dfe3af96.chunk.js), modules 1016 and 1045.

1. API audio metadata is converted to a selectable list. The client's selected position is zero-based, and its legacy HLS selector uses position + 1. This is an observed client convention, not proof that arbitrary API audio arrays can never have reordered entries or gaps. Our existing API audio index is preserved, with array-position fallback only when index is absent.
2. **Legacy `hls`:** changing the selected audio rewrites `master-v1aN` in the source URL. For example `/master-v1a1.m3u8` becomes `/master-v1a2.m3u8` for the second audio. The source is then reloaded, and the playback position is restored after `canplay`. This explicitly requests a single-audio stream rather than assuming native in-stream track switching.
3. **`hls2`:** its audio menu is deliberately empty (`streamingType === hls2` returns an empty list). Treating this as a multi-audio fallback while retaining a Japanese label is incorrect.
4. **`hls4` and other paths:** source URLs are not modified by that legacy rule. With hls.js the client selects `audioTracks[position].id`; with native HTML video it enables the selected audio track and seeks back roughly one second. It also supports a video.js path. Those are distinct playback backends, not extra audio-selection API endpoints.
5. The video starts muted for autoplay, then explicitly unmutes after readiness. This does not itself explain our observed wrong-language fallback.

The app's public [main API chunk](https://cdnservices.link/static/js/main.efaba7e4.chunk.js) exposes standard KinoPub device OAuth, refresh and video endpoints. It has multiple API hostname fallbacks; these domains were not adopted into our allowlist. Auth constants are deliberately omitted here. Deferred media uses `/v1/items/media-links?mid=...` and `/v1/items/media-video-link?file=...&type=...`, consistent with [KinoPub's API documentation](https://kinoapi.com/api_video.html). No distinct legacy audio-selection REST endpoint was found: the important observed selector is in the HLS pathname.

## Independent compatibility fix

Our implementation changes only the basename of a recognized legacy HLS master. It preserves the original host, signed path prefix, query and fragment, and updates every quality URL as well as error-fallback URLs. An explicit single-audio master bypasses native track toggling. No CDNServices application code, API host pool, analytics or remote scripts are installed.

The regression first failed for Japanese URL selection and quality URLs, then passed after the independent helper was added. The real Samsung audio outcome remains unverified until replayed on the TV. This finding does not certify the entire CDNServices application as safe. The live HTML includes Google Analytics.

## Replacement direction

The intended destination is a small standalone KinoPub client launched through MSX, without Lampa or a Lampa source plugin. A blind fork of this deployed build is not currently justified by confirmed source/license provenance. The existing Lampa launcher remains a temporary working route until a replacement is verified; it has not been removed.

## Snapshot hashes

- `index.html`: `5127f0665196e0d5e7df7e02fed6cbdb515f2654106274bad7aa43e4c84551bb`
- `main.efaba7e4.chunk.js`: `c1f5224cea7f974cbbde5ba52ba9d668ab8e19e65d233fb0f5324eab4d9de8f4`
- `4.dfe3af96.chunk.js`: `1ebf236342e57b51b5afc9301ee6e1128886342287c5e9468c27a965e373302b`
- `11.11abf8d6.chunk.js`: `aa2c399d54b78db14031d4bb2c2fdd92d287fe643ad36447a75ffe4cdb08efc4`

## Attribution evidence

# cdnservices.link: identity and attribution evidence

Checked 2026-10-24 UTC. Static reads only; no application execution, login, credential use, joining chats, or posting messages.

## Findings

- The site identifies itself as **Kinopub TV**, and its PWA manifest repeats that name. This is a standalone web application, not evidence of a Lampa plugin. Primary sources: [site](https://cdnservices.link/) and [PWA manifest](https://cdnservices.link/manifest.json).
- Its own shipped `REACT_APP_HELP_ADDITIONAL_INFO` says the application is **not an official KinoPub client**, was developed for personal use without a profit motive, and directs client support to `tg.kprtfm.com`. This is self-description, not independent proof of who operates it. Primary source: [current main JavaScript bundle](https://cdnservices.link/static/js/main.efaba7e4.chunk.js).
- The same bundle embeds package metadata: `name: tv.app`, `version: 1.2.5`, `description: TV App`, `license: MIT`, `private: true`, `main: src/index.tsx`. Parsed data has **no author, repository, or homepage key**. Build script disables source maps. This identifies the application package but not a named author. Primary source: [main bundle](https://cdnservices.link/static/js/main.efaba7e4.chunk.js).
- The MIT field is a package metadata assertion. A request for `/LICENSE` returned the application HTML (SPA fallback), not an MIT license document. No actual author/copyright notice or source repository was established. Do not treat this as verified permission to copy the whole application.
- The current support route [cdnservices.link/chat](https://cdnservices.link/chat) redirects to a Telegram group invitation whose public preview title is **Синемаголики**. The bundle's configured chat URL is [tg.kprtfm.com](https://tg.kprtfm.com/). No named maintainer was exposed by the preview, and the group was not joined.
- `wals09` distributes a webOS wrapper/manifest and an MSX launcher entry for this site. Its [package manifest](https://raw.githubusercontent.com/wals09/repo/main/kinopub_cdn_sl/kinopub_cdn_sl.manifest.json) calls it **Кинопаб CdnSL**, version `1.0.0`, and points to a Dropbox IPK. The separate [package description](https://raw.githubusercontent.com/wals09/repo/main/kinopub_cdn_sl/kinopub_cdn_sl-full_description.html) describes an unofficial client. This is evidence of packaging/distribution, **not authorship of the website**. [MSX menu](https://github.com/wals09/msx/blob/main/menu.json).
- That wrapper's `sourceUrl` is still `https://kpms.cc/chat`. A current read of [kpms.cc/chat](https://kpms.cc/chat) returned a parked-domain page saying the domain may be for sale, rather than the support chat. Treat this old package link as stale.

## Attribution conclusion

Confident: unofficial **Kinopub TV / CdnSL** application; wals09 is a demonstrable distributor of wrappers/launcher entries. **Named author/current operator and a source repository remain unverified.** Do not claim this is an official KinoPub application or a wals09-authored player.

## Local evidence

- `identity-main.js`: current root bundle, SHA-256 `c1f5224cea7f974cbbde5ba52ba9d668ab8e19e65d233fb0f5324eab4d9de8f4`.
- `chat.html`: parked old kpms.cc/chat response.
- `current-chat.html` and `current-chat-headers.txt`: current support redirect and public group-preview metadata.
- `web-manifest.json`, `package-description.html`, `root-license.txt`.

Any embedded OAuth constants in the downloaded bundle are intentionally omitted from these findings.
