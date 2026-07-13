; (function () {

  const getPageTitle = async tabId => (await browser.tabs.get(tabId)).title;

  const getDanmakuName = function (pageContext, cid) {
    return async () => {
      const cidTitle = pageContext.metaInfo.cidTitle;
      let title = cidTitle && cidTitle.get(`${cid}`);
      if (typeof title === 'function') title = title();
      title = await (title || getPageTitle(pageContext.tabId));
      return 'B' + cid + (title ? ' - ' + title : '');
    };
  };

  const longestCoveredRange = function (ranges) {
    const sorted = ranges.slice().sort(([x], [y]) => x - y);
    let longest = 0;
    let start = null;
    let end = null;
    sorted.forEach(([rangeStart, rangeEnd]) => {
      if (end === null || rangeStart > end) {
        start = rangeStart;
        end = rangeEnd;
      } else {
        end = Math.max(end, rangeEnd);
      }
      longest = Math.max(longest, end - start);
    });
    return longest;
  };

  const updateCoveredSegments = function (item) {
    if (!item.pageSize || !item.segmentCoverage) return;
    item.segmentCoverage.forEach((ranges, segmentIndex) => {
      let required = item.pageSize;
      if (+segmentIndex === item.total && item.durationMs) {
        const remaining = item.durationMs - (item.total - 1) * item.pageSize;
        if (remaining > 0) required = Math.min(required, remaining);
      }
      if (longestCoveredRange(ranges) >= required) item.receivedSegments.add(segmentIndex);
    });
  };

  const isComplete = function (item) {
    if (!(item.total > 0) || item.content.length === 0) return false;
    for (let segmentIndex = 1; segmentIndex <= item.total; segmentIndex++) {
      if (!item.receivedSegments.has(`${segmentIndex}`)) return false;
    }
    return true;
  };

  /**
   * @param {{ total: number, receivedSegments: Set<string>, content: Object[] }[]} pendingList
   */
  const checkFinish = function (pendingList) {
    const finished = [];
    for (let i = 0; i < pendingList.length;) {
      const item = pendingList[i];
      if (isComplete(item)) {
        finished.push(...pendingList.splice(i, 1));
      } else {
        i++;
      }
    }
    return finished;
  };

  const updateDurations = function (pageContext, pages) {
    const cidDuration = pageContext.metaInfo.cidDuration = pageContext.metaInfo.cidDuration || new Map();
    pages.forEach(({ cid, duration }) => {
      if (duration > 0) cidDuration.set(`${cid}`, duration * 1000);
    });
    const pendingList = pageContext.pendingList = pageContext.pendingList || [];
    pendingList.forEach(item => {
      item.durationMs = cidDuration.get(item.cid) || item.durationMs;
      updateCoveredSegments(item);
    });
    const danmakuList = pageContext.danmakuList = pageContext.danmakuList || [];
    danmakuList.push(...checkFinish(pendingList));
  };

  window.onRequest(['https://api.bilibili.com/x/player/pagelist?*'], function (response, pageContext) {
    const { data } = JSON.parse(new TextDecoder('utf-8').decode(response));
    const { tabId } = pageContext;
    const cidTitle = pageContext.metaInfo.cidTitle = pageContext.metaInfo.cidTitle || new Map();
    data.forEach(({ cid, part }) => {
      const cidKey = `${cid}`;
      cidTitle.set(cidKey, async () => {
        const title = await getPageTitle(tabId);
        const aidTitle = title.replace(/_.*$/, '');
        const partTitle = part ? ' - ' + part : '';
        return aidTitle + partTitle;
      });
    });
    updateDurations(pageContext, data);
  });

  window.onRequest([
    'https://api.bilibili.com/x/web-interface/view?*',
    'https://api.bilibili.com/x/web-interface/wbi/view?*',
  ], function (response, pageContext) {
    const { data } = JSON.parse(new TextDecoder('utf-8').decode(response));
    if (!data || !Array.isArray(data.pages)) return;
    const cidTitle = pageContext.metaInfo.cidTitle = pageContext.metaInfo.cidTitle || new Map();
    data.pages.forEach(({ cid, part }) => {
      const partTitle = data.pages.length > 1 && part ? ' - ' + part : '';
      cidTitle.set(`${cid}`, Promise.resolve(data.title + partTitle));
    });
    updateDurations(pageContext, data.pages);
  });

  window.onRequest([
    'https://comment.bilibili.com/*.xml',
    'https://api.bilibili.com/x/v1/dm/list.so?oid=*',
  ], async function (response, pageContext, { url }) {
    const { cid, danmaku } = window.danmaku.parser.bilibili_xml(response);
    if (danmaku.length === 0) return;
    const name = getDanmakuName(pageContext, cid);
    const danmakuList = pageContext.danmakuList = pageContext.danmakuList || [];
    danmakuList.push({
      id: `bilibili-${cid}`,
      meta: { name, url },
      content: danmaku,
    });
  });

  window.onRequest([
    'https://api.bilibili.com/x/v2/dm/web/seg.so?*',
    'https://api.bilibili.com/x/v2/dm/wbi/web/seg.so?*',
  ], async function (response, pageContext, { url }) {
    const params = new URL(url).searchParams;
    const cid = params.get('oid');
    const segmentIndex = params.get('segment_index');
    const { danmaku } = window.danmaku.parser.bilibili(response);
    const name = getDanmakuName(pageContext, cid);
    const pendingList = pageContext.pendingList = pageContext.pendingList || [];
    const danmakuList = pageContext.danmakuList = pageContext.danmakuList || [];
    const id = `bilibili-pb-${cid}`;
    let danmakuItem = pendingList.find(item => item.id === id) || danmakuList.find(item => item.id === id);
    if (!danmakuItem) {
      danmakuItem = {
        id,
        cid,
        meta: { name, url: [] },
        content: [],
        danmakuIds: new Set(),
        receivedSegments: new Set(),
        segmentCoverage: new Map(),
      };
      pendingList.push(danmakuItem);
    }
    danmakuItem.meta = danmakuItem.meta || { name, url: [] };
    danmakuItem.meta.url = danmakuItem.meta.url || [];
    if (!danmakuItem.meta.url.includes(url)) danmakuItem.meta.url.push(url);
    if (!danmakuItem.danmakuIds) {
      const ids = danmakuItem.content.map(item => item.danmakuId).filter(danmakuId => danmakuId);
      danmakuItem.danmakuIds = new Set(ids);
    }
    danmakuItem.receivedSegments = danmakuItem.receivedSegments || new Set();
    danmakuItem.segmentCoverage = danmakuItem.segmentCoverage || new Map();
    const cidDuration = pageContext.metaInfo.cidDuration;
    danmakuItem.durationMs = cidDuration && cidDuration.get(cid) || danmakuItem.durationMs;
    danmakuItem.content.push(...danmaku.filter(item => {
      if (!item.danmakuId) return true;
      if (danmakuItem.danmakuIds.has(item.danmakuId)) return false;
      danmakuItem.danmakuIds.add(item.danmakuId);
      return true;
    }));
    if (segmentIndex && params.get('pull_mode') === '1') {
      // The current player splits segment 1 into 0-2 and 2-6 minute ranges.
      // Treat it as received only after those ranges cover the segment.
      const start = +params.get('ps');
      const end = +params.get('pe');
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        const ranges = danmakuItem.segmentCoverage.get(segmentIndex) || [];
        ranges.push([start, end]);
        danmakuItem.segmentCoverage.set(segmentIndex, ranges);
        updateCoveredSegments(danmakuItem);
      }
    } else if (segmentIndex) {
      danmakuItem.receivedSegments.add(segmentIndex);
    }
    danmakuList.push(...checkFinish(pendingList));
  });

  window.onRequest(['https://api.bilibili.com/x/v2/dm/web/view?*'], async function (response, pageContext, { url }) {
    const cid = new URL(url).searchParams.get('oid');
    const PbfTypes = function PbfTypes() {
      'use strict';
      const self = this;
      /*
       message DmWebViewReply {
         required DmSegConfig dmSge = 4;
       }

       message DmSegConfig {
         required int64 pageSize = 1;
         required int64 total = 2;
       }
       */
      /* eslint-disable */
      'use strict'; // code generated by pbf v3.2.1

      // DmWebViewReply ========================================

      var DmWebViewReply = self.DmWebViewReply = {};

      DmWebViewReply.read = function (pbf, end) {
        return pbf.readFields(DmWebViewReply._readField, { dmSeg: null }, end);
      };
      DmWebViewReply._readField = function (tag, obj, pbf) {
        if (tag === 4) obj.dmSeg = DmSegConfig.read(pbf, pbf.readVarint() + pbf.pos);
      };
      DmWebViewReply.write = function (obj, pbf) {
        if (obj.dmSeg) pbf.writeMessage(4, DmSegConfig.write, obj.dmSeg);
      };

      // DmSegConfig ========================================

      var DmSegConfig = self.DmSegConfig = {};

      DmSegConfig.read = function (pbf, end) {
        return pbf.readFields(DmSegConfig._readField, { pageSize: 0, total: 0 }, end);
      };
      DmSegConfig._readField = function (tag, obj, pbf) {
        if (tag === 1) obj.pageSize = pbf.readVarint(true);
        else if (tag === 2) obj.total = pbf.readVarint(true);
      };
      DmSegConfig.write = function (obj, pbf) {
        if (obj.pageSize) pbf.writeVarintField(1, obj.pageSize);
        if (obj.total) pbf.writeVarintField(2, obj.total);
      };
      /* eslint-enable */
    };
    const types = new PbfTypes();

    /* global Pbf */
    const pbf = new Pbf(new Uint8Array(response));
    const data = types.DmWebViewReply.read(pbf);
    const { pageSize, total: dmSegTotal } = data.dmSeg;
    const pendingList = pageContext.pendingList = pageContext.pendingList || [];
    const danmakuList = pageContext.danmakuList = pageContext.danmakuList || [];
    const id = `bilibili-pb-${cid}`;
    let danmakuItem = pendingList.find(item => item.id === id) || danmakuList.find(item => item.id === id);
    if (!danmakuItem) {
      danmakuItem = {
        id,
        cid,
        pageSize,
        total: dmSegTotal,
        content: [],
        danmakuIds: new Set(),
        receivedSegments: new Set(),
        segmentCoverage: new Map(),
      };
      pendingList.push(danmakuItem);
    } else {
      danmakuItem.pageSize = pageSize;
      danmakuItem.total = dmSegTotal;
    }
    danmakuItem.segmentCoverage = danmakuItem.segmentCoverage || new Map();
    const cidDuration = pageContext.metaInfo.cidDuration;
    danmakuItem.durationMs = cidDuration && cidDuration.get(cid) || danmakuItem.durationMs;
    updateCoveredSegments(danmakuItem);
    danmakuList.push(...checkFinish(pendingList));
  });

}());
