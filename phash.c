/* SPDX-License-Identifier: GPL-3.0 */

/* clang-format off */
/*
clang --target=wasm32-unknown-unknown -std=c89 -nostdlib -Os -Wl,--no-entry,--strip-all,--export=computePhashFromRgba,--export=__heap_base,--import-memory,--stack-first -o phash.wasm phash.c
llvm-objcopy --remove-section=producers --remove-section=target_features phash.wasm
*/
/* clang-format on */

#include <stddef.h>

typedef unsigned char u8;
typedef int i32;
typedef ptrdiff_t iz;
typedef size_t uz;
typedef float f32;

#define sizeof(x) ((iz)sizeof(x))
#define alignof(x) ((iz) __alignof__(x))

#define assert(c) \
  do { \
    if (__builtin_expect(!(c), 0)) { \
      __builtin_trap(); \
    } \
  } while (0)

#define assume(c) \
  do { \
    if (!(c)) { \
      __builtin_unreachable(); \
    } \
  } while (0)

static void* memcpy(void* dst, void const* src, iz size)
{
  __asm__ volatile(
      "local.get %0\n"
      "local.get %1\n"
      "local.get %2\n"
      "memory.copy 0, 0"
      : "+r"(dst)
      : "r"(src), "r"(size)
      : "memory");
  return dst;
}

struct arena
{
  u8* beg;
  u8* end;
};

#define new(arena, count, T) ((T*)alloc(arena, count, sizeof(T), alignof(T)))

static void* alloc(struct arena* arena, iz count, iz size, iz align)
{
  u8* mem = arena->beg;
  iz pad = (iz) - (uz)mem & (align - 1);
  assert(count >= 0);
  assert(count < (arena->end - mem - pad) / size);

  arena->beg += pad + count * size;
  {
    void* r = mem + pad;
    __asm__("" : "+r"(r));
    return r;
  }
}

static f32 sqrt(f32 x)
{
  return __builtin_sqrtf(x);
}

static f32 floor(f32 x)
{
  return __builtin_floorf(x);
}

static f32 round(f32 x)
{
  return __builtin_nearbyintf(x);
}

/* minimax degree-7 sine, x in [0, pi/2] */
static f32 sin(f32 x)
{
  f32 x2 = x * x;
  return x
      * (0.99999906f
         + x2 * (-0.16665554f + x2 * (0.00831190f - 0.00018488f * x2)));
}

static f32 cos(f32 x)
{
  f32 pi = 3.14159265f;
  f32 twopi = 2.0f * pi;
  f32 halfpi = pi * 0.5f;
  f32 t, sign;

  x = x - floor(x * (1.0f / twopi)) * twopi;
  if (x > pi) {
    x -= twopi;
  }
  if (x < 0.0f) {
    x = -x;
  }

  t = halfpi - x;
  sign = 1.0f;
  if (t < 0.0f) {
    t = -t;
    sign = -1.0f;
  }

  return sign * sin(t);
}

static i32 imax(i32 a, i32 b)
{
  return a > b ? a : b;
}

static i32 imin(i32 a, i32 b)
{
  return a < b ? a : b;
}

static void resizeRgbaToSquare(
    u8* rgba, i32 width, i32 height, i32 size, u8* output)
{
  f32 sizerecip = 1.0f / (f32)size;
  f32 xRatio = (f32)width * sizerecip;
  f32 yRatio = (f32)height * sizerecip;
  i32 ys = 0;
  i32 y = 0;
  assume(size != 0);
  for (;; ys += size) {
    f32 srcY = ((f32)y + 0.5f) * yRatio - 0.5f;
    i32 y0 = imax(0, (i32)floor(srcY));
    i32 y1 = imin(height - 1, y0 + 1);
    i32 y0w = y0 * width;
    i32 y1w = y1 * width;
    f32 wy = srcY - (f32)y0;
    i32 x = 0;
    for (; x != size; ++x) {
      f32 srcX = ((f32)x + 0.5f) * xRatio - 0.5f;
      i32 x0 = imax(0, (i32)floor(srcX));
      i32 x1 = imin(width - 1, x0 + 1);
      f32 wx = srcX - (f32)x0;
      i32 base = (ys + x) << 2;
      i32 idx00 = (y0w + x0) << 2;
      i32 idx10 = (y0w + x1) << 2;
      i32 idx01 = (y1w + x0) << 2;
      i32 idx11 = (y1w + x1) << 2;
      i32 c = 0;
      for (; c != 4; ++c) {
        f32 top =
            (f32)rgba[idx00 + c] * (1.0f - wx) + (f32)rgba[idx10 + c] * wx;
        f32 bottom =
            (f32)rgba[idx01 + c] * (1.0f - wx) + (f32)rgba[idx11 + c] * wx;
        f32 val = top * (1.0f - wy) + bottom * wy;
        i32 rounded = (i32)round(val);
        output[base + c] =
            (u8)(rounded < 0 ? 0 : (rounded > 255 ? 255 : rounded));
      }
    }
    if (++y == size) {
      break;
    }
  }
}

