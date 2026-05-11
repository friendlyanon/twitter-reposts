// ==UserScript==
// @name        Mark reposts on Media tab
// @description Run perceptual hashing on Twitter (now X) users' Media tab to identify reposts.
// @namespace   https://github.com/friendlyanon
// @author      friendlyanon
// @match       https://x.com/*
// @grant       none
// @run-at      document-start
// @version     3
// @downloadURL https://raw.githubusercontent.com/friendlyanon/twitter-reposts/master/twitter-reposts.user.js
// @supportURL  https://github.com/friendlyanon/twitter-reposts/issues
// @homepageURL https://github.com/friendlyanon/twitter-reposts
// @top-level-await
// ==/UserScript==

// SPDX-License-Identifier: GPL-3.0

"use strict";

// pHash

const defaultHashSize = 8;
const defaultSampleSize = 80;
const defaultThreshold = 90;
const settingsKey = "dedupe-settings";

function createCanvasElement(size) {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(size, size);
  }

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function computePhashFromImage(image, sampleSize, hashSize) {
  const canvas = createCanvasElement(sampleSize);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, 0, 0, sampleSize, sampleSize);
  return computePhashFromImageData(ctx.getImageData(0, 0, sampleSize, sampleSize), sampleSize, hashSize);
}

const computePhashFromImageData = (imageData, sampleSize, hashSize) =>
  computePhashFromRgba(imageData.data, imageData.width, imageData.height, sampleSize, hashSize);

