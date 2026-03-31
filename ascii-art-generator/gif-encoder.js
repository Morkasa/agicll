class SimpleGIFEncoder {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.frames = [];
    this.delay = 50;
  }

  setDelay(ms) {
    this.delay = ms;
  }

  addFrame(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, this.width, this.height);

    const { palette, indexedPixels } = this._quantize(imageData.data);
    this.frames.push({ palette, indexedPixels, delay: this.delay });
  }

  _quantize(pixels) {
    const colorMap = new Map();
    const palette = [];
    const indexedPixels = new Uint8Array(this.width * this.height);

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i] >> 4;
      const g = pixels[i + 1] >> 4;
      const b = pixels[i + 2] >> 4;
      const key = (r << 8) | (g << 4) | b;

      if (!colorMap.has(key)) {
        if (palette.length >= 255) {
          let closest = 0;
          let minDist = Infinity;
          for (let j = 0; j < palette.length; j++) {
            const dr = palette[j][0] - pixels[i];
            const dg = palette[j][1] - pixels[i + 1];
            const db = palette[j][2] - pixels[i + 2];
            const dist = dr * dr + dg * dg + db * db;
            if (dist < minDist) { minDist = dist; closest = j; }
          }
          indexedPixels[i / 4] = closest;
          continue;
        }
        colorMap.set(key, palette.length);
        palette.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
      }
      indexedPixels[i / 4] = colorMap.get(key);
    }

    while (palette.length < 256) {
      palette.push([0, 0, 0]);
    }

    return { palette, indexedPixels };
  }

  finish() {
    const bytes = [];

    bytes.push(0x47, 0x49, 0x46, 0x38, 0x39, 0x61); // GIF89a

    this._writeShort(bytes, this.width);
    this._writeShort(bytes, this.height);
    bytes.push(0xF7); // GCT flag, 8 bits color res, 256 colors
    bytes.push(0);    // bg color index
    bytes.push(0);    // pixel aspect ratio

    const firstPalette = this.frames[0]?.palette || [];
    for (let i = 0; i < 256; i++) {
      const c = firstPalette[i] || [0, 0, 0];
      bytes.push(c[0], c[1], c[2]);
    }

    bytes.push(0x21, 0xFF, 0x0B);
    const netscape = 'NETSCAPE2.0';
    for (let i = 0; i < netscape.length; i++) bytes.push(netscape.charCodeAt(i));
    bytes.push(3, 1);
    this._writeShort(bytes, 0); // loop forever
    bytes.push(0);

    for (const frame of this.frames) {
      bytes.push(0x21, 0xF9, 0x04);
      bytes.push(0x00); // no transparency
      this._writeShort(bytes, Math.round(frame.delay / 10));
      bytes.push(0);    // transparent color index
      bytes.push(0);    // block terminator

      bytes.push(0x2C);
      this._writeShort(bytes, 0);
      this._writeShort(bytes, 0);
      this._writeShort(bytes, this.width);
      this._writeShort(bytes, this.height);

      if (frame.palette !== firstPalette) {
        bytes.push(0x87);
        for (let i = 0; i < 256; i++) {
          const c = frame.palette[i] || [0, 0, 0];
          bytes.push(c[0], c[1], c[2]);
        }
      } else {
        bytes.push(0x00);
      }

      this._writeLZW(bytes, frame.indexedPixels, 8);
    }

    bytes.push(0x3B); // trailer

    return new Uint8Array(bytes);
  }

  _writeShort(bytes, val) {
    bytes.push(val & 0xFF, (val >> 8) & 0xFF);
  }

  _writeLZW(bytes, pixels, minCodeSize) {
    const CLEAR = 1 << minCodeSize;
    const EOI = CLEAR + 1;
    let codeSize = minCodeSize + 1;
    let nextCode = EOI + 1;
    const MAX_CODE = 4095;

    const table = new Map();
    for (let i = 0; i < CLEAR; i++) {
      table.set(String(i), i);
    }

    bytes.push(minCodeSize);

    let buffer = 0;
    let bufferBits = 0;
    const subBlock = [];

    function outputCode(code) {
      buffer |= code << bufferBits;
      bufferBits += codeSize;
      while (bufferBits >= 8) {
        subBlock.push(buffer & 0xFF);
        buffer >>= 8;
        bufferBits -= 8;
        if (subBlock.length === 255) {
          bytes.push(subBlock.length);
          for (const b of subBlock) bytes.push(b);
          subBlock.length = 0;
        }
      }
    }

    outputCode(CLEAR);

    let prefix = String(pixels[0]);
    for (let i = 1; i < pixels.length; i++) {
      const k = String(pixels[i]);
      const combined = prefix + ',' + k;
      if (table.has(combined)) {
        prefix = combined;
      } else {
        outputCode(table.get(prefix));
        if (nextCode <= MAX_CODE) {
          table.set(combined, nextCode++);
          if (nextCode > (1 << codeSize) && codeSize < 12) {
            codeSize++;
          }
        } else {
          outputCode(CLEAR);
          table.clear();
          for (let j = 0; j < CLEAR; j++) {
            table.set(String(j), j);
          }
          nextCode = EOI + 1;
          codeSize = minCodeSize + 1;
        }
        prefix = k;
      }
    }

    outputCode(table.get(prefix));
    outputCode(EOI);

    if (bufferBits > 0) {
      subBlock.push(buffer & 0xFF);
    }

    if (subBlock.length > 0) {
      bytes.push(subBlock.length);
      for (const b of subBlock) bytes.push(b);
    }

    bytes.push(0);
  }
}