static void grayscale(u8* data, i32 width, i32 height, f32* matrix)
{
  i32 base = 0;
  i32 y = 0;
  assume(height != 0);
  assume(width != 0);
  for (;; base += width) {
    i32 x = 0;
    for (; x != width; ++x) {
      i32 i = base + x;
      i32 idx = i << 2;
      f32 r = (f32)data[idx];
      f32 g = (f32)data[idx + 1];
      f32 b = (f32)data[idx + 2];
      matrix[i] = 0.299f * r + 0.587f * g + 0.114f * b;
    }
    if (++y == height) {
      break;
    }
  }
}

static void dct1d(f32* vector, i32 size, f32* result)
{
  f32 pi = 3.14159265f;
  f32 sizerecip = 1.0f / (f32)size;
  f32 factor = pi * sizerecip;
  f32 scale0 = sqrt(sizerecip);
  f32 scale = sqrt(2.0f * sizerecip);
  f32 factored = 0.0f;
  i32 u = 0;
  assume(size != 0);
  for (;; factored += factor) {
    f32 sum = 0.0f;
    i32 x = 0;
    for (; x != size; ++x) {
      sum += vector[x] * cos(((f32)x + 0.5f) * factored);
    }
    result[u] = (u == 0 ? scale0 : scale) * sum;
    if (++u == size) {
      break;
    }
  }
}

static void dct2(f32* matrix, i32 size, f32* result, struct arena scratch)
{
  f32* temp = new (&scratch, size * size, f32);
  f32* row = new (&scratch, size, f32);
  f32* column = new (&scratch, size, f32);
  assume(size != 0);

  {
    i32 ys = 0;
    i32 y = 0;
    for (;; ys += size) {
      dct1d(matrix + ys, size, row);
      memcpy(temp + ys, row, size * sizeof(f32));
      if (++y == size) {
        break;
      }
    }
  }

  {
    i32 x = 0;
    for (; x != size; ++x) {
      i32 vs = 0;
      i32 v = 0;
      for (;; vs += size) {
        column[v] = temp[vs + x];
        if (++v == size) {
          break;
        }
      }
      dct1d(column, size, row);
      for (vs = 0, v = 0;; vs += size) {
        result[vs + x] = row[v];
        if (++v == size) {
          break;
        }
      }
    }
  }
}

static void extractTopBlock(f32* matrix,
                            i32 srcSize,
                            i32 blockSize,
                            f32* block)
{
  i32 x = 0;
  assume(blockSize != 0);
  for (;; block += blockSize, matrix += srcSize) {
    memcpy(block, matrix, blockSize * sizeof(f32));
    if (++x == blockSize) {
      return;
    }
  }
}

static f32 computeThreshold(f32* matrix, i32 len, struct arena scratch)
{
  i32 i;
  f32* values;
  i32 vlen;

  if (len <= 1) {
    return 0.0f;
  }

  vlen = len - 1;
  values = new (&scratch, vlen, f32);
  memcpy(values, matrix, vlen);
  for (i = 1; i != vlen; ++i) {
    f32 key = values[i];
    i32 j = i - 1;
    for (; values[j] > key; --j) {
      values[j + 1] = values[j];
      if (j == 0) {
        break;
      }
    }
    values[j + 1] = key;
  }
  {
    i32 mid = vlen >> 1;
    if (vlen & 1) {
      return values[mid];
    }
    return (values[mid - 1] + values[mid]) * 0.5f;
  }
}

static void bitsToHex(u8* bits, i32 nbits, u8* output)
{
  static u8 const hexDigits[16] = "0123456789abcdef";
  i32 i = 0;
  for (; i < nbits; i += 4) {
    i32 value = 0;
    i32 j = 0;
    for (; j < 4 && (i + j) < nbits; ++j) {
      value |= (i32)bits[i + j] << (3 - j);
    }
    output[i >> 2] = hexDigits[value];
  }
}

i32 computePhashFromRgba(u8* rgba,
                         i32 width,
                         i32 height,
                         i32 sampleSize,
                         i32 hashSize,
                         u8* output,
                         u8* heapStart)
{
  struct arena a;
  i32 blockLen = hashSize * hashSize;
  i32 hexLength = blockLen >> 2;
  u8* sample;
  f32* gray;
  f32* dctResult;
  f32* top;
  f32 threshold;
  u8* bits;
  i32 sampleCount = sampleSize * sampleSize;

  a.beg = heapStart;
  a.end = (u8*)(__builtin_wasm_memory_size(0) << 16);

  if (width == sampleSize && height == sampleSize) {
    sample = rgba;
  } else {
    sample = new (&a, sampleCount << 2, u8);
    resizeRgbaToSquare(rgba, width, height, sampleSize, sample);
  }

  gray = new (&a, sampleCount, f32);
  grayscale(sample, sampleSize, sampleSize, gray);

  dctResult = new (&a, sampleCount, f32);
  dct2(gray, sampleSize, dctResult, a);

  top = new (&a, blockLen, f32);
  extractTopBlock(dctResult, sampleSize, hashSize, top);

  threshold = computeThreshold(top, blockLen, a);
  bits = new (&a, blockLen, u8);
  {
    i32 i = 0;
    for (; i != blockLen; ++i) {
      bits[i] = top[i] > threshold ? 1 : 0;
    }
  }

  bitsToHex(bits, blockLen, output);

  return hexLength;
}
