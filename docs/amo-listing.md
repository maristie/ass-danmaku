# AMO public listing draft

## Listing fields

**Name**
- `en-US`: ASS Danmaku Continued
- `zh-CN`: ASS 弹幕（延续版）
- `zh-TW`: ASS 彈幕（延續版）

**Summary**
Download danmaku comments from AcFun, bilibili, Gamer.com.tw, and Niconico as ASS subtitle files.

- `zh-CN`: 从 AcFun、bilibili、Gamer.com.tw 和 Niconico 下载弹幕并保存为 ASS 字幕。
- `zh-TW`: 從 AcFun、bilibili、Gamer.com.tw 和 Niconico 下載彈幕並儲存為 ASS 字幕。

**Description**

Download danmaku (scrolling video comments) from supported video sites and convert it locally into an Advanced SubStation Alpha (`.ass`) subtitle file.

Open a supported video, wait for comments to load, then use the extension button to choose a comment stream and download it. On bilibili, expand the danmaku list before downloading so its comment segments load.

Supported sites: AcFun, bilibili, `Gamer.com.tw`, and Niconico.

On `Gamer.com.tw`, the extension removes the `limit` query parameter from matching comment API requests, requesting comments without the page's explicit limit. Comment data and video details are processed in the browser. The extension has no analytics or telemetry and does not send browsing data, comments, or generated files to project servers. Display settings use Firefox's `browser.storage.sync` and may sync if Firefox Sync is enabled.

This is an independent, community-maintained continuation of the original [ASS Danmaku add-on](https://addons.mozilla.org/en-US/firefox/addon/ass-danmaku/). It has a separate add-on identity and is not affiliated with or endorsed by the original author. Settings from the original add-on are not transferred automatically.

For support and issue reports, use the project's [GitHub issue tracker](https://github.com/maristie/ass-danmaku/issues).

**Categories**
Photos, Music & Videos; Download Management

AMO category slugs: `photos-music-videos`, `download-management`.

**AMO icon**

The 128×128 listing icon published on AMO is [`amo-icon.png`](amo-icon.png), generated from [`amo-icon.svg`](amo-icon.svg). This listing artwork is separate from the extension icons in `extension/manifest.json`; AMO does not use those manifest icons as the listing icon.

**Homepage / source**
https://github.com/maristie/ass-danmaku

**Support website**
https://github.com/maristie/ass-danmaku/issues

**Privacy policy**

Last updated: September 27, 2026

ASS Danmaku Continued processes video and danmaku information from supported sites to create an `.ass` subtitle file when you choose to download one.

## Information processed

The extension checks tab URL changes to clear comments during navigation. The current navigation URL, supported-page metadata, matching comment API URLs, captured comments, and related information are kept in extension memory for the current tab and used to create the file you request. This information is not sent to the project maintainer. On AcFun, the extension also reads form fields from matching comment requests to associate responses with the video. It may read the page title to name the downloaded file.

On `Gamer.com.tw`, the extension removes the `limit` query parameter from matching comment API requests before they reach Gamer's server. Other captured response data is forwarded unchanged.

The generated subtitle is saved through Firefox's downloads feature. The extension does not upload comments, browsing history, page titles, or generated files to the project maintainer. It has no analytics or telemetry service.

## Settings and Firefox Sync

Display preferences are stored with Firefox's `browser.storage.sync` API. If Firefox Sync is enabled for extensions/settings, Firefox may synchronize those preferences across your devices. These preferences are not sent to a project-operated server. You can manage Firefox Sync through Firefox's account and Sync settings.

## Contact

For privacy questions, use the project's [GitHub issue tracker](https://github.com/maristie/ass-danmaku/issues). Do not include personal information in a public issue.

Hosted copy: https://github.com/maristie/ass-danmaku/blob/master/PRIVACY.md

**License**
Mozilla Public License 2.0. The bundled Pbf library has its own BSD 3-Clause license, included with the extension.
