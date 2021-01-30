; (function () {

  const parser = (function () {
    /**
     * @typedef DanmakuColor
     * @property {number} r
     * @property {number} g
     * @property {number} b
     */
    /**
     * @typedef Danmaku
     * @property {string} text
     * @property {number} time
     * @property {string} mode
     * @property {number} size
     * @property {DanmakuColor} color
     * @property {boolean} bottom
     */

    const parser = {};

    /**
     * @param {Danmaku} danmaku
     * @returns {boolean}
     */
    const danmakuFilter = danmaku => {
      if (!danmaku) return false;
      if (!danmaku.text) return false;
      if (!danmaku.mode) return false;
      if (!danmaku.size) return false;
      if (danmaku.time < 0 || danmaku.time >= 360000) return false;
      return true;
    };

    const parseRgb256IntegerColor = color => {
      const rgb = parseInt(color, 10);
      const r = (rgb >>> 4) & 0xff;
      const g = (rgb >>> 2) & 0xff;
      const b = (rgb >>> 0) & 0xff;
      return { r, g, b };
    };

    const parseNiconicoColor = mail => {
      const colorTable = {
        red: { r: 255, g: 0, b: 0 },
        pink: { r: 255, g: 128, b: 128 },
        orange: { r: 255, g: 184, b: 0 },
        yellow: { r: 255, g: 255, b: 0 },
        green: { r: 0, g: 255, b: 0 },
        cyan: { r: 0, g: 255, b: 255 },
        blue: { r: 0, g: 0, b: 255 },
        purple: { r: 184, g: 0, b: 255 },
        black: { r: 0, g: 0, b: 0 },
      };
      const defaultColor = { r: 255, g: 255, b: 255 };
      const line = mail.toLowerCase().split(/\s+/);
      const color = Object.keys(colorTable).find(color => line.includes(color));
      return color ? colorTable[color] : defaultColor;
    };

    const parseHexColor = color => {
      const hex = color.replace(/[^0-9A-Za-z]/g, '').replace(/^(.)(.)(.)$/, '$0$0$1$1$2$2');
      const [r, g, b] = hex.split(/(?=(?:..)*$)/).map(v => Number.parseInt(v, 16));
      return { r, g, b };
    };

    const parseNiconicoMode = mail => {
      const line = mail.toLowerCase().split(/\s+/);
      if (line.includes('ue')) return 'TOP';
      if (line.includes('shita')) return 'BOTTOM';
      return 'RTL';
    };

    const parseNiconicoSize = mail => {
      const line = mail.toLowerCase().split(/\s+/);
      if (line.includes('big')) return 36;
      if (line.includes('small')) return 16;
      return 25;
    };

    /**
     * @param {string|ArrayBuffer} content
     * @return {{ cid: number, danmaku: Array<Danmaku> }}
     */
    parser.bilibili_xml = function (content) {
      const text = typeof content === 'string' ? content : new TextDecoder('utf-8').decode(content);
      const clean = text.replace(/(?:[\0-\x08\x0B\f\x0E-\x1F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])/g, '');
      const data = (new DOMParser()).parseFromString(clean, 'text/xml');
      const cid = +data.querySelector('chatid').textContent;
      /** @type {Array<Danmaku>} */
      const danmaku = Array.from(data.querySelectorAll('d')).map(d => {
        const p = d.getAttribute('p');
        const [time, mode, size, color, create, bottom, sender, id] = p.split(',');
        return {
          text: d.textContent,
          time: +time,
          // We do not support ltr mode
          mode: [null, 'RTL', 'RTL', 'RTL', 'BOTTOM', 'TOP'][+mode],
          size: +size,
          color: parseRgb256IntegerColor(color),
          bottom: bottom > 0,
        };
      }).filter(danmakuFilter);
      return { cid, danmaku };
    };

    /**
     * @param {ArrayBuffer} content
     * @return { danmaku: Array<Danmaku> }
     */
    parser.bilibili = function (content) {
      const PbfTypes = function PbfTypes() {
        const self = this;
        /*
        message DmSegMobileReply {
          repeated DanmakuElem elems = 1;
        }
        
        message DanmakuElem {
          required int64 id = 1;
          required int32 progress = 2;
          required int32 mode = 3;
          required int32 fontsize = 4;
          required uint32 color = 5;
          required string midHash = 6;
          required string content = 7;
          required int64 ctime = 8;
          required int32 weight = 9;
          required string action = 10;
          required int32 pool = 11;
          required string idStr = 12;
          required int32 attr = 13;
        }
        */
        /* eslint-disable */

        'use strict'; // code generated by pbf v3.2.1

        // DmSegMobileReply ========================================

        var DmSegMobileReply = self.DmSegMobileReply = {};

        DmSegMobileReply.read = function (pbf, end) {
          return pbf.readFields(DmSegMobileReply._readField, { elems: [] }, end);
        };
        DmSegMobileReply._readField = function (tag, obj, pbf) {
          if (tag === 1) obj.elems.push(DanmakuElem.read(pbf, pbf.readVarint() + pbf.pos));
        };
        DmSegMobileReply.write = function (obj, pbf) {
          if (obj.elems) for (var i = 0; i < obj.elems.length; i++) pbf.writeMessage(1, DanmakuElem.write, obj.elems[i]);
        };

        // DanmakuElem ========================================

        var DanmakuElem = self.DanmakuElem = {};

        DanmakuElem.read = function (pbf, end) {
          return pbf.readFields(DanmakuElem._readField, { id: 0, progress: 0, mode: 0, fontsize: 0, color: 0, midHash: "", content: "", ctime: 0, weight: 0, action: "", pool: 0, idStr: "", attr: 0 }, end);
        };
        DanmakuElem._readField = function (tag, obj, pbf) {
          if (tag === 1) obj.id = pbf.readVarint(true);
          else if (tag === 2) obj.progress = pbf.readVarint(true);
          else if (tag === 3) obj.mode = pbf.readVarint(true);
          else if (tag === 4) obj.fontsize = pbf.readVarint(true);
          else if (tag === 5) obj.color = pbf.readVarint();
          else if (tag === 6) obj.midHash = pbf.readString();
          else if (tag === 7) obj.content = pbf.readString();
          else if (tag === 8) obj.ctime = pbf.readVarint(true);
          else if (tag === 9) obj.weight = pbf.readVarint(true);
          else if (tag === 10) obj.action = pbf.readString();
          else if (tag === 11) obj.pool = pbf.readVarint(true);
          else if (tag === 12) obj.idStr = pbf.readString();
          else if (tag === 13) obj.attr = pbf.readVarint(true);
        };
        DanmakuElem.write = function (obj, pbf) {
          if (obj.id) pbf.writeVarintField(1, obj.id);
          if (obj.progress) pbf.writeVarintField(2, obj.progress);
          if (obj.mode) pbf.writeVarintField(3, obj.mode);
          if (obj.fontsize) pbf.writeVarintField(4, obj.fontsize);
          if (obj.color) pbf.writeVarintField(5, obj.color);
          if (obj.midHash) pbf.writeStringField(6, obj.midHash);
          if (obj.content) pbf.writeStringField(7, obj.content);
          if (obj.ctime) pbf.writeVarintField(8, obj.ctime);
          if (obj.weight) pbf.writeVarintField(9, obj.weight);
          if (obj.action) pbf.writeStringField(10, obj.action);
          if (obj.pool) pbf.writeVarintField(11, obj.pool);
          if (obj.idStr) pbf.writeStringField(12, obj.idStr);
          if (obj.attr) pbf.writeVarintField(13, obj.attr);
        };

        /* eslint-enable */
      };
      const types = new PbfTypes();

      const pbf = new Pbf(new Uint8Array(content));
      const data = types.DmSegMobileReply.read(pbf);
      const danmaku = data.elems.map(item => {
        const { progress, mode, fontsize, color, content, pool } = item;
        return {
          text: content,
          time: progress,
          mode: [null, 'RTL', 'RTL', 'RTL', 'BOTTOM', 'TOP'][mode],
          size: fontsize,
          color: parseRgb256IntegerColor(color),
          bottom: pool > 0,
        };
      }).filter(danmakuFilter);
      return { danmaku };
    };

    /**
     * @param {string|ArrayBuffer} content
     * @return {{ danmaku: Array<Danmaku> }}
     */
    parser.acfun_v4 = function (content) {
      const text = typeof content === 'string' ? content : new TextDecoder('utf-8').decode(content);
      const data = JSON.parse(text);
      const list = data.reduce((x, y) => x.concat(y), []);
      const danmaku = list.map(line => {
        const [time, color, mode, size, sender, create, uuid] = line.c.split(','), text = line.m;
        return {
          text,
          time: +time,
          color: parseRgb256IntegerColor(+color),
          mode: [null, 'RTL', null, null, 'BOTTOM', 'TOP'][mode],
          size: +size,
          bottom: false,
          uuid,
        };
      }).filter(danmakuFilter);
      return { danmaku };
    };

    /**
     * @param {string|ArrayBuffer} content
     * @return {{ danmaku: Array<Danmaku> }}
     */
    parser.acfun_poll = function (content) {
      const text = typeof content === 'string' ? content : new TextDecoder('utf-8').decode(content);
      const data = JSON.parse(text);
      const danmaku = data.added.map(danmu => {
        const { position, color, mode, size, body, danmakuId } = danmu;
        return {
          text: body,
          time: position / 1000,
          color: parseRgb256IntegerColor(+color),
          mode: [null, 'RTL', null, null, 'BOTTOM', 'TOP'][mode],
          size: +size,
          bottom: false,
          danmuId: danmakuId,
        };
      }).filter(danmakuFilter);
      return { danmaku };
    };

    /**
     * @param {string|ArrayBuffer} content
     * @return {{ danmaku: Array<Danmaku> }}
     */
    parser.acfun = function (content) {
      const text = typeof content === 'string' ? content : new TextDecoder('utf-8').decode(content);
      const data = JSON.parse(text);
      const danmaku = data.danmakus.map(danmaku => {
        const { position, color, mode, size, body, danmakuId } = danmaku;
        return {
          text: body,
          time: position / 1000,
          color: parseRgb256IntegerColor(+color),
          mode: [null, 'RTL', null, null, 'BOTTOM', 'TOP'][mode],
          size: +size,
          bottom: false,
          danmuId: danmakuId,
        };
      }).filter(danmakuFilter);
      return { danmaku };
    };

    /**
     * @param {string|ArrayBuffer} content
     * @return {{ cid: number, danmaku: Array<Danmaku> }}
     */
    parser.niconico = function (content) {
      const text = typeof content === 'string' ? content : new TextDecoder('utf-8').decode(content);
      const data = JSON.parse(text);
      const list = data.map(item => item.chat).filter(x => x);
      const { thread } = list.find(comment => comment.thread);
      const danmaku = list.map(comment => {
        if (!comment.content || !(comment.vpos >= 0) || !comment.no) return null;
        const { vpos, mail = '', content, no } = comment;
        return {
          text: content,
          time: vpos / 100,
          color: parseNiconicoColor(mail),
          mode: parseNiconicoMode(mail),
          size: parseNiconicoSize(mail),
          bottom: false,
          id: no,
        };
      }).filter(danmakuFilter);
      return { thread, danmaku };
    };

    /**
     * @param {string|ArrayBuffer} content
     * @return {{ danmaku: Array<Danmaku> }}
     */
    parser.bahamut = function (content) {
      const text = typeof content === 'string' ? content : new TextDecoder('utf-8').decode(content);
      const list = JSON.parse(text);
      const danmaku = list.map(comment => {
        if (!comment) return null;
        const { text, time, color, position, size } = comment;
        if (!text) return null;
        if (comment.position < 0 || comment.position > 2) return null;
        if (comment.size < 0 || comment.size > 2) return null;
        return {
          text,
          time: time / 10,
          color: parseHexColor(color),
          mode: ['RTL', 'TOP', 'BOTTOM'][position],
          size: [16, 24, 28][size],
          bottom: false,
        };
      }).filter(danmakuFilter);
      return { danmaku };
    };

    return parser;
  }());

  window.danmaku = window.danmaku || {};
  window.danmaku.parser = parser;

}());
