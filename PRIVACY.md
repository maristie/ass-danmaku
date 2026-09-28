# Privacy policy

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
