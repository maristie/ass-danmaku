# ASS Danmaku Continued

An independent, community-maintained continuation of the Firefox extension originally published as [ASS Danmaku on Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/ass-danmaku/). This continuation has its own add-on identity and repository. It is not affiliated with or endorsed by the original author. The linked AMO page is for the original add-on, not this continuation.

Because it uses a separate Firefox add-on ID, installing this continuation does not replace the original add-on or transfer its settings. Configure the continuation once in its options.

The extension downloads danmaku (scrolling video comments) from supported video pages and converts it locally into an Advanced SubStation Alpha (`.ass`) subtitle file.

## Supported sites

- AcFun
- bilibili
- Gamer.com.tw
- Niconico

Open a supported video and wait for its comments to load. Use the extension button to choose a comment stream and download it. On bilibili, expand the danmaku list first so its comment segments load.

## Privacy and permissions

See the full [privacy policy](PRIVACY.md).

The extension checks tab URL changes to clear stale comments during navigation. The current navigation URL and captured data are held in memory with the current tab and used to create the file you request; they are not sent to the project maintainer. It reads matching page and comment API responses to extract comments and video details. On AcFun, it also reads form fields from matching comment requests to associate responses with the correct video.

On Gamer.com.tw, the extension removes the `limit` query parameter from matching comment API requests before sending them to Gamer's server, requesting comments without the page's explicit limit. Other captured responses are forwarded unchanged. The extension does not send browsing data, comments, or generated files to the project maintainer, and it has no analytics or telemetry service.

Display settings are saved with Firefox's `browser.storage.sync` API. Firefox may synchronize these settings if Firefox Sync is enabled. The extension does not send settings to project servers.

The manifest requests access to the supported services, tab information for associating comments and page titles with a tab, downloads access to save the generated file, and storage access for display settings.

## Development

Load `extension/manifest.json` as a temporary add-on in Firefox's `about:debugging` page. AMO release text and reviewer materials are in [`docs/amo-listing.md`](docs/amo-listing.md), [`docs/amo-reviewer-notes.md`](docs/amo-reviewer-notes.md), and [`docs/amo-source-build.md`](docs/amo-source-build.md).

## Credits and licenses

The extension source is licensed under the [Mozilla Public License 2.0](LICENSE). It includes Mapbox's [Pbf](https://github.com/mapbox/pbf) library, version 3.0.5, under the BSD 3-Clause License; see [`extension/lib/pbf@3.0.5/LICENSE`](extension/lib/pbf@3.0.5/LICENSE).