const computePhashFromRgba = await (async () => {
  const memory = new WebAssembly.Memory({ initial: 16 });
  const { instance } = await WebAssembly.instantiate(Uint8Array.fromHex(`\
0061736D01000000010C0260017F017F60037F7F7F00020F0103656E76066D656D6F727902000203030200\
01060F027F01418080040B7F00419080040B07260214636F6D70757465506861736846726F6D5267626100\
000B5F5F686561705F6261736503010AAB0F028D0D070C7F037D067F027D057F017D017F3F004110742101\
2000280208210220002802182103200028020C220420046C21052000280210210602400240024020002802\
0422072004470D0020022004470D00200028020021080C010B20054102742209417F4C0D01200920012003\
6B4E0D012004410274210A2007417F6A210B2002417F6A210C430000803F2004B295220D2002B294210E20\
0D2007B294210F200028020021102003210820082111410021120340200C2012B3430000003F92200E9443\
000000BF92220D8EFC0022024100200241004A1B220241016A2213200C2013481B20076C2114200220076C\
2115430000803F200D2002B393221693211720112118410021190340410021022010200B2019B343000000\
3F92200F9443000000BF92220D8EFC0022134100201341004A1B221341016A221A200B201A481B221B2014\
6A4102746A211A2010201B20156A4102746A211B2010201320146A4102746A211C430000803F200D2013B3\
93220D93211D2010201320156A4102746A211E0340201820026A201E20026A2D0000B3201D94200D201B20\
026A2D0000B394922017942016201C20026A2D0000B3201D94200D201A20026A2D0000B39492949290FC00\
22134100201341004A1B221341FF01201341FF01481B3A0000200241016A22024104470D000B201841046A\
2118201941016A22192004470D000B2011200A6A2111201241016A22122004470D000B200320096A21030B\
4100211B20052001410020036B41037120036A22106B41046D4E0D00200620066C211C2004410274211E20\
10210B200B211A034020082102201A21132004211803402013200241026A2D0000B343D578E93D9420022D\
0000B3438716993E94200241016A2D0000B343A245163F949292380200200241046A2102201341046A2113\
2018417F6A22180D000B2008201E6A2108201A201E6A211A201B41016A221B2004470D000B200520014100\
2010200541027422136A22026B41037120026A22106B41046D4E0D00201020136A21022005200120024100\
20026B4103716A22086B41046D22114E0D002008211E2004417F4C0D00200420014100200820136A22026B\
41037120026A221B6B41046D4E0D00201B200441027422186A210241002119200420012002410020026B41\
03716A22156B41046D4E0D00201E211A410021140340200B20194102746A2004201B108180808000410021\
02200421130340201A20026A201B20026A2A0200380200200241046A21022013417F6A22130D000B201A20\
186A211A201920046A2119201441016A22142004470D000B4100210B20102119201E211403402015210220\
04211A201421130340200220132A0200380200200241046A2102201320186A2113201A417F6A221A0D000B\
20152004201B108180808000201B21022004211A201921130340201320022A0200380200200241046A2102\
201320186A2113201A417F6A221A0D000B201941046A2119201441046A2114200B41016A220B2004470D00\
0B201C20114E0D002006410274211441002119201E211B034020102102201B21132006211A034020132002\
2A0200380200200241046A2102201341046A2113201A417F6A221A0D000B201020186A2110201B20146A21\
1B201941016A22192006470D000B2008201C4102746A211A02400240201C41014B0D004300000000210D0C\
010B201C20014100201A6B410371201A6A22146B41046D4A0D01201E41046A210220142113201C417F6A22\
1521180340201320022A0200380200200241046A2102201341046A21132018417F6A22180D000B41002102\
0240024020154101460D00417F211B20142110410121190340201420194102746A2A0200211D201B211820\
10211302400340201322022A0200220D201D5E450D01200241046A200D3802002002417C6A211320184101\
6A22180D000B0B200241046A201D380200201B417F6A211B201041046A2110201941016A22192015470D00\
0B201541017621022015410171450D010B201420024102746A2A0200210D0C010B201420024102746A2202\
417C6A2A020020022A020092430000003F94210D0B201C2001201A6B4E0D00201A2102201C211303402002\
201E2A0200200D5E3A0000201E41046A211E200241016A21022013417F6A22130D000B2000280214211E41\
00211B034041032113201B210241002118024003402002201C4F0D01201A20026A2D000020137420187221\
18200241016A21022013417F6A2213417F470D000B0B201E201B4102766A20182D0080808480003A000020\
1B41046A221B201C490D000B201C4102760F0B000B990206047D017F017D027F017D017F430000803F2001\
B295220343DB0F494094210420039121052003200392912106410021074300000000210803402000210941\
00210A4300000000210B034020092A020043DB0FC93F2008200AB3430000003F9294220320034383F9223E\
948E43DB0FC9C09492220343DB0FC9C0922003200343DB0F49405E1B22038C2003200343000000005D1B93\
22038C2003200343000000005D220C1B220320032003942203200320034359DC41B99443A32E083C929443\
C0A72ABE929443F0FF7F3F929422038C2003200C1B94200B92210B200941046A21092001200A41016A220A\
470D000B200220074102746A2006200520071B200B9438020020042008922108200741016A22072001470D\
000B0B0B180100418080040B1030313233343536373839616263646566\
`), { env: { memory } });
  const heapBase = instance.exports.__heap_base.value;
  const mem = new Uint8Array(memory.buffer);
  const i32View = new Int32Array(memory.buffer);
  const decoder = new TextDecoder();

  return function computePhashFromRgba(rgba, width, height, sampleSize, hashSize) {
    const rgbaLen = rgba.length;
    if (rgbaLen === 0 || !(width > 0) || !(height > 0) || !(sampleSize > 0) | !(hashSize > 0)) {
      throw new Error("Invalid argument");
    }

    const hexLength = hashSize * hashSize >> 2;

    // Layout at heapBase: [args struct (28)] [rgba data] [output] [heap -->]
    const argsPtr = (heapBase + 3) & ~3;
    const argsBase = argsPtr >> 2;
    const rgbaPtr = argsPtr + 28;
    const outputPtr = rgbaPtr + rgba.length;
    const heapStart = (outputPtr + (hashSize * hashSize >> 2) + 3) & ~3;

    mem.set(rgba, rgbaPtr);

    // struct computePhashFromRgbaArgs
    i32View[argsBase] = rgbaPtr;        // rgba
    i32View[argsBase + 1] = width;      // dims.width
    i32View[argsBase + 2] = height;     // dims.height
    i32View[argsBase + 3] = sampleSize; // hashing.sampleSize
    i32View[argsBase + 4] = hashSize;   // hashing.hashSize
    i32View[argsBase + 5] = outputPtr;  // output
    i32View[argsBase + 6] = heapStart;  // heapStart

    const resultLen = instance.exports.computePhashFromRgba(argsPtr);
    return decoder.decode(mem.slice(outputPtr, outputPtr + resultLen));
  };
})();

function calculateSimilarity(hash1, hash2) {
  const distance = hammingDistance(hash1, hash2);
  const totalBits = hash1.length << 2;
  return ((totalBits - distance) / totalBits) * 100;
}

function popcount(x) {
  x -= x >> 1 & 0x55555555;
  x = (x & 0x33333333) + (x >> 2 & 0x33333333);
  x = x + (x >> 4) & 0x0F0F0F0F;
  x += x >> 8;
  x += x >> 16;

  return x & 0x7F;
}

