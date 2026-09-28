# AMO reviewer notes

ASS Danmaku Continued is an independent continuation of the original public ASS Danmaku add-on.

## What the add-on does

ASS Danmaku Continued reads selected page metadata and comment responses from AcFun, bilibili, Gamer.com.tw, and Niconico. It parses comments locally and creates an `.ass` subtitle when the user chooses a stream to download. It does not contact project-operated services or send extension data to the maintainer.

## How to review

1. Open a playable video with comments enabled on a supported site.
2. Wait for comment requests to load. On bilibili, expand the danmaku list first.
3. Open the extension button, select a stream, and download it.
4. Confirm the `.ass` file contains the loaded comments.

On Gamer.com.tw, the add-on removes the `limit` parameter from matching `api.gamer.com.tw/anime/v1/danmu.php` requests. Other captured response data is forwarded unchanged.

## Permission rationale

- `webRequest` and `webRequestBlocking`: observe supported-site metadata/comment endpoints and remove Gamer's `limit` parameter.
- Supported-site host permissions: scope listeners to AcFun, bilibili, Gamer.com.tw, and Niconico.
- `tabs`: associate captured data with its tab, read the page title for file naming, and clear stale data after navigation. The current navigation URL stays in memory.
- `downloads`: save the locally generated subtitle.
- `storage`: save display preferences through `browser.storage.sync`.

AcFun's two matching comment endpoints expose form fields used to associate responses with a video. These fields and comments are processed locally. Firefox may sync display settings when Firefox Sync is enabled; extension data is not sent to project-operated services.

## Source and third-party code

Readable runtime files are under `extension/`; there is no project-specific bundling or minification. The only bundled minified dependency is Mapbox Pbf 3.0.5, licensed under BSD 3-Clause (`extension/lib/pbf@3.0.5/LICENSE`). The bundled file is byte-for-byte identical to `package/dist/pbf.js` from the official [pbf@3.0.5 npm release](https://registry.npmjs.org/pbf/-/pbf-3.0.5.tgz), SHA-256 `bf45b17ab66d67a005eff1623279496cfcc74454a6f8a9b68cf86fe116152346`. Its readable [upstream source](https://github.com/mapbox/pbf/blob/v3.0.5/index.js) and [build metadata](https://github.com/mapbox/pbf/blob/v3.0.5/package.json) are available at the matching release tag. Generated protobuf readers are readable in `extension/background/bilibili.js` and `extension/danmaku/parser.js`.
