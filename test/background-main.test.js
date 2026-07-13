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

const createHarness = ({ deferTabLookup = false } = {}) => {
  const requestListeners = [];
  const responseFilters = new Map();
  const shownTabs = [];
  const visibleTabs = new Set();
  const pendingTabLookups = [];
  let onMessage;
  let onRemoved;
  let onUpdated;

  const browser = {
    pageAction: {
      hide: tabId => visibleTabs.delete(tabId),
      show: tabId => {
        shownTabs.push(tabId);
        visibleTabs.add(tabId);
      },
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
      get: tabId => {
        if (!deferTabLookup) return Promise.resolve({ id: tabId });
        return new Promise(resolve => pendingTabLookups.push(() => resolve({ id: tabId })));
      },
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

  const startRequest = (listener, requestId, tabId = 1, detailsOverrides = {}) => {
    const details = Object.assign({
      requestId,
      tabId,
      type: 'xmlhttprequest',
      url: 'https://comments.example/threads',
    }, detailsOverrides);
    listener(details);
    return responseFilters.get(details.requestId);
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
    resolveTabLookups: async () => {
      pendingTabLookups.splice(0).forEach(resolve => resolve());
      await new Promise(resolve => setImmediate(resolve));
    },
    shownTabs,
    startRequest,
    visibleTabs,
  };
};

const nicoSeriesSourceUrl = 'https://www.nicovideo.jp/watch/so46251775';
const nicoSeriesTargetUrl = (
  'https://www.nicovideo.jp/watch/so46304206?' +
  'playlist=eyJ0eXBlIjoic2VyaWVzIiwiY29udGV4dCI6eyJzZXJpZXNJZCI6NTQ1NTA3fX0&' +
  'transition_type=series&transition_id=545507&rf=nvpc&rp=watch&ra=series&rd=next'
);
const nicoSeriesCanonicalUrl = 'https://www.nicovideo.jp/watch/so46304206';

test('comment preflight responses are not parsed', () => {
  const harness = createHarness();
  const commentRequest = harness.registerCommentRequest(() => {
    assert.fail('preflight response callback should not run');
  });

  const responseFilter = harness.startRequest(
    commentRequest,
    'comments-preflight',
    14,
    { method: 'OPTIONS' },
  );
  assert.equal(responseFilter, undefined);
});

test('NicoVideo series navigation survives canonical URL cleanup', async () => {
  const harness = createHarness();
  const tabId = 14;
  const commentRequest = harness.registerCommentRequest(async (response, pageContext, details) => {
    pageContext.danmakuList.push({ id: details.requestId });
  });

  harness.mainFrameRequest({
    requestId: 'source-navigation',
    tabId,
    type: 'main_frame',
    url: nicoSeriesSourceUrl,
  });
  harness.onUpdated(tabId, { url: nicoSeriesSourceUrl, status: 'complete' });
  const sourceFilter = harness.startRequest(
    commentRequest,
    'source-comments',
    tabId,
    { documentUrl: nicoSeriesSourceUrl, frameId: 0 },
  );
  await harness.finishRequest(sourceFilter);
  assert.equal(harness.visibleTabs.has(tabId), true);

  // NicoVideo commits the playlist URL before it replaces it with the
  // canonical watch URL. The intervening request still belongs to this video.
  harness.onUpdated(tabId, { url: nicoSeriesTargetUrl });
  const destinationFilter = harness.startRequest(
    commentRequest,
    'destination-comments',
    tabId,
    // Firefox keeps reporting the source document URL for NicoVideo's SPA
    // requests even after tabs.onUpdated has announced the destination URL.
    { documentUrl: nicoSeriesSourceUrl, frameId: 0 },
  );
  harness.onUpdated(tabId, { url: nicoSeriesCanonicalUrl });
  await harness.finishRequest(destinationFilter);

  const danmaku = await harness.onMessage({ method: 'listDanmaku', params: [tabId] });
  assert.equal(danmaku.length, 1);
  assert.equal(danmaku[0].id, 'destination-comments');
  assert.equal(harness.visibleTabs.has(tabId), true);
});

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
    url: 'https://www.nicovideo.jp/watch/so42562482?from=nanime_jujutsukaisen2_chvideo',
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

test('the first URL update is adopted when the main-frame tab ID was unavailable', async () => {
  const harness = createHarness();
  const tabId = 13;
  const commentRequest = harness.registerCommentRequest(async (response, pageContext) => {
    pageContext.danmakuList.push({ id: 'episode-comments' });
  });

  harness.mainFrameRequest({
    requestId: 'navigation-1',
    tabId: -1,
    type: 'main_frame',
    url: 'https://www.nicovideo.jp/watch/so42562482?from=nanime_jujutsukaisen2_chvideo',
  });
  harness.onUpdated(tabId, { status: 'loading' });
  const responseFilter = harness.startRequest(commentRequest, 'comments-1', tabId);

  harness.onUpdated(tabId, { url: 'https://www.nicovideo.jp/watch/so42562482' });
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

test('a same-document URL update after complete preserves the context', async () => {
  const harness = createHarness();
  const tabId = 11;
  const commentRequest = harness.registerCommentRequest(async (response, pageContext) => {
    pageContext.danmakuList.push({ id: 'episode-comments' });
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

  harness.onUpdated(tabId, { url: `${url}#player` });
  await harness.finishRequest(responseFilter);

  assert.deepEqual(harness.shownTabs, [tabId]);
  const danmaku = await harness.onMessage({ method: 'listDanmaku', params: [tabId] });
  assert.equal(danmaku.length, 1);
  assert.equal(danmaku[0].id, 'episode-comments');
});

test('a delayed hide cannot override a successful response', async () => {
  const harness = createHarness({ deferTabLookup: true });
  const tabId = 12;
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
  await harness.finishRequest(responseFilter);

  assert.equal(harness.visibleTabs.has(tabId), true);
  await harness.resolveTabLookups();
  assert.equal(harness.visibleTabs.has(tabId), true);
});