function hammingDistance(hash1, hash2) {
  let distance = 0;
  for (let i = 0; i !== hash1.length; ++i) {
    distance += popcount(parseInt(hash1[i], 16) ^ parseInt(hash2[i], 16));
  }
  return distance;
}

// Main

const { moreSvg, closeSvg, cogSvg } = (function () {
  const ns = "http://www.w3.org/2000/svg";
  const moreSvg = document.createElementNS(ns, "svg");
  moreSvg.setAttribute("viewBox", "0 0 24 24");
  const path = moreSvg.appendChild(document.createElementNS(ns, "g"))
    .appendChild(document.createElementNS(ns, "path"));
  const closeSvg = moreSvg.cloneNode(true);
  const cogSvg = moreSvg.cloneNode(true);
  path.setAttribute("d", `\
M3 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 2c1.1 0 2-.9 2-2s-.9-2-2-2-\
2 .9-2 2 .9 2 2 2zm7 0c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z`);
  closeSvg.firstElementChild.firstElementChild.setAttribute("d", `\
M10.59 12L4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04\
-1.42 1.42L12 13.41l-6.04 6.05-1.42-1.42L10.59 12z`);
  cogSvg.firstElementChild.firstElementChild.setAttribute("d", `\
M10.54 1.75h2.92l1.57 2.36c.11.17.32.25.53.21l2.53-.59 2.17 2.17-.58 2.54c-.0\
5.2.04.41.21.53l2.36 1.57v2.92l-2.36 1.57c-.17.12-.26.33-.21.53l.58 2.54-2.17\
 2.17-2.53-.59c-.21-.04-.42.04-.53.21l-1.57 2.36h-2.92l-1.58-2.36c-.11-.17-.3\
2-.25-.52-.21l-2.54.59-2.17-2.17.58-2.54c.05-.2-.03-.41-.21-.53l-2.35-1.57v-2\
.92L4.1 8.97c.18-.12.26-.33.21-.53L3.73 5.9 5.9 3.73l2.54.59c.2.04.41-.04.52-\
.21l1.58-2.36zm1.07 2l-.98 1.47C10.05 6.08 9 6.5 7.99 6.27l-1.46-.34-.6.6.33 \
1.46c.24 1.01-.18 2.07-1.05 2.64l-1.46.98v.78l1.46.98c.87.57 1.29 1.63 1.05 2\
.64l-.33 1.46.6.6 1.46-.34c1.01-.23 2.06.19 2.64 1.05l.98 1.47h.78l.97-1.47c.\
58-.86 1.63-1.28 2.65-1.05l1.45.34.61-.6-.34-1.46c-.23-1.01.18-2.07 1.05-2.64\
l1.47-.98v-.78l-1.47-.98c-.87-.57-1.28-1.63-1.05-2.64l.34-1.46-.61-.6-1.45.34\
c-1.02.23-2.07-.19-2.65-1.05l-.97-1.47h-.78zM12 10.5c-.83 0-1.5.67-1.5 1.5s.6\
7 1.5 1.5 1.5c.82 0 1.5-.67 1.5-1.5s-.68-1.5-1.5-1.5zM8.5 12c0-1.93 1.56-3.5 \
3.5-3.5 1.93 0 3.5 1.57 3.5 3.5s-1.57 3.5-3.5 3.5c-1.94 0-3.5-1.57-3.5-3.5z`);
  return { moreSvg, closeSvg, cogSvg };
})();

function npath(node, path) {
  if (node == null) {
    return null;
  }
  for (const dir of path) {
    if (dir === "f") {
      node = node.firstElementChild;
    } else if (dir === "n") {
      node = node.nextElementSibling;
    } else if (dir === "p") {
      node = node.previousElementSibling;
    } else if (dir === "l") {
      node = node.lastElementChild;
    }
    if (node == null) {
      return null;
    }
  }
  return node;
}

class Dedupe {
  constructor(owner, moreNodes, fetchId) {
    this.owner = owner;
    this.moreNodes = moreNodes;
    this.fetchId = fetchId;
    this.map = new Map();
    this.running = false;
    this.job = 0;
    this.lastSize = 0;
    this.lastDupeIds = new Map();
    this.imagesLoading = new Map();
    this.oldestMap = new WeakMap();
    this.similarityMap = new Map();
    let settings;
    try { settings = JSON.parse(localStorage.getItem(settingsKey)); } catch {}
    this.hashSize = settings?.hashSize ?? defaultHashSize;
    this.sampleSize = settings?.sampleSize ?? defaultSampleSize;
    this.threshold = settings?.threshold ?? defaultThreshold;
    this.pendingInputs = null;
    window.addEventListener("storage", this);
  }

