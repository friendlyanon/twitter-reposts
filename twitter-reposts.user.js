// ==UserScript==
// @name        Mark reposts on Media tab
// @description Run perceptual hashing on Twitter (now X) users' Media tab to identify reposts.
// @namespace   https://github.com/friendlyanon
// @author      friendlyanon
// @match       https://x.com/*
// @grant       none
// @run-at      document-start
// @version     1
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
  const { instance } = await WebAssembly.instantiate(new Uint8Array(JSON.parse(`[
    0,97,115,109,1,0,0,0,1,12,2,96,1,127,1,127,96,3,127,127,127,0,2,15,1,3,101,110,118,6,
    109,101,109,111,114,121,2,0,2,3,3,2,0,1,6,15,2,127,1,65,128,128,4,11,127,0,65,144,
    128,4,11,7,38,2,20,99,111,109,112,117,116,101,80,104,97,115,104,70,114,111,109,82,
    103,98,97,0,0,11,95,95,104,101,97,112,95,98,97,115,101,3,1,10,203,15,2,186,13,7,9,
    127,3,125,9,127,2,125,4,127,1,125,1,127,63,0,65,16,116,33,1,32,0,40,2,24,33,2,32,0,
    40,2,16,33,3,2,64,2,64,2,64,2,64,32,0,40,2,4,34,4,32,0,40,2,12,34,5,71,13,0,32,0,40,
    2,8,32,5,71,13,0,32,5,32,5,108,33,6,32,0,40,2,0,33,7,32,2,33,8,12,1,11,32,5,32,5,108,
    34,6,65,2,116,34,9,32,1,32,2,107,78,13,1,32,2,32,9,106,33,8,2,64,2,64,32,5,13,0,65,0,
    33,6,12,1,11,32,4,178,32,5,178,34,10,149,33,11,32,0,40,2,8,34,9,178,32,10,149,33,12,
    32,0,40,2,0,33,13,32,5,65,2,116,33,14,32,4,65,127,106,33,15,32,9,65,127,106,33,16,32,
    2,33,17,65,0,33,18,3,64,32,16,32,18,179,67,0,0,0,63,146,32,12,148,67,0,0,0,191,146,
    34,10,142,252,0,34,9,65,0,32,9,65,0,74,27,34,9,65,1,106,34,19,32,16,32,19,72,27,32,4,
    108,33,20,32,9,32,4,108,33,21,67,0,0,128,63,32,10,32,9,179,147,34,22,147,33,23,32,17,
    33,24,65,0,33,25,3,64,65,0,33,9,32,13,32,15,32,25,179,67,0,0,0,63,146,32,11,148,67,0,
    0,0,191,146,34,10,142,252,0,34,19,65,0,32,19,65,0,74,27,34,19,65,1,106,34,7,32,15,32,
    7,72,27,34,26,32,20,106,65,2,116,106,33,7,32,13,32,26,32,21,106,65,2,116,106,33,26,
    32,13,32,19,32,20,106,65,2,116,106,33,27,67,0,0,128,63,32,10,32,19,179,147,34,10,147,
    33,28,32,13,32,19,32,21,106,65,2,116,106,33,29,3,64,32,24,32,9,106,32,29,32,9,106,45,
    0,0,179,32,28,148,32,10,32,26,32,9,106,45,0,0,179,148,146,32,23,148,32,22,32,27,32,9,
    106,45,0,0,179,32,28,148,32,10,32,7,32,9,106,45,0,0,179,148,146,148,146,67,0,0,0,63,
    146,142,252,0,34,19,65,0,32,19,65,0,74,27,34,19,65,255,1,32,19,65,255,1,72,27,58,0,0,
    32,9,65,1,106,34,9,65,4,71,13,0,11,32,24,65,4,106,33,24,32,25,65,1,106,34,25,32,5,71,
    13,0,11,32,17,32,14,106,33,17,32,18,65,1,106,34,18,32,5,71,13,0,11,11,32,2,33,7,11,
    32,6,32,1,65,0,32,8,107,65,3,113,32,8,106,34,20,107,65,4,109,78,13,0,32,20,32,6,65,2,
    116,34,25,106,33,13,2,64,32,5,69,13,0,32,5,65,2,116,33,27,65,0,33,29,32,20,33,26,3,
    64,32,7,33,9,32,26,33,19,32,5,33,24,3,64,32,19,32,9,65,2,106,45,0,0,179,67,213,120,
    233,61,148,32,9,45,0,0,179,67,135,22,153,62,148,32,9,65,1,106,45,0,0,179,67,162,69,
    22,63,148,146,146,56,2,0,32,9,65,4,106,33,9,32,19,65,4,106,33,19,32,24,65,127,106,34,
    24,13,0,11,32,7,32,27,106,33,7,32,26,32,27,106,33,26,32,29,65,1,106,34,29,32,5,71,13,
    0,11,11,32,6,32,1,65,0,32,13,107,65,3,113,32,13,106,34,13,107,65,4,109,78,13,0,32,13,
    32,25,106,33,9,32,6,32,1,32,9,65,0,32,9,107,65,3,113,106,34,17,107,65,4,109,34,18,78,
    13,0,32,17,33,29,32,5,65,127,76,13,0,32,5,32,1,65,0,32,17,32,25,106,34,9,107,65,3,
    113,32,9,106,34,26,107,65,4,109,78,13,0,32,26,32,5,65,2,116,34,24,106,33,9,32,5,32,1,
    32,9,65,0,32,9,107,65,3,113,106,34,21,107,65,4,109,78,13,0,32,3,32,3,108,33,27,2,64,
    32,5,69,13,0,65,0,33,25,32,29,33,7,3,64,32,20,32,25,32,5,108,65,2,116,106,32,5,32,26,
    16,129,128,128,128,0,65,0,33,9,32,5,33,19,3,64,32,7,32,9,106,32,26,32,9,106,42,2,0,
    56,2,0,32,9,65,4,106,33,9,32,19,65,127,106,34,19,13,0,11,32,7,32,24,106,33,7,32,25,
    65,1,106,34,25,32,5,71,13,0,11,65,0,33,15,32,13,33,25,32,29,33,20,3,64,32,20,33,9,32,
    21,33,19,32,5,33,7,3,64,32,19,32,9,42,2,0,56,2,0,32,9,32,24,106,33,9,32,19,65,4,106,
    33,19,32,7,65,127,106,34,7,13,0,11,32,21,32,5,32,26,16,129,128,128,128,0,32,26,33,9,
    32,25,33,19,32,5,33,7,3,64,32,19,32,9,42,2,0,56,2,0,32,9,65,4,106,33,9,32,19,32,24,
    106,33,19,32,7,65,127,106,34,7,13,0,11,32,25,65,4,106,33,25,32,20,65,4,106,33,20,32,
    15,65,1,106,34,15,32,5,71,13,0,11,11,32,27,32,18,78,13,0,32,17,32,27,65,2,116,106,33,
    7,2,64,32,3,69,13,0,32,5,65,2,116,33,20,32,3,65,2,116,33,21,65,0,33,25,32,29,33,26,3,
    64,32,13,33,9,32,26,33,19,32,3,33,24,3,64,32,19,32,9,42,2,0,56,2,0,32,9,65,4,106,33,
    9,32,19,65,4,106,33,19,32,24,65,127,106,34,24,13,0,11,32,13,32,20,106,33,13,32,26,32,
    21,106,33,26,32,25,65,1,106,34,25,32,3,71,13,0,11,67,0,0,0,0,33,10,2,64,32,27,65,2,
    73,13,0,32,27,32,1,65,0,32,7,107,65,3,113,32,7,106,34,13,107,65,4,109,74,13,2,32,29,
    65,4,106,33,9,32,13,33,19,32,27,65,127,106,34,25,33,24,3,64,32,19,32,9,42,2,0,56,2,0,
    32,9,65,4,106,33,9,32,19,65,4,106,33,19,32,24,65,127,106,34,24,13,0,11,65,0,33,9,2,
    64,32,27,65,2,70,13,0,32,13,33,26,65,1,33,24,3,64,32,13,32,24,65,2,116,106,42,2,0,33,
    28,32,26,33,9,32,24,33,19,2,64,3,64,32,9,42,2,0,34,10,32,28,94,69,13,1,32,9,65,4,106,
    32,10,56,2,0,32,9,65,124,106,33,9,32,19,65,127,106,34,19,65,1,106,65,1,74,13,0,11,65,
    0,33,19,11,32,13,32,19,65,2,116,106,32,28,56,2,0,32,26,65,4,106,33,26,32,24,65,1,106,
    34,24,32,25,71,13,0,11,32,25,65,1,118,33,9,32,25,65,1,113,13,0,32,13,32,9,65,2,116,
    106,34,9,65,124,106,42,2,0,32,9,42,2,0,146,67,0,0,0,63,148,33,10,12,1,11,32,13,32,9,
    65,2,116,106,42,2,0,33,10,11,32,27,32,1,32,7,107,78,13,1,32,7,33,9,32,27,33,19,3,64,
    32,9,32,29,42,2,0,32,10,94,58,0,0,32,29,65,4,106,33,29,32,9,65,1,106,33,9,32,19,65,
    127,106,34,19,13,0,11,32,0,40,2,20,33,29,65,0,33,26,3,64,65,3,33,19,32,26,33,9,65,0,
    33,24,2,64,3,64,32,9,32,27,79,13,1,32,7,32,9,106,45,0,0,32,19,116,32,24,114,33,24,32,
    9,65,1,106,33,9,32,19,65,127,106,34,19,65,127,71,13,0,11,11,32,29,32,26,65,2,118,106,
    32,24,45,0,128,128,132,128,0,58,0,0,32,26,65,4,106,34,26,32,27,73,13,0,12,3,11,11,32,
    27,32,1,32,7,107,72,13,1,11,0,11,32,27,65,2,118,11,140,2,7,4,125,1,127,2,125,1,127,1,
    125,1,127,2,125,2,64,32,1,69,13,0,67,219,15,73,64,32,1,178,34,3,149,33,4,67,0,0,0,64,
    32,3,149,145,33,5,67,0,0,128,63,32,3,149,145,33,6,65,0,33,7,3,64,32,4,32,7,179,148,
    33,8,67,0,0,0,0,33,9,65,0,33,10,3,64,32,8,32,10,179,67,0,0,0,63,146,148,34,3,32,3,67,
    219,15,201,64,149,142,67,219,15,201,192,148,146,34,3,67,219,15,201,192,146,32,3,32,3,
    67,219,15,73,64,94,27,34,3,32,3,140,148,33,11,65,2,33,12,32,0,32,10,65,2,116,106,42,
    2,0,33,13,67,0,0,128,63,33,14,67,0,0,128,63,33,3,3,64,32,3,32,14,32,11,32,12,65,127,
    106,32,12,108,178,149,148,34,14,146,33,3,32,12,65,2,106,34,12,65,26,71,13,0,11,32,13,
    32,3,148,32,9,146,33,9,32,10,65,1,106,34,10,32,1,71,13,0,11,32,2,32,7,65,2,116,106,
    32,5,32,6,32,7,27,32,9,148,56,2,0,32,7,65,1,106,34,7,32,1,71,13,0,11,11,11,11,24,1,0,
    65,128,128,4,11,16,48,49,50,51,52,53,54,55,56,57,97,98,99,100,101,102
  ]`)), { env: { memory } });
  const heapBase = instance.exports.__heap_base.value;
  const mem = new Uint8Array(memory.buffer);
  const i32View = new Int32Array(memory.buffer);
  const decoder = new TextDecoder();

  return function computePhashFromRgba(rgba, width, height, sampleSize, hashSize) {
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
  let path = moreSvg.appendChild(document.createElementNS(ns, "g")).appendChild(document.createElementNS(ns, "path"));
  const closeSvg = moreSvg.cloneNode(true);
  const cogSvg = moreSvg.cloneNode(true);
  path.setAttribute("d", `M3 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 2c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2${
                    " "}.9 2 2 2zm7 0c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z`);
  path = closeSvg.firstElementChild.firstElementChild;
  path.setAttribute("d", `M10.59 12L4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04-1.42 1.42L12${
                    " "}13.41l-6.04 6.05-1.42-1.42L10.59 12z`);
  path = cogSvg.firstElementChild.firstElementChild;
  path.setAttribute("d", `M10.54 1.75h2.92l1.57 2.36c.11.17.32.25.53.21l2.53-.59 2.17 2.17-.58${
                    " "}2.54c-.05.2.04.41.21.53l2.36 1.57v2.92l-2.36 1.57c-.17.12-.26.33-.21.53l.58 2.54-2.17${
                    " "}2.17-2.53-.59c-.21-.04-.42.04-.53.21l-1.57${
                    " "}2.36h-2.92l-1.58-2.36c-.11-.17-.32-.25-.52-.21l-2.54.59-2.17-2.17.58-2.54c.05-.2-.03-.41-.21-.53l-2.35-1.57v-2.92L4.1${
                    " "}8.97c.18-.12.26-.33.21-.53L3.73 5.9 5.9 3.73l2.54.59c.2.04.41-.04.52-.21l1.58-2.36zm1.07 2l-.98${
                    " "}1.47C10.05 6.08 9 6.5 7.99 6.27l-1.46-.34-.6.6.33 1.46c.24 1.01-.18 2.07-1.05 2.64l-1.46.98v.78l1.46.98c.87.57${
                    " "}1.29 1.63 1.05 2.64l-.33 1.46.6.6 1.46-.34c1.01-.23 2.06.19 2.64 1.05l.98 1.47h.78l.97-1.47c.58-.86 1.63-1.28${
                    " "}2.65-1.05l1.45.34.61-.6-.34-1.46c-.23-1.01.18-2.07${
                    " "}1.05-2.64l1.47-.98v-.78l-1.47-.98c-.87-.57-1.28-1.63-1.05-2.64l.34-1.46-.61-.6-1.45.34c-1.02.23-2.07-.19-2.65-1.05l-.97-1.47h-.78zM12${
                    " "}10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5c.82 0 1.5-.67 1.5-1.5s-.68-1.5-1.5-1.5zM8.5${
                    " "}12c0-1.93 1.56-3.5 3.5-3.5 1.93 0 3.5 1.57 3.5 3.5s-1.57 3.5-3.5 3.5c-1.94 0-3.5-1.57-3.5-3.5z`);
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
  transform: translateY(-1px);
  display: inline-block;
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
.dedupe-dialog-header,
.dedupe-dialog-footer {
  min-height: 53px;
  position: relative;
  text-align: center;
}
.dedupe-dialog-body {
  padding: 4px;
  flex-shrink: 1;
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
