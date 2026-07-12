'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const mainSource = fs.readFileSync(
  path.join(__dirname, '..', 'extension', 'background', 'main.js'),
  'utf8',
);

const createHarness = () => {
  const requestListeners = [];
  const responseFilters = new Map();
  const shownTabs = [];
  let onMessage;
  let onRemoved;
  let onUpdated;

  const browser = {
    pageAction: {
      hide: () => {},
      show: tabId => shownTabs.push(tabId),
    },
    runtime: {
      getManifest: () => ({
        permissions: [
          'tabs',
          '*://*.nicovideo.jp/*',
        ],
      }),
      onMessage: {
        addListener: listener => { onMessage = listener; },
      },
    },
    tabs: {
      get: tabId => Promise.resolve({ id: tabId }),
      onRemoved: {
        addListener: listener => { onRemoved = listener; },
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
  const globals = { browser, URL };
  globals.window = globals;
  vm.runInNewContext(mainSource, globals, { filename: 'background/main.js' });

  const mainFrameRegistration = requestListeners.find(
    ({ filter }) => filter.types && filter.types.includes('main_frame'),
  );

  assert.ok(mainFrameRegistration, 'main-frame navigation listener is registered');

  const registerCommentRequest = callback => {
    globals.onRequest(['https://comments.example/*'], callback);
    return requestListeners.at(-1).listener;
  };

  const startRequest = (listener, requestId, tabId = 1) => {
    listener({
      requestId,
      tabId,
      type: 'xmlhttprequest',
      url: 'https://comments.example/threads',
    });
    return responseFilters.get(requestId);
  };

  const finishRequest = async filter => {
    filter.ondata({ data: new Uint8Array([1, 2, 3]).buffer });
    filter.onstop({});
    await new Promise(resolve => setImmediate(resolve));
  };

  return {
    finishRequest,
    mainFrameRequest: mainFrameRegistration.listener,
    onMessage: (...args) => onMessage(...args),
    onRemoved: (...args) => onRemoved(...args),
    onUpdated: (...args) => onUpdated(...args),
    registerCommentRequest,
    shownTabs,
    startRequest,
  };
};

test('duplicate tab updates do not replace a main-frame navigation context', async () => {
  const harness = createHarness();
  const tabId = 7;
  const commentRequest = harness.registerCommentRequest(async (response, pageContext) => {
    pageContext.danmakuList.push({ id: 'episode-comments' });
  });

  harness.mainFrameRequest({
    requestId: 'navigation-1',
    tabId,
    type: 'main_frame',
    url: 'https://www.nicovideo.jp/watch/so42562482',
  });
  const responseFilter = harness.startRequest(commentRequest, 'comments-1', tabId);

  // Firefox can publish both updates for the navigation after subresources
  // have already started. Neither update should invalidate their context.
  harness.onUpdated(tabId, { url: 'https://www.nicovideo.jp/watch/so42562482#player' });
  harness.onUpdated(tabId, { status: 'loading' });
  await harness.finishRequest(responseFilter);

  assert.deepEqual(harness.shownTabs, [tabId]);
  const danmaku = await harness.onMessage({ method: 'listDanmaku', params: [tabId] });
  assert.equal(danmaku.length, 1);
  assert.equal(danmaku[0].id, 'episode-comments');
});

test('a later main-frame navigation still rejects an in-flight response', async () => {
  const harness = createHarness();
  const tabId = 8;
  const commentRequest = harness.registerCommentRequest(async (response, pageContext) => {
    pageContext.danmakuList.push({ id: 'stale-comments' });
  });

  harness.mainFrameRequest({
    requestId: 'navigation-1',
    tabId,
    type: 'main_frame',
    url: 'https://www.nicovideo.jp/watch/first',
  });
  const responseFilter = harness.startRequest(commentRequest, 'comments-1', tabId);

  harness.mainFrameRequest({
    requestId: 'navigation-2',
    tabId,
    type: 'main_frame',
    url: 'https://www.nicovideo.jp/watch/second',
  });
  await harness.finishRequest(responseFilter);

  assert.deepEqual(harness.shownTabs, []);
  const danmaku = await harness.onMessage({ method: 'listDanmaku', params: [tabId] });
  assert.equal(danmaku.length, 0);
});

test('a different URL update during loading replaces the prior context', async () => {
  const harness = createHarness();
  const tabId = 9;
  const commentRequest = harness.registerCommentRequest(async (response, pageContext) => {
    pageContext.danmakuList.push({ id: 'previous-page-comments' });
  });

  harness.mainFrameRequest({
    requestId: 'navigation-1',
    tabId,
    type: 'main_frame',
    url: 'https://www.nicovideo.jp/watch/first',
  });
  const responseFilter = harness.startRequest(commentRequest, 'comments-1', tabId);

  // No main-frame webRequest event is observable for a destination outside
  // the extension's host permissions, so the URL update is the boundary.
  harness.onUpdated(tabId, { url: 'https://unsupported.example/video' });
  harness.onUpdated(tabId, { status: 'loading' });
  await harness.finishRequest(responseFilter);

  assert.deepEqual(harness.shownTabs, []);
  const danmaku = await harness.onMessage({ method: 'listDanmaku', params: [tabId] });
  assert.equal(danmaku.length, 0);
});

test('a URL update after loading completes remains a navigation fallback', async () => {
  const harness = createHarness();
  const tabId = 10;
  const commentRequest = harness.registerCommentRequest(async (response, pageContext) => {
    pageContext.danmakuList.push({ id: 'previous-page-comments' });
  });

  harness.mainFrameRequest({
    requestId: 'navigation-1',
    tabId,
    type: 'main_frame',
    url: 'https://www.nicovideo.jp/watch/first',
  });
  harness.onUpdated(tabId, { status: 'complete' });
  const responseFilter = harness.startRequest(commentRequest, 'comments-1', tabId);

  harness.onUpdated(tabId, { url: 'https://www.nicovideo.jp/watch/second' });
  await harness.finishRequest(responseFilter);

  assert.deepEqual(harness.shownTabs, []);
  const danmaku = await harness.onMessage({ method: 'listDanmaku', params: [tabId] });
  assert.equal(danmaku.length, 0);
});

test('a combined URL and complete update ends the loading cycle', async () => {
  const harness = createHarness();
  const tabId = 11;
  const commentRequest = harness.registerCommentRequest(async (response, pageContext) => {
    pageContext.danmakuList.push({ id: 'stale-comments' });
  });
  const url = 'https://www.nicovideo.jp/watch/first';

  harness.mainFrameRequest({
    requestId: 'navigation-1',
    tabId,
    type: 'main_frame',
    url,
  });
  harness.onUpdated(tabId, { url, status: 'complete' });
  const responseFilter = harness.startRequest(commentRequest, 'comments-1', tabId);

  harness.onUpdated(tabId, { url });
  await harness.finishRequest(responseFilter);

  assert.deepEqual(harness.shownTabs, []);
  const danmaku = await harness.onMessage({ method: 'listDanmaku', params: [tabId] });
  assert.equal(danmaku.length, 0);
});