  delete() {
    window.removeEventListener("storage", this);
    this.running = false;
  }

  getIdFromTile(a) {
    return this.idRe.exec(a.pathname)?.[1];
  }

  processImages() {
    const promises = [];
    const presentNodes = new Map();
    const { imagesLoading } = this;
    for (const a of this.getTiles()) {
      const prefixStr = this.getIdFromTile(a);
      if (prefixStr == null) {
        continue;
      }

      const prefix = BigInt(prefixStr);
      const urls = this.fetchId(prefix);
      if (urls == null) {
        continue;
      }

      let i = 0n;
      for (const { url } of urls) {
        if (i === 16n) {
          throw new Error("Too many URLs for " + prefixStr);
        }

        const id = prefix << 4n | i++;
        presentNodes.set(id, a);
        if (this.map.has(id)) {
          continue;
        }

        const promise = imagesLoading.get(id);
        if (promise != null) {
          promises.push(promise);
          continue;
        }

        const image = new Image();
        image.crossOrigin = "anonymous";
        image.src = url;
        const newPromise = new Promise((resolve, reject) => {
          image.onload = () => {
            if (this.running) {
              this.map.set(id, computePhashFromImage(image, this.sampleSize, this.hashSize));
            }

            resolve();
          };
          image.onerror = () => reject(new Error("Failed to load image"));
        }).finally(() => imagesLoading.delete(id));
        promises.push(newPromise);
        imagesLoading.set(id, newPromise);
      }
    }

    return Promise.all(promises).then(() => presentNodes);
  }

  makeDupeIds() {
    if (this.map.size === this.lastSize) {
      return this.lastDupeIds;
    }

    const ids = Array.from(this.map.keys());
    const limitJ = ids.length;
    const limitI = limitJ - 1;
    const visited = new Set();
    const groups = [];
    for (let i = 0; i !== limitI; ++i) {
      const idI = ids[i];
      const prefixI = idI >> 4n;
      if (visited.has(idI)) {
        continue;
      }

      const hash = this.map.get(idI);
      const group = [idI];
      visited.add(idI);
      for (let j = i + 1; j !== limitJ; ++j) {
        const idJ = ids[j];
        if (prefixI === idJ >> 4n || visited.has(idJ)) {
          continue;
        }

        const similarity = calculateSimilarity(hash, this.map.get(idJ));
        if (similarity >= this.threshold) {
          group.push(idJ);
          visited.add(idJ);
          this.similarityMap.set(idJ, similarity);
          this.similarityMap.set(idI, similarity);
        }
      }

      if (group.length !== 1) {
        groups.push(group);
      }
    }

    const dupeIds = new Map();
    for (const group of groups) {
      group.sort(this.idSorter);
      const oldest = group[0];
      const limit = group.length;
      for (let i = 1; i !== limit; ++i) {
        dupeIds.set(group[i], oldest);
      }
    }

    this.lastSize = this.map.size;
    this.lastDupeIds = dupeIds;
    return dupeIds;
  }

