; (function () {

  /**
   * @typedef TabId
   * @typedef {{ id: string, meta: Object, content: Object }} DanmakuInfo
   * @typedef {{ tabId: TabId, danmakuList: ?Array.<DanmakuInfo>, metaInfo: Object }} PageContext
   */

  /** @type {Map<TabId, PageContext>} */
  const context = new Map();
  /** @type {Map<string, Function>} */
  const exported = new Map();

  const newPageContext = tabId => ({
    tabId,
    danmakuList: [],
    metaInfo: {},
    loading: false,
  });
  /**
   * Export some function via message post to popup pages
   * @param {Function} f
   * @return {Function}
   */
  const messageExport = f => {
    exported.set(f.name, f);
    return (...args) => Promise.resolve(f(...args));
  };

  const pageContext = tabId => {
    if (!context.has(tabId)) {
      context.set(tabId, newPageContext(tabId));
    }
    const pageContext = context.get(tabId);
    return pageContext;
  };

  /**
   * @callback OnRequestCallback
   * @param {ArrayBuffer} response
   * @param {PageContext} pageContext
   */

  /**
   *
   * @param {Array.<string>} match
   * @param {OnRequestCallback} callback
   */
  const onRequest = function (match, callback, { includeRequestBody = false } = {}) {
    browser.webRequest.onBeforeRequest.addListener(details => {
      const { requestId, tabId, url } = details;
      // Main-frame responses belong to the context created when navigation
      // starts. Subresource responses retain the context that requested them.
      const requestContext = details.type === 'main_frame' ? null : pageContext(tabId);
      const filter = browser.webRequest.filterResponseData(requestId);
      let capacity = 1 << 24; // 16MiB, this should be enough for our use case
      let size = 0;
      let buffer = new ArrayBuffer(capacity);

      filter.ondata = event => {
        const { data } = event;
        filter.write(data);
        if (!buffer) return;
        const length = data.byteLength;
        if (size + length > capacity) {
          buffer = null;
          return;
        }
        const view = new Uint8Array(buffer, size, length);
        view.set(new Uint8Array(data));
        size += length;
      };

      filter.onstop = event => {
        filter.disconnect();
        if (!buffer) return;
        const response = buffer.slice(0, size);
        buffer = null;
        (async () => {
          const responseContext = requestContext || pageContext(tabId);
          await callback(response, responseContext, details);
          if (context.get(tabId) !== responseContext) return;
          if (responseContext.danmakuList.length) browser.pageAction.show(tabId);
        })();
      };
      return {};
    }, { urls: match }, ['blocking'].concat(includeRequestBody ? ['requestBody'] : []));
  };

  const redirect = function(match, { redirector = url => url } = {}) {
    browser.webRequest.onBeforeRequest.addListener(details => {
      const { url } = details;
      return { redirectUrl: redirector(url) };
    }, { urls: match }, ['blocking']);
  };

  const hidePageAction = tabId => {
    browser.tabs.get(tabId).then(() => {
      browser.pageAction.hide(tabId);
    }, () => {});
  };

  const revokePageAction = tabId => {
    context.delete(tabId);
    hidePageAction(tabId);
  };

  const clearPageDanmaku = (tabId, loading = false) => {
    const newContext = newPageContext(tabId);
    newContext.loading = loading;
    context.set(tabId, newContext);
    hidePageAction(tabId);
  };

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.discarded) {
      revokePageAction(tabId);
    } else if (changeInfo.url) {
      clearPageDanmaku(tabId, true);
    } else if (changeInfo.status === 'loading') {
      const currentContext = context.get(tabId);
      if (!currentContext || !currentContext.loading) clearPageDanmaku(tabId, true);
    } else if (changeInfo.status === 'complete') {
      const currentContext = context.get(tabId);
      if (currentContext) currentContext.loading = false;
    }
  });
  browser.tabs.onRemoved.addListener(tabId => {
    revokePageAction(tabId);
  });

  const getDanmakuDetail = function (tabId, danmakuId) {
    const pageContext = context.get(tabId);
    if (!pageContext) return null;
    const list = pageContext.danmakuList || [];
    const danmaku = list.find(({ id }) => id === danmakuId);
    return danmaku;
  };

  const random = () => `${Math.random()}`.slice(2);
  const randomStuff = `danmaku-${Date.now()}-${random()}`;
  const listDanmaku = messageExport(function listDanmaku(tabId) {
    const pageContext = context.get(tabId);
    if (!pageContext) return [];
    const list = pageContext.danmakuList || [];
    return list.map(({ id, meta }) => ({
      id,
      meta,
    }));
  });

  const downloadDanmaku = messageExport(async function downloadDanmaku(tabId, danmakuId) {
    const danmaku = getDanmakuDetail(tabId, danmakuId);
    const [options] = await Promise.all([
      window.options.get(),
    ]);
    danmaku.layout = await window.danmaku.layout(danmaku.content, options);
    const content = window.danmaku.ass(danmaku, options);
    const blob = window.download.blob(content);
    const url = URL.createObjectURL(blob);
    const filename = window.download.filename(danmaku.meta.name, 'ass');
    await window.download.download(url, filename);
    URL.revokeObjectURL(url);
  });

  browser.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    const { method, params = [] } = request;
    const handler = exported.get(method);
    const response = await handler(...params);
    return response;
  });

  window.onRequest = onRequest;
  window.redirect = redirect;

}());
