'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const backgroundSource = name => fs.readFileSync(
  path.join(__dirname, '..', 'extension', 'background', `${name}.js`),
  'utf8',
);

const mainSource = backgroundSource('main');
const niconicoSource = backgroundSource('niconico');
const bilibiliSource = backgroundSource('bilibili');

const settle = async () => {
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
};

const createHarness = siteSource => {
  const requestListeners = [];
  const responseFilters = new Map();
  const tabTitles = new Map();
  const blobUrls = new Map();
  const downloads = [];
  let blobId = 0;
  let onMessage;
  let onUpdated;

  class HarnessURL extends URL {}
  HarnessURL.createObjectURL = blob => {
    const url = `blob:harness-${++blobId}`;
    blobUrls.set(url, blob);
    return url;
  };
  HarnessURL.revokeObjectURL = url => blobUrls.delete(url);

  const browser = {
    pageAction: {
      hide: () => {},
      show: () => {},
    },
    runtime: {
      getManifest: () => ({
        permissions: [
          'tabs',
          '*://*.bilibili.com/*',
          '*://*.nicovideo.jp/*',
        ],
      }),
      onMessage: {
        addListener: listener => { onMessage = listener; },
      },
    },
    tabs: {
      get: tabId => Promise.resolve({ id: tabId, title: tabTitles.get(tabId) }),
      onRemoved: {
        addListener: () => {},
      },
      onUpdated: {
        addListener: listener => { onUpdated = listener; },
      },
    },
    webRequest: {
      filterResponseData: requestId => {
        const filter = {
          disconnect: () => {},
          write: () => {},
        };
        responseFilters.set(requestId, filter);
        return filter;
      },
      onBeforeRequest: {
        addListener: (listener, filter, extraInfoSpec) => {
          requestListeners.push({ listener, filter, extraInfoSpec });
        },
      },
    },
  };

  const globals = {
    browser,
    TextDecoder,
    URL: HarnessURL,
    danmaku: {
      ass: danmaku => `Title: ${danmaku.meta.name}`,
      layout: async content => content,
      parser: {
        bilibili_xml: () => ({
          cid: 42,
          danmaku: [{ id: 'bilibili-comment' }],
        }),
        niconico: () => ({
          thread: 'thread-1',
          danmaku: [{ id: 'niconico-comment' }],
        }),
      },
    },
    download: {
      blob: content => ({ content }),
      download: async (url, filename) => {
        downloads.push({
          content: blobUrls.get(url).content,
          filename,
        });
      },
      filename: (name, extension) => `${name}.${extension}`,
    },
    options: {
      get: async () => ({}),
    },
  };
  globals.window = globals;

  vm.runInNewContext(mainSource, globals, { filename: 'background/main.js' });
  vm.runInNewContext(siteSource, globals, { filename: 'background/site.js' });

  const mainFrameRegistration = requestListeners.find(
    ({ filter }) => filter.types && filter.types.includes('main_frame'),
  );
  assert.ok(mainFrameRegistration, 'main-frame navigation listener is registered');

  const registrationFor = urlPattern => {
    const registration = requestListeners.find(
      ({ filter }) => filter.urls && filter.urls.includes(urlPattern),
    );
    assert.ok(registration, `request listener is registered for ${urlPattern}`);
    return registration;
  };

  const navigate = (tabId, url) => mainFrameRegistration.listener({
    requestId: `navigation-${tabId}`,
    tabId,
    type: 'main_frame',
    url,
  });

  const respond = async (urlPattern, details, bytes = new Uint8Array([1])) => {
    const { listener } = registrationFor(urlPattern);
    listener(details);
    const filter = responseFilters.get(details.requestId);
    assert.ok(filter, `response filter is created for ${details.requestId}`);
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    filter.ondata({ data });
    filter.onstop({});
    await settle();
  };

  const setTitle = (tabId, title, notify = true) => {
    tabTitles.set(tabId, title);
    if (notify) onUpdated(tabId, { title });
  };

  return {
    downloads,
    navigate,
    onMessage: request => onMessage(request),
    respond,
    setTitle,
  };
};

test('NicoVideo uses the latest title when listing and downloading', async () => {
  const harness = createHarness(niconicoSource);
  const tabId = 21;
  harness.setTitle(tabId, 'Title A', false);
  harness.navigate(tabId, 'https://www.nicovideo.jp/watch/sm1');
  await harness.respond(
    '*://public.nvcomment.nicovideo.jp/v1/threads',
    {
      requestId: 'niconico-comments',
      tabId,
      type: 'xmlhttprequest',
      url: 'https://public.nvcomment.nicovideo.jp/v1/threads',
    },
  );

  // A title-only update is not a navigation and must not require a refresh.
  harness.setTitle(tabId, 'Title B');
  const [listed] = await harness.onMessage({ method: 'listDanmaku', params: [tabId] });
  assert.equal(listed.meta.name, 'Nthread-1 - Title B');

  // The title can change again while the popup remains open.
  harness.setTitle(tabId, 'Title C');
  await harness.onMessage({
    method: 'downloadDanmaku',
    params: [tabId, 'niconico-thread-1'],
  });
  assert.equal(harness.downloads.length, 1);
  assert.equal(harness.downloads[0].filename, 'Nthread-1 - Title C.ass');
  assert.equal(harness.downloads[0].content, 'Title: Nthread-1 - Title C');
});

test('Bilibili pagelist fallback does not freeze an earlier tab title', async () => {
  const harness = createHarness(bilibiliSource);
  const tabId = 22;
  harness.setTitle(tabId, 'Title A_bilibili', false);
  harness.navigate(tabId, 'https://www.bilibili.com/video/BV1');

  const pagelist = new TextEncoder().encode(JSON.stringify({
    data: [{ cid: 42, duration: 60, part: 'Part 1' }],
  }));
  await harness.respond(
    'https://api.bilibili.com/x/player/pagelist?*',
    {
      requestId: 'bilibili-pagelist',
      tabId,
      type: 'xmlhttprequest',
      url: 'https://api.bilibili.com/x/player/pagelist?bvid=BV1',
    },
    pagelist,
  );

  harness.setTitle(tabId, 'Title B_bilibili');
  await harness.respond(
    'https://comment.bilibili.com/*.xml',
    {
      requestId: 'bilibili-comments',
      tabId,
      type: 'xmlhttprequest',
      url: 'https://comment.bilibili.com/42.xml',
    },
  );

  const [listed] = await harness.onMessage({ method: 'listDanmaku', params: [tabId] });
  assert.equal(listed.meta.name, 'B42 - Title B - Part 1');
});