  renderMore(dupeIds, id, e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    const { onClick } = this;
    const idStr = String(id);
    const infos = this.fetchId(id);
    const limit = infos.length;
    this.renderDialog((header, body) => {
      for (let i = 0; i !== limit;) {
        const infoLeft = infos[i];
        const dupe = dupeIds.get(i);
        const item = body.appendChild(document.createElement("div"));
        const linkLeft = item.appendChild(document.createElement("a"));
        const imgLeft = linkLeft.appendChild(document.createElement("img"));
        const description = item.appendChild(item.cloneNode());
        const top = description.appendChild(item.cloneNode());
        const topButton = top.appendChild(document.createElement("a"));
        const topText = top.appendChild(document.createElement("span"));
        imgLeft.className = "dedupe-dialog-item-preview";
        if (dupe != null) {
          const dupeId = dupe >> 4n;
          const dupeNum = Number(dupe & 15n);
          const infoRight = this.fetchId(dupeId)[dupeNum];
          const linkRight = item.appendChild(linkLeft.cloneNode());
          const middle = description.appendChild(top.cloneNode());
          const middleText = middle.appendChild(topText.cloneNode());
          const bottom = description.appendChild(top.cloneNode());
          const bottomText = bottom.appendChild(topText.cloneNode());
          const bottomButton = bottom.appendChild(topButton.cloneNode());
          linkRight.appendChild(imgLeft.cloneNode()).src = infoRight.url;
          bottomText.textContent = `${infoRight.width}x${infoRight.height}`;
          const hrefRight = `/${this.owner}/status/${dupeId}/photo/${dupeNum + 1}`;
          bottomButton.setAttribute("href", hrefRight);
          linkRight.setAttribute("href", hrefRight);
          topText.textContent = `${infoLeft.width}x${infoLeft.height}`;
          middle.className = "dedupe-dialog-item-description-middle";
          middleText.textContent = `${this.similarityMap.get(dupe).toFixed(2)}% similarity`;
          bottom.className = "dedupe-dialog-item-description-bottom";
          topButton.className = "dedupe-dialog-item-link-lavender";
          topButton.textContent = "Open repost";
          bottomButton.className = "dedupe-dialog-item-link-amber";
          bottomButton.textContent = "Open oldest";
          bottomButton.addEventListener("click", onClick);
          linkRight.addEventListener("click", onClick);
        } else {
          topText.textContent = `${infoLeft.width}x${infoLeft.height}`;
          topButton.className = "dedupe-dialog-item-link-blue";
          topButton.textContent = "Open";
        }
        description.className = "dedupe-dialog-item-description";
        item.className = "dedupe-dialog-item";
        linkLeft.addEventListener("click", onClick);
        topButton.addEventListener("click", onClick);
        top.className = "dedupe-dialog-item-description-top";
        imgLeft.src = infoLeft.url;
        const hrefLeft = `/${this.owner}/status/${idStr}/photo/${++i}`;
        linkLeft.setAttribute("href", hrefLeft);
        topButton.setAttribute("href", hrefLeft);
        body.appendChild(item);
      }
    });
  }

  annotateDupe(a, dupeIds) {
    a.firstElementChild.style.opacity = "0.2";
    const more = a.parentNode.appendChild(document.createElement("span"));
    more.appendChild(moreSvg.cloneNode(true));
    more.className = "dedupe-more";
    const id = BigInt(this.getIdFromTile(a));
    more.addEventListener("click", this.renderMore.bind(this, dupeIds, id), true);
  }

  async run() {
    const presentNodes = await this.processImages();
    if (!this.running) {
      return;
    }

    const dupeIds = this.makeDupeIds();
    for (const [id, a] of presentNodes) {
      const oldest = dupeIds.get(id);
      if (
        oldest != null
        && oldest >> 4n !== id >> 4n
        && this.oldestMap.get(a)?.set(Number(id & 15n), oldest) == null
      ) {
        const ids = new Map([[Number(id & 15n), oldest]]);
        this.oldestMap.set(a, ids);
        this.annotateDupe(a, ids);
      }
    }
  }

  async handleMutation() {
    if (!this.running) {
      return;
    }

    for (this.job = this.job === 0 ? 1 : 2; this.job === 1; --this.job) {
      await this.run();
    }
  }

  renderSettings(header, body) {
    const fields = [
      ["Hash size", "hashSize", "1", this.hashSize],
      ["Sample size", "sampleSize", "1", this.sampleSize],
      ["Threshold", "threshold", "0.1", this.threshold],
    ];
    const inputs = {};
    for (const [label, key, step, value] of fields) {
      const row = body.appendChild(document.createElement("div"));
      row.className = "dedupe-settings-row";
      const labelEl = row.appendChild(document.createElement("label"));
      labelEl.textContent = label;
      const input = row.appendChild(document.createElement("input"));
      input.type = "number";
      input.step = step;
      input.value = value;
      input.className = "dedupe-settings-input";
      inputs[key] = input;
    }
    this.pendingInputs = inputs;
  }

  reloadSettings() {
    const inputs = this.pendingInputs;
    if (inputs == null) {
      return;
    }

    this.pendingInputs = null;
    const settings = {
      hashSize: parseInt(inputs.hashSize.value, 10) || defaultHashSize,
      sampleSize: parseInt(inputs.sampleSize.value, 10) || defaultSampleSize,
      threshold: parseFloat(inputs.threshold.value) || defaultThreshold,
    };
    localStorage.setItem(settingsKey, JSON.stringify(settings));
    this.applySettings(settings);
  }

