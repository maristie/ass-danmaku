'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const layoutSource = fs.readFileSync(
  path.join(__dirname, '..', 'extension', 'danmaku', 'layout.js'),
  'utf8',
);

const createLayout = () => {
  const globals = {
    setTimeout,
    window: {
      font: {
        text: () => 100,
      },
    },
  };
  globals.window.danmaku = {};
  vm.runInNewContext(layoutSource, globals, { filename: 'layout.js' });
  return globals.window.danmaku.layout;
};

const options = {
  resolutionX: 560,
  resolutionY: 40,
  bottomReserved: 0,
  fontFamily: 'sans-serif',
  fontSize: 1,
  textSpace: 0,
  rtlDuration: 8,
  fixDuration: 4,
  maxDelay: 0,
  maxOverlap: 1,
};

const comment = (id, mode) => ({
  id,
  text: `comment ${id}`,
  time: 0,
  mode,
  size: 10,
  color: { r: 255, g: 255, b: 255 },
  bottom: false,
});

test('layout delays comments that exceed collision constraints', async () => {
  const input = [
    ...Array.from({ length: 20 }, (_, id) => comment(`rtl-${id}`, 'RTL')),
    ...Array.from({ length: 20 }, (_, id) => comment(`top-${id}`, 'TOP')),
    ...Array.from({ length: 20 }, (_, id) => comment(`bottom-${id}`, 'BOTTOM')),
  ];
  const result = await createLayout()(input, options);

  assert.equal(result.length, input.length);
  assert.ok(result.every(line => line.layout));
  assert.ok(result.some(line => line.layout.start.time > line.time));

  const fixed = result.filter(line => line.layout.type === 'Fix');
  for (let i = 0; i < fixed.length; i++) {
    for (let j = i + 1; j < fixed.length; j++) {
      const a = fixed[i];
      const b = fixed[j];
      const timeOverlaps = a.layout.start.time < b.layout.end.time
        && b.layout.start.time < a.layout.end.time;
      const verticalOverlaps = a.layout.start.y - a.height < b.layout.start.y
        && b.layout.start.y - b.height < a.layout.start.y;
      assert.ok(!(timeOverlaps && verticalOverlaps), `${a.id} overlaps ${b.id}`);
    }
  }

  const moving = result.filter(line => line.layout.type === 'Rtl');
  const minimumLaneGap = options.rtlDuration * moving[0].width
    / (options.resolutionX + moving[0].width);
  for (let i = 0; i < moving.length; i++) {
    for (let j = i + 1; j < moving.length; j++) {
      const a = moving[i];
      const b = moving[j];
      const verticalOverlaps = a.layout.start.y - a.height < b.layout.start.y
        && b.layout.start.y - b.height < a.layout.start.y;
      if (verticalOverlaps) {
        assert.ok(
          Math.abs(a.layout.start.time - b.layout.start.time) + 1e-9 >= minimumLaneGap,
          `${a.id} overlaps ${b.id}`,
        );
      }
    }
  }
});
