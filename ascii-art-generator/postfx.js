class PostFX {
  constructor() {
    this._tmpCanvas = document.createElement('canvas');
    this._tmpCtx = this._tmpCanvas.getContext('2d');
    this._dustParticles = this._generateDustParticles();

    this.effects = {
      colorOverlay:  { enabled: false, color: '#ff0000', opacity: 30, blend: 'multiply' },
      vignette:      { enabled: false, intensity: 50 },
      scanLines:     { enabled: false, intensity: 50 },
      crtCurvature:  { enabled: false, intensity: 50 },
      chromatic:     { enabled: false, intensity: 50 },
      bloom:         { enabled: false, intensity: 50 },
      filmGrain:     { enabled: false, intensity: 50 },
      glitchFx:      { enabled: false, intensity: 50 },
      rgbSplit:      { enabled: false, intensity: 50 },
      blur:          { enabled: false, intensity: 50 },
      pixelate:      { enabled: false, intensity: 50 },
      halftone:      { enabled: false, intensity: 50 },
      filmDust:      { enabled: false, intensity: 50 },
    };
  }

  hasAny() {
    return Object.values(this.effects).some(e => e.enabled);
  }

  apply(canvas) {
    if (!this.hasAny()) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    this._tmpCanvas.width = w;
    this._tmpCanvas.height = h;

    if (this.effects.pixelate.enabled)     this._pixelate(ctx, w, h);
    if (this.effects.blur.enabled)         this._blur(ctx, w, h);
    if (this.effects.halftone.enabled)     this._halftone(ctx, w, h);
    if (this.effects.chromatic.enabled)    this._chromatic(ctx, w, h);
    if (this.effects.rgbSplit.enabled)     this._rgbSplit(ctx, w, h);
    if (this.effects.bloom.enabled)        this._bloom(ctx, w, h);
    if (this.effects.glitchFx.enabled)     this._glitch(ctx, w, h);
    if (this.effects.scanLines.enabled)    this._scanLines(ctx, w, h);
    if (this.effects.crtCurvature.enabled) this._crtCurvature(ctx, w, h);
    if (this.effects.filmGrain.enabled)    this._filmGrain(ctx, w, h);
    if (this.effects.colorOverlay.enabled) this._colorOverlay(ctx, w, h);
    if (this.effects.vignette.enabled)     this._vignette(ctx, w, h);
    if (this.effects.filmDust.enabled)     this._filmDust(ctx, w, h);
  }

  // ── Color Overlay ──
  _colorOverlay(ctx, w, h) {
    const e = this.effects.colorOverlay;
    ctx.save();
    ctx.globalCompositeOperation = e.blend;
    ctx.globalAlpha = e.opacity / 100;
    ctx.fillStyle = e.color;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // ── Vignette ──
  _vignette(ctx, w, h) {
    const intensity = this.effects.vignette.intensity / 100;
    const cx = w / 2, cy = h / 2;
    const r = Math.max(cx, cy);
    const grad = ctx.createRadialGradient(cx, cy, r * (0.3 + (1 - intensity) * 0.4), cx, cy, r);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${0.4 + intensity * 0.5})`);
    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // ── Scan Lines ──
  _scanLines(ctx, w, h) {
    const intensity = this.effects.scanLines.intensity / 100;
    const gap = Math.max(2, Math.round(4 - intensity * 2));
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.15 + intensity * 0.35})`;
    for (let y = 0; y < h; y += gap) {
      ctx.fillRect(0, y, w, 1);
    }
    ctx.restore();
  }

  // ── CRT Curvature ──
  _crtCurvature(ctx, w, h) {
    const intensity = this.effects.crtCurvature.intensity / 100;
    const amt = intensity * 0.06;

    const imgData = ctx.getImageData(0, 0, w, h);
    const src = new Uint8ClampedArray(imgData.data);
    const dst = imgData.data;

    const cx = w / 2, cy = h / 2;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let nx = (x - cx) / cx;
        let ny = (y - cy) / cy;
        const r2 = nx * nx + ny * ny;
        nx *= 1 + amt * r2;
        ny *= 1 + amt * r2;
        const sx = Math.round(nx * cx + cx);
        const sy = Math.round(ny * cy + cy);
        const di = (y * w + x) * 4;
        if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
          const si = (sy * w + sx) * 4;
          dst[di] = src[si]; dst[di+1] = src[si+1]; dst[di+2] = src[si+2]; dst[di+3] = src[si+3];
        } else {
          dst[di] = 0; dst[di+1] = 0; dst[di+2] = 0; dst[di+3] = 255;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // ── Chromatic Aberration ──
  _chromatic(ctx, w, h) {
    const shift = Math.round(this.effects.chromatic.intensity / 100 * 8) + 1;
    const imgData = ctx.getImageData(0, 0, w, h);
    const src = new Uint8ClampedArray(imgData.data);
    const dst = imgData.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const di = (y * w + x) * 4;
        const rx = Math.min(w - 1, x + shift);
        const bx = Math.max(0, x - shift);
        dst[di]   = src[(y * w + rx) * 4];
        dst[di+2] = src[(y * w + bx) * 4 + 2];
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // ── Bloom ──
  _bloom(ctx, w, h) {
    const intensity = this.effects.bloom.intensity / 100;
    const tc = this._tmpCtx;
    tc.drawImage(ctx.canvas, 0, 0);

    ctx.save();
    ctx.filter = `blur(${4 + intensity * 12}px) brightness(${1.2 + intensity * 0.8})`;
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.3 + intensity * 0.4;
    ctx.drawImage(this._tmpCanvas, 0, 0);
    ctx.restore();
  }

  // ── Film Grain ──
  _filmGrain(ctx, w, h) {
    const intensity = this.effects.filmGrain.intensity / 100;
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    const amount = 25 + intensity * 60;

    for (let i = 0; i < d.length; i += 4) {
      const noise = (Math.random() - 0.5) * amount;
      d[i]   += noise;
      d[i+1] += noise;
      d[i+2] += noise;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // ── Glitch (post-processing) ──
  _glitch(ctx, w, h) {
    const intensity = this.effects.glitchFx.intensity / 100;
    const sliceCount = Math.floor(3 + intensity * 12);

    for (let i = 0; i < sliceCount; i++) {
      const y = Math.floor(Math.random() * h);
      const sliceH = Math.floor(2 + Math.random() * (10 + intensity * 30));
      const offset = Math.floor((Math.random() - 0.5) * (10 + intensity * 40));
      if (sliceH <= 0) continue;
      const slice = ctx.getImageData(0, y, w, Math.min(sliceH, h - y));
      ctx.putImageData(slice, offset, y);
    }
  }

  // ── RGB Split ──
  _rgbSplit(ctx, w, h) {
    const intensity = this.effects.rgbSplit.intensity / 100;
    const offset = Math.round(2 + intensity * 10);
    const imgData = ctx.getImageData(0, 0, w, h);
    const src = new Uint8ClampedArray(imgData.data);
    const dst = imgData.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const di = (y * w + x) * 4;
        const rxR = Math.min(w - 1, x + offset);
        const rxB = Math.max(0, x - offset);
        const ryG = Math.min(h - 1, y + Math.round(offset / 2));
        dst[di]   = src[(y * w + rxR) * 4];
        dst[di+1] = src[(ryG * w + x) * 4 + 1];
        dst[di+2] = src[(y * w + rxB) * 4 + 2];
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // ── Blur ──
  _blur(ctx, w, h) {
    const intensity = this.effects.blur.intensity / 100;
    const radius = 1 + intensity * 8;
    ctx.save();
    const tc = this._tmpCtx;
    tc.clearRect(0, 0, w, h);
    tc.filter = `blur(${radius}px)`;
    tc.drawImage(ctx.canvas, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this._tmpCanvas, 0, 0);
    ctx.restore();
  }

  // ── Pixelate ──
  _pixelate(ctx, w, h) {
    const intensity = this.effects.pixelate.intensity / 100;
    const size = Math.max(2, Math.round(2 + intensity * 18));
    const tc = this._tmpCtx;
    const sw = Math.max(1, Math.floor(w / size));
    const sh = Math.max(1, Math.floor(h / size));

    tc.clearRect(0, 0, w, h);
    tc.imageSmoothingEnabled = false;
    tc.drawImage(ctx.canvas, 0, 0, sw, sh);

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this._tmpCanvas, 0, 0, sw, sh, 0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
  }

  // ── Halftone ──
  _halftone(ctx, w, h) {
    const intensity = this.effects.halftone.intensity / 100;
    const dotSpacing = Math.max(3, Math.round(4 + (1 - intensity) * 10));
    const maxR = dotSpacing * 0.5;

    const imgData = ctx.getImageData(0, 0, w, h);
    const src = imgData.data;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    for (let y = 0; y < h; y += dotSpacing) {
      for (let x = 0; x < w; x += dotSpacing) {
        const px = Math.min(x, w - 1);
        const py = Math.min(y, h - 1);
        const i = (py * w + px) * 4;
        const lum = (src[i] * 0.299 + src[i+1] * 0.587 + src[i+2] * 0.114) / 255;
        const r = maxR * lum;
        if (r > 0.3) {
          ctx.fillStyle = `rgb(${src[i]},${src[i+1]},${src[i+2]})`;
          ctx.beginPath();
          ctx.arc(x + dotSpacing / 2, y + dotSpacing / 2, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // ── Film Dust ──
  _generateDustParticles() {
    const particles = [];
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random(), y: Math.random(),
        size: 0.5 + Math.random() * 2.5,
        opacity: 0.1 + Math.random() * 0.6,
        type: Math.random() > 0.7 ? 'scratch' : 'dot',
        angle: Math.random() * Math.PI,
        len: 10 + Math.random() * 40,
      });
    }
    return particles;
  }

  _filmDust(ctx, w, h) {
    const intensity = this.effects.filmDust.intensity / 100;
    const count = Math.floor(intensity * this._dustParticles.length);
    ctx.save();

    if (Math.random() < 0.3) {
      this._dustParticles = this._generateDustParticles();
    }

    for (let i = 0; i < count; i++) {
      const p = this._dustParticles[i];
      const px = p.x * w, py = p.y * h;

      if (p.type === 'scratch') {
        ctx.strokeStyle = `rgba(255,255,255,${p.opacity * 0.4 * intensity})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(p.angle) * p.len, py + Math.sin(p.angle) * p.len);
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(255,255,255,${p.opacity * intensity})`;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