  applySettings(settings) {
    const hashSize = settings?.hashSize ?? defaultHashSize;
    const sampleSize = settings?.sampleSize ?? defaultSampleSize;
    const threshold = settings?.threshold ?? defaultThreshold;
    if (this.hashSize === hashSize && this.sampleSize === sampleSize && this.threshold === threshold) {
      return;
    }

    this.hashSize = hashSize;
    this.sampleSize = sampleSize;
    this.threshold = threshold;
    this.map.clear();
    this.imagesLoading = new Map();
    this.lastSize = 0;
    this.lastDupeIds.clear();
    this.similarityMap.clear();
    this.clearAnnotations();
    this.handleMutation().catch(console.error);
  }

  clearAnnotations() {
    this.oldestMap = new WeakMap();
    for (const a of this.getTiles()) {
      const { style } = a.firstElementChild;
      if (style.opacity) {
        style.opacity = "";
      }
    }
    for (let i = this.moreNodes.length; i !== 0;) {
      this.moreNodes[--i].remove();
    }
  }

  handleEvent(e) {
    if (e.type === "storage") {
      if (e.key !== settingsKey) {
        return;
      }

      let settings;
      try { settings = JSON.parse(e.newValue); } catch {}
      this.applySettings(settings);
      return;
    }

    e.preventDefault();
    e.stopImmediatePropagation();
    const node = e.currentTarget;
    if (node.className === "dedupe-settings") {
      const render = (header, body) => this.renderSettings(header, body);
      this.renderDialog(render).onclose = () => this.reloadSettings();
      return;
    }

    if (!this.running) {
      this.running = true;
      node.textContent = "Stop";
      this.handleMutation().catch(console.error);
      return;
    }

    this.running = false;
    this.clearAnnotations();
    node.textContent = "Dedupe";
  }
}

for (const pair of [
  ["idRe", /\/status\/(\d+)/],
  ["idSorter", (a, b) => a < b ? -1 : a > b ? 1 : 0],
  ["getTiles", () => document.querySelectorAll("li[id^=verticalGridItem-] a")],
  ["onClick", (e) => {
    if (e.button !== 0 || e.altKey || e.ctrlKey || e.shiftKey || e.metaKey) {
      return;
    }

    e.preventDefault();
    window.RichHistory.push({ pathname: e.currentTarget.getAttribute("href"), hash: "", query: {}, search: "" });
  }],
  ["renderDialog", (fn) => {
    const layers = document.getElementById("layers");
    const container = document.createElement("div");
    const mask = container.appendChild(container.cloneNode());
    const dialog = container.appendChild(container.cloneNode());
    const dialogHeader = dialog.appendChild(container.cloneNode());
    const dialogBody = dialog.appendChild(container.cloneNode());
    const dialogFooter = dialog.appendChild(container.cloneNode());
    const darkClass = "dedupe-dialog-mask-dark";
    container.className = "dedupe-dialog-container";
    mask.className = "dedupe-dialog-mask " + darkClass;
    dialog.className = "dedupe-dialog";
    dialog.role = "dialog";
    dialogHeader.className = "dedupe-dialog-header";
    dialogBody.className = "dedupe-dialog-body";
    dialogFooter.className = "dedupe-dialog-footer";

    const observer = new MutationObserver(() => {
      const force = layers.querySelector("div[data-testid=mask]") == null;
      mask.classList.toggle(darkClass, force);
      const first = layers.firstElementChild;
      if (first !== container) {
        if (npath(first, "fnff")?.dataset.testid === "chat-drawer-root") {
          if (first.nextElementSibling !== container) {
            first.insertAdjacentElement("afterend", container);
          }
        } else {
          layers.insertAdjacentElement("afterbegin", container);
        }
      }
    });

    const close = dialogHeader.appendChild(document.createElement("span"));
    close.appendChild(closeSvg.cloneNode(true));
    close.className = "dedupe-dialog-close";

    const result = Object.create(null, {
      onclose: {
        value: null,
        writable: true,
        enumerable: true,
        configurable: true,
      },
    });
    const closeDialog = () => {
      container.remove();
      observer.disconnect();
      document.removeEventListener("keydown", escHandler);
      (0, result.onclose)?.();
    };
    const escHandler = (e) => {
      if (e.key === "Escape" && container.nextElementSibling == null) {
        e.preventDefault();
        closeDialog();
      }
    };
    close.addEventListener("click", closeDialog);
    mask.addEventListener("click", closeDialog);
    document.addEventListener("keydown", escHandler);

    fn(dialogHeader, dialogBody);
    layers.appendChild(container);
    observer.observe(layers, { childList: true });
    return result;
  }],
]) {
  Dedupe.prototype[pair[0]] = pair[1];
}

