const CHAR_SETS = {
  dense:   ' .\'`^",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
  classic: ' .:-=+*#%@',
  digits:  ' 0123456789',
  minimal: ' .:*',
  blocks:  ' ░▒▓█',
  custom:  ' .:-=+*#%@',
};

class ASCIIEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sourceImage = null;
    this.sourceVideo = null;
    this.isAnimatedSource = false;
    this.imageData = null;
    this.edgeData = null;
    this.asciiGrid = null;
    this.colorGrid = null;
    this._ditherAnimStart = 0;

    this._tmpCanvas = document.createElement('canvas');
    this._tmpCtx = this._tmpCanvas.getContext('2d');
    this._frameW = 0;
    this._frameH = 0;

    this.params = {
      renderMode: 'ascii',
      style: 'dense',
      customChars: '',
      fontSize: 6,
      coverage: 100,
      edgeEmphasis: 80,
      opacity: 60,
      brightness: 20,
      contrast: 40,
      invert: false,
      dotGrid: false,
      bgBlur: 4,
      bgOpacity: 80,
      bgColor: '#0a0a0a',
      glitchRgbShift: 8,
      glitchScanlines: 40,
      glitchBlock: 30,
      glitchNoise: 15,
      glitchColorShift: 20,
      ditherType: 'bayer8',
      ditherOriginalColors: false,
      ditherInvert: false,
      ditherSize: 2,
      ditherColorSteps: 2,
      ditherFgColors: ['#94FFAF', '#EAFF94'],
      ditherBgColor: '#000C38',
      ditherAnimEnabled: false,
      ditherAnimType: 'shift',
      ditherAnimSpeed: 50,
      ditherAnimIntensity: 50,
    };
  }

  getCharSet() {
    if (this.params.style === 'custom' && this.params.customChars.length > 1) {
      return this.params.customChars;
    }
    return CHAR_SETS[this.params.style] || CHAR_SETS.dense;
  }

  loadImage(img) {
    this.sourceVideo = null;
    this.isAnimatedSource = false;
    this.sourceImage = img;
    this._initFrameSize(img.naturalWidth || img.width, img.naturalHeight || img.height);
    this._captureFrame(img);
  }

  loadAnimatedImage(img) {
    this.sourceVideo = null;
    this.sourceImage = img;
    this.isAnimatedSource = true;
    this._initFrameSize(img.naturalWidth || img.width, img.naturalHeight || img.height);
    this._captureFrame(img);
  }

  loadVideo(video) {
    this.sourceImage = null;
    this.sourceVideo = video;
    this.isAnimatedSource = true;
    this._initFrameSize(video.videoWidth, video.videoHeight);
    this._captureFrame(video);
  }

  _initFrameSize(srcW, srcH) {
    const maxDim = 1200;
    const scale = Math.min(maxDim / srcW, maxDim / srcH, 1);
    this._frameW = Math.floor(srcW * scale);
    this._frameH = Math.floor(srcH * scale);
    this._tmpCanvas.width = this._frameW;
    this._tmpCanvas.height = this._frameH;
  }

  _captureFrame(source) {
    const w = this._frameW;
    const h = this._frameH;
    if (w < 1 || h < 1) return;
    this._tmpCtx.drawImage(source, 0, 0, w, h);
    this.imageData = this._tmpCtx.getImageData(0, 0, w, h);
    this._computeEdges(w, h);
  }

  updateFrame() {
    const source = this.sourceVideo || this.sourceImage;
    if (!source) return;
    if (this.sourceVideo && this.sourceVideo.readyState < 2) return;
    this._captureFrame(source);
  }

  getDrawableSource() {
    return this.sourceVideo || this.sourceImage;
  }

  _computeEdges(w, h) {
    const src = this.imageData.data;
    const gray = new Float32Array(w * h);

    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      gray[i] = 0.299 * src[idx] + 0.587 * src[idx + 1] + 0.114 * src[idx + 2];
    }

    this.edgeData = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const gx =
          -gray[(y - 1) * w + (x - 1)] + gray[(y - 1) * w + (x + 1)]
          - 2 * gray[y * w + (x - 1)] + 2 * gray[y * w + (x + 1)]
          - gray[(y + 1) * w + (x - 1)] + gray[(y + 1) * w + (x + 1)];
        const gy =
          -gray[(y - 1) * w + (x - 1)] - 2 * gray[(y - 1) * w + x] - gray[(y - 1) * w + (x + 1)]
          + gray[(y + 1) * w + (x - 1)] + 2 * gray[(y + 1) * w + x] + gray[(y + 1) * w + (x + 1)];
        this.edgeData[y * w + x] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
      }
    }
  }

  _applyBrightnessContrast(value) {
    let v = value + this.params.brightness * 2.55;
    const factor = (259 * (this.params.contrast * 2.55 + 255)) / (255 * (259 - this.params.contrast * 2.55));
    v = factor * (v - 128) + 128;
    return Math.max(0, Math.min(255, v));
  }

  render(animOffsets) {
    if (!this.imageData) return;

    switch (this.params.renderMode) {
      case 'dithering': return this.renderDithering();
      case 'glitch': return this.renderGlitch();
    }

    const { width: imgW, height: imgH, data: imgData } = this.imageData;
    const fontSize = Math.max(2, this.params.fontSize);
    const charAspect = 0.55;
    const cellW = fontSize * charAspect;
    const cellH = fontSize;

    const cols = Math.floor(imgW / cellW);
    const rows = Math.floor(imgH / cellH);

    if (cols < 1 || rows < 1) return;

    const canvasW = Math.ceil(cols * cellW);
    const canvasH = Math.ceil(rows * cellH);
    this.canvas.width = canvasW;
    this.canvas.height = canvasH;

    const ctx = this.ctx;
    const charSet = this.getCharSet();
    const charLen = charSet.length;

    ctx.fillStyle = this.params.bgColor;
    ctx.fillRect(0, 0, canvasW, canvasH);

    if (this.params.bgOpacity > 0) {
      ctx.save();
      if (this.params.bgBlur > 0) {
        ctx.filter = `blur(${this.params.bgBlur}px)`;
      }
      ctx.globalAlpha = this.params.bgOpacity / 100;
      ctx.drawImage(this.getDrawableSource(), 0, 0, canvasW, canvasH);
      ctx.restore();
    }

    ctx.font = `${fontSize}px "Courier New", monospace`;
    ctx.textBaseline = 'top';

    const coverageThreshold = 1 - this.params.coverage / 100;
    const edgeFactor = this.params.edgeEmphasis / 100;
    const charOpacity = this.params.opacity / 100;

    this.asciiGrid = [];
    this.colorGrid = [];

    for (let row = 0; row < rows; row++) {
      const asciiRow = [];
      const colorRow = [];
      for (let col = 0; col < cols; col++) {
        const sx = Math.floor(col * cellW);
        const sy = Math.floor(row * cellH);

        const px = Math.min(sx, imgW - 1);
        const py = Math.min(sy, imgH - 1);
        const pixIdx = (py * imgW + px) * 4;

        let r = imgData[pixIdx];
        let g = imgData[pixIdx + 1];
        let b = imgData[pixIdx + 2];

        let brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        brightness = this._applyBrightnessContrast(brightness);

        const edgeVal = this.edgeData ? this.edgeData[py * imgW + px] / 255 : 0;
        brightness = brightness * (1 - edgeFactor) + (brightness + edgeVal * 255 * 0.5) * edgeFactor;
        brightness = Math.max(0, Math.min(255, brightness));

        if (this.params.invert) {
          brightness = 255 - brightness;
        }

        const normalizedBrightness = brightness / 255;

        if (normalizedBrightness < coverageThreshold) {
          asciiRow.push(' ');
          colorRow.push(null);
          continue;
        }

        let charIndex = Math.floor(normalizedBrightness * (charLen - 1));

        if (animOffsets && animOffsets[row] && animOffsets[row][col] !== undefined) {
          const offset = animOffsets[row][col];
          if (typeof offset === 'number') {
            charIndex = Math.max(0, Math.min(charLen - 1, charIndex + Math.round(offset)));
          } else if (typeof offset === 'object') {
            if (offset.char !== undefined) {
              asciiRow.push(offset.char);
              colorRow.push(offset.color || `rgba(${r},${g},${b},${charOpacity})`);
              continue;
            }
          }
        }

        let char;
        if (this.params.dotGrid) {
          char = normalizedBrightness > 0.1 ? '·' : ' ';
        } else {
          char = charSet[charIndex] || ' ';
        }

        asciiRow.push(char);
        colorRow.push(`rgba(${r},${g},${b},${charOpacity})`);
      }
      this.asciiGrid.push(asciiRow);
      this.colorGrid.push(colorRow);
    }

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const char = this.asciiGrid[row][col];
        const color = this.colorGrid[row][col];
        if (char === ' ' || !color) continue;

        ctx.fillStyle = color;
        const x = col * cellW;
        const y = row * cellH;
        ctx.fillText(char, x, y);
      }
    }
  }

  renderPreview(previewCanvas) {
    if (!this.imageData) return;
    const pCtx = previewCanvas.getContext('2d');
    const pw = previewCanvas.width;
    const ph = previewCanvas.height;

    pCtx.fillStyle = '#111';
    pCtx.fillRect(0, 0, pw, ph);

    const fontSize = 3;
    const charAspect = 0.55;
    const cellW = fontSize * charAspect;
    const cellH = fontSize;
    const { width: imgW, height: imgH, data: imgData } = this.imageData;
    const cols = Math.floor(pw / cellW);
    const rows = Math.floor(ph / cellH);
    const charSet = this.getCharSet();
    const charLen = charSet.length;

    pCtx.font = `${fontSize}px "Courier New", monospace`;
    pCtx.textBaseline = 'top';

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const sx = Math.floor((col / cols) * imgW);
        const sy = Math.floor((row / rows) * imgH);
        const pixIdx = (sy * imgW + sx) * 4;
        const r = imgData[pixIdx], g = imgData[pixIdx + 1], b = imgData[pixIdx + 2];
        let brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const charIndex = Math.floor(brightness * (charLen - 1));
        const char = charSet[charIndex];
        if (char === ' ') continue;
        pCtx.fillStyle = `rgba(${r},${g},${b},0.8)`;
        pCtx.fillText(char, col * cellW, row * cellH);
      }
    }
  }

  renderGlitch() {
    const { width: imgW, height: imgH } = this.imageData;
    this.canvas.width = imgW;
    this.canvas.height = imgH;
    this.asciiGrid = null;
    this.colorGrid = null;
    const ctx = this.ctx;
    const p = this.params;

    ctx.putImageData(this.imageData, 0, 0);

    if (p.glitchBlock > 0) {
      const n = 1 + Math.floor(p.glitchBlock / 8);
      for (let i = 0; i < n; i++) {
        const by = Math.floor(Math.random() * imgH);
        const bh = Math.min(2 + Math.floor(Math.random() * (5 + p.glitchBlock / 5)), imgH - by);
        if (bh > 0) {
          const bd = ctx.getImageData(0, by, imgW, bh);
          ctx.putImageData(bd, Math.floor((Math.random() - 0.5) * p.glitchBlock * 0.6), by);
        }
      }
    }

    if (p.glitchRgbShift > 0) {
      const sd = ctx.getImageData(0, 0, imgW, imgH);
      const s = sd.data;
      const od = ctx.createImageData(imgW, imgH);
      const o = od.data;
      const sh = p.glitchRgbShift;
      for (let y = 0; y < imgH; y++) {
        for (let x = 0; x < imgW; x++) {
          const i = (y * imgW + x) * 4;
          o[i]     = s[(y * imgW + Math.max(0, x - sh)) * 4];
          o[i + 1] = s[i + 1];
          o[i + 2] = s[(y * imgW + Math.min(imgW - 1, x + sh)) * 4 + 2];
          o[i + 3] = 255;
        }
      }
      ctx.putImageData(od, 0, 0);
    }

    if (p.glitchScanlines > 0) {
      ctx.fillStyle = `rgba(0,0,0,${p.glitchScanlines / 150})`;
      for (let y = 0; y < imgH; y += 2) ctx.fillRect(0, y, imgW, 1);
    }

    if (p.glitchNoise > 0) {
      const nd = ctx.getImageData(0, 0, imgW, imgH);
      const d = nd.data;
      const prob = p.glitchNoise / 500;
      for (let i = 0; i < d.length; i += 4) {
        if (Math.random() < prob) {
          d[i] = Math.random() * 255;
          d[i + 1] = Math.random() * 255;
          d[i + 2] = Math.random() * 255;
        }
      }
      ctx.putImageData(nd, 0, 0);
    }

    if (p.glitchColorShift > 0) {
      const cd = ctx.getImageData(0, 0, imgW, imgH);
      const c = cd.data;
      const nb = Math.floor(p.glitchColorShift / 15) + 1;
      for (let b = 0; b < nb; b++) {
        const by = Math.floor(Math.random() * imgH);
        const bh = 3 + Math.floor(Math.random() * 10);
        const sw = Math.floor(Math.random() * 3);
        for (let y = by; y < Math.min(by + bh, imgH); y++) {
          for (let x = 0; x < imgW; x++) {
            const i = (y * imgW + x) * 4;
            const r = c[i], g = c[i + 1], bl = c[i + 2];
            if (sw === 0) { c[i] = g; c[i + 1] = bl; c[i + 2] = r; }
            else if (sw === 1) { c[i] = bl; c[i + 1] = r; c[i + 2] = g; }
            else { c[i] = 255 - r; }
          }
        }
      }
      ctx.putImageData(cd, 0, 0);
    }
  }

  renderDithering() {
    const { width: imgW, height: imgH, data: imgData } = this.imageData;
    this.canvas.width = imgW;
    this.canvas.height = imgH;
    this.asciiGrid = null;
    this.colorGrid = null;

    const ctx = this.ctx;
    const output = ctx.createImageData(imgW, imgH);
    const out = output.data;

    const isRandom = this.params.ditherType === 'random';
    const matrix = isRandom ? null : this._getDitherMatrix(this.params.ditherType);
    const mSize = matrix ? matrix.length : 0;
    const mMax = mSize * mSize;
    const size = Math.max(1, this.params.ditherSize);
    const steps = Math.max(2, this.params.ditherColorSteps);
    const invert = this.params.ditherInvert;
    const useOriginal = this.params.ditherOriginalColors;

    const bgColor = this._hexToRgb(this.params.ditherBgColor);
    const fgColors = this.params.ditherFgColors.map(c => this._hexToRgb(c));
    const palette = [bgColor, ...fgColors];
    const numColors = palette.length;

    let animTime = 0;
    if (this.params.ditherAnimEnabled) {
      animTime = (performance.now() - this._ditherAnimStart) / 1000;
    }
    const aSpeed = this.params.ditherAnimSpeed / 50;
    const aInt = this.params.ditherAnimIntensity / 50;

    for (let y = 0; y < imgH; y++) {
      for (let x = 0; x < imgW; x++) {
        const idx = (y * imgW + x) * 4;
        const r = imgData[idx];
        const g = imgData[idx + 1];
        const b = imgData[idx + 2];

        let threshold = isRandom
          ? Math.random()
          : matrix[Math.floor(y / size) % mSize][Math.floor(x / size) % mSize] / mMax;

        if (this.params.ditherAnimEnabled) {
          switch (this.params.ditherAnimType) {
            case 'shift': {
              const s = Math.sin((x + y) * 0.02 + animTime * aSpeed * 3) * 0.2 * aInt;
              threshold = ((threshold + s) % 1 + 1) % 1;
              break;
            }
            case 'pulse': {
              const p = Math.sin(animTime * aSpeed * 4) * 0.35 * aInt;
              threshold = Math.max(0, Math.min(1, threshold + p));
              break;
            }
            case 'noise': {
              threshold = Math.max(0, Math.min(1,
                threshold + (Math.random() - 0.5) * 0.5 * aInt));
              break;
            }
            case 'wave': {
              const w = Math.sin(x * 0.05 + animTime * aSpeed * 2) *
                        Math.cos(y * 0.03 + animTime * aSpeed * 1.5) * 0.3 * aInt;
              threshold = ((threshold + w) % 1 + 1) % 1;
              break;
            }
          }
        }

        if (useOriginal) {
          const qr = this._quantizeCh(this._applyBrightnessContrast(invert ? 255 - r : r) / 255, steps, threshold);
          const qg = this._quantizeCh(this._applyBrightnessContrast(invert ? 255 - g : g) / 255, steps, threshold);
          const qb = this._quantizeCh(this._applyBrightnessContrast(invert ? 255 - b : b) / 255, steps, threshold);
          out[idx]     = Math.round(qr * 255);
          out[idx + 1] = Math.round(qg * 255);
          out[idx + 2] = Math.round(qb * 255);
        } else {
          let gray = this._applyBrightnessContrast(0.299 * r + 0.587 * g + 0.114 * b);
          if (invert) gray = 255 - gray;
          const norm = gray / 255;
          const levelF = norm * (numColors - 1);
          const lo = Math.floor(levelF);
          const hi = Math.min(lo + 1, numColors - 1);
          const c = (levelF - lo) > threshold ? palette[hi] : palette[lo];
          out[idx]     = c.r;
          out[idx + 1] = c.g;
          out[idx + 2] = c.b;
        }
        out[idx + 3] = 255;
      }
    }

    ctx.putImageData(output, 0, 0);
  }

  _quantizeCh(val, steps, threshold) {
    const lf = val * (steps - 1);
    const lo = Math.floor(lf);
    const hi = Math.min(lo + 1, steps - 1);
    return ((lf - lo) > threshold ? hi : lo) / (steps - 1);
  }

  _getDitherMatrix(type) {
    switch (type) {
      case 'bayer2':
        return [[0, 2], [3, 1]];
      case 'bayer4':
        return [
          [ 0,  8,  2, 10], [12,  4, 14,  6],
          [ 3, 11,  1,  9], [15,  7, 13,  5],
        ];
      case 'bayer8':
      default:
        return [
          [ 0, 32,  8, 40,  2, 34, 10, 42],
          [48, 16, 56, 24, 50, 18, 58, 26],
          [12, 44,  4, 36, 14, 46,  6, 38],
          [60, 28, 52, 20, 62, 30, 54, 22],
          [ 3, 35, 11, 43,  1, 33,  9, 41],
          [51, 19, 59, 27, 49, 17, 57, 25],
          [15, 47,  7, 39, 13, 45,  5, 37],
          [63, 31, 55, 23, 61, 29, 53, 21],
        ];
    }
  }

  _hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m
      ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
      : { r: 0, g: 0, b: 0 };
  }

  getASCIIText() {
    if (!this.asciiGrid) return '';
    return this.asciiGrid.map(row => row.join('')).join('\n');
  }

  getGridDimensions() {
    if (this.asciiGrid && this.asciiGrid.length > 0) {
      return {
        rows: this.asciiGrid.length,
        cols: this.asciiGrid[0]?.length || 0,
      };
    }
    if (!this.imageData) return { rows: 0, cols: 0 };
    const fontSize = Math.max(2, this.params.fontSize);
    const cellW = fontSize * 0.55;
    const cellH = fontSize;
    return {
      rows: Math.floor(this.imageData.height / cellH),
      cols: Math.floor(this.imageData.width / cellW),
    };
  }
}