const replaceWith = (object, key, methodSupplier) => {
  const orig = object[key];
  Object.defineProperty(object, key, {
    value: methodSupplier(orig),
    writable: true,
    configurable: true,
  });
};

const userMediaSet = new WeakSet();
const idMap = new Map();

const mediumRe = /^(https:\/\/.+\/[^.]+)\.([a-z0-9]+)$/;
const hasOwn = Function.prototype.call.bind(Object.prototype.hasOwnProperty);
const parseMedium = (medium) => {
  const url = medium.media_url_https;
  const match = mediumRe.exec(url);
  return {
    url: match == null ? url : `${match[1]}?format=${match[2]}&name=small`,
    width: medium.original_info.width,
    height: medium.original_info.height,
  };
};
function cacheReviver(key, value) {
  if (key === "__typename") {
    let obj;
    if (value === "Tweet" && hasOwn(this, "legacy")) {
      obj = this.legacy;
    } else if (value === "TweetWithVisibilityResults" && hasOwn(this.tweet, "legacy")) {
      obj = this.tweet.legacy;
    }
    if (obj != null) {
      const { id_str, extended_entities } = obj;
      const media = extended_entities?.media;
      if (media != null && media.length !== 0) {
        idMap.set(BigInt(id_str), media.map(parseMedium));
      }
    }
  }

  return value;
}

function cacheTweets(xhr, orig) {
  try {
    if (xhr.readyState !== 4) {
      return;
    }

    JSON.parse(xhr.responseText, cacheReviver);
  } finally {
    orig.call(xhr);
  }
}

replaceWith(XMLHttpRequest.prototype, "open", (orig) => function open(method, url, ...rest) {
  const { pathname } = new URL(url, location.origin);
  if (pathname.endsWith("/UserMedia")) {
    userMediaSet.add(this);
  }

  return orig.call(this, method, url, ...rest);
});

replaceWith(XMLHttpRequest.prototype, "send", (orig) => function send(...rest) {
  if (userMediaSet.has(this)) {
    const orig = this.onreadystatechange;
    this.onreadystatechange = () => cacheTweets(this, orig);
  }

  return orig.apply(this, rest);
});

const hijackOnce = (key) => {
  const deferred = Promise.withResolvers();
  const proto = Object.prototype;
  Object.defineProperty(proto, key, {
    set(value) {
      delete proto[key];
      this[key] = value;
      deferred.resolve(this);
    },
    configurable: true,
  });
  return deferred.promise;
};

// hijackOnce("unstable_act").then((x) => void (window.React = x));
// hijackOnce("jsxs").then((x) => void (window.ReactJSX = x));
// hijackOnce("hydrateRoot").then((x) => void (window.ReactDOM = x));
hijackOnce("_currentLocationIndex").then((x) => void (window.RichHistory = x));

const fetchId = Map.prototype.get.bind(idMap);

const moreNodes = document.getElementsByClassName("dedupe-more");
const mediaTab = document.getElementsByClassName("dedupe-media-tab");
const primaryColumn = document.getElementsByClassName("dedupe-primary-column");
let cachedPair = null;
new MutationObserver(() => {
  if (cachedPair != null) {
    if (cachedPair.node.isConnected) {
      return void cachedPair.dedupe.handleMutation().catch(console.error);
    } else {
      cachedPair.dedupe.delete();
      cachedPair = null;
    }
  }

  if (mediaTab.length === 0) {
    const node = document.querySelector("a[role=tab][href$=\"/media\"][aria-selected=true]");
    if (node == null) {
      return;
    }
    node.classList.add("dedupe-media-tab");
  }

  let column;
  if (primaryColumn.length !== 0) {
    column = primaryColumn[0];
  } else {
    const node = document.querySelector("div[data-testid=primaryColumn]");
    if (node == null) {
      return;
    }
    node.classList.add("dedupe-primary-column");
    column = node;
  }

  const node = npath(column, "fffffffffnfl");
  if (node != null && node.firstElementChild == null) {
    node.appendChild(new Text(" "));
    const newSpan = node.appendChild(document.createElement("span"));
    node.normalize();
    node.appendChild(new Text(" "));
    const settings = node.appendChild(document.createElement("span"));
    settings.appendChild(cogSvg.cloneNode(true));
    settings.className = "dedupe-settings";
    newSpan.textContent = "Dedupe";
    newSpan.className = "dedupe-toggle";
    const owner = location.pathname.slice(1, location.pathname.indexOf("/", 1));
    const dedupe = new Dedupe(owner, moreNodes, fetchId);
    settings.addEventListener("click", dedupe, true);
    newSpan.addEventListener("click", dedupe, true);
    cachedPair = { node: newSpan, dedupe };
  }
}).observe(document.documentElement, {
  childList: true,
  subtree: true,
});

document.addEventListener("DOMContentLoaded", () => {
  const style = document.createElement("style");
  style.appendChild(new Text(`
.dedupe-settings {
  transform: translateY(4px);
  display: inline-block;
  font-size: 0;
}
.dedupe-more {
  position: absolute;
  top: 2px;
  right: 2px;
  color: white;
  width: 2.25em;
  height: 2.25em;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 9999px;
  transition-property: background-color;
  background-color: transparent;
}
.dedupe-more:hover {
  color: rgb(29, 155, 240);
  background-color: rgba(29, 155, 240, 0.1);
}
.dedupe-dialog-close {
  position: absolute;
  top: 4px;
  left: 4px;
  color: white;
  width: 3em;
  height: 3em;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 9999px;
  transition-property: background-color;
  background-color: transparent;
  cursor: pointer;
}
.dedupe-dialog-close:hover {
  background-color: rgba(29, 155, 240, 0.1);
}
.dedupe-settings svg,
.dedupe-more svg,
.dedupe-dialog-close svg {
  user-select: none;
  display: inline-block;
  fill: currentColor;
  transition-property: color;
}
.dedupe-settings svg {
  width: 16px;
  height: 16px;
}
.dedupe-more svg {
  width: 1.25em;
  height: 1.25em;
}
.dedupe-dialog-close svg {
  width: 1.5em;
  height: 1.5em;
}
.dedupe-more, .dedupe-more svg,
.dedupe-dialog-close, .dedupe-dialog-close svg {
  transition-duration: 0.2s;
}
.dedupe-toggle {
  color: rgb(29, 155, 240);
  cursor: pointer;
  user-select: none;
}
.dedupe-dialog-container {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  font-family: "TwitterChirp", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
.dedupe-dialog a {
  text-decoration: none;
}
.dedupe-dialog {
  width: 600px;
  height: 650px;
  border-radius: 16px;
  background-color: black;
  z-index: 1;
  display: flex;
  flex-direction: column;
}
.dedupe-dialog-mask {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
}
.dedupe-dialog-mask-dark {
  background-color: rgba(91, 112, 131, 0.4);
}
.dedupe-dialog-header {
  background-color: rgb(20, 20, 20);
  border-radius: 16px 16px 0 0;
}
.dedupe-dialog-header,
.dedupe-dialog-footer {
  min-height: 53px;
  position: relative;
  text-align: center;
}
.dedupe-dialog-body {
  padding: 4px;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}
.dedupe-dialog-item {
  display: flex;
  flex-direction: row;
  gap: 10px;
}
.dedupe-dialog-item > a {
  position: relative;
}
.dedupe-dialog-item-preview {
  height: 194px;
  width: 194px;
  object-fit: cover;
}
.dedupe-dialog-item-description {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  padding: 4px 0;
}
.dedupe-dialog-item-description > div {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dedupe-dialog-item-description-top {
  align-items: flex-start;
}
.dedupe-dialog-item-description-middle {
  align-items: center;
  flex-grow: 1;
  justify-content: center;
}
.dedupe-dialog-item-description-bottom {
  align-items: flex-end;
}
.dedupe-dialog-item-description a {
  color: rgb(var(--dedupe-link-color));
  background-color: rgba(var(--dedupe-link-color), 0.2);
  border-radius: 9999px;
  padding: 8px 14px;
  font-size: 1.2em;
  transition-duration: 0.2s;
  transition-property: background-color;
}
.dedupe-dialog-item-description a:hover {
  background-color: rgba(var(--dedupe-link-color), 0.3);
}
.dedupe-dialog-item-link-blue {
  --dedupe-link-color: 29, 155, 240;
}
.dedupe-dialog-item-link-amber {
  --dedupe-link-color: 255, 191, 0;
}
.dedupe-dialog-item-link-lavender {
  --dedupe-link-color: 167, 139, 250;
}
.dedupe-settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
}
.dedupe-settings-row label {
  color: white;
  font-size: 1.1em;
}
.dedupe-settings-input {
  width: 80px;
  padding: 6px 8px;
  border: 1px solid rgb(51, 54, 57);
  border-radius: 4px;
  background-color: black;
  color: white;
  font-size: 1em;
}
`));
  document.head.appendChild(style);
}, { once: true });
