class AnimationController {
  constructor() {
    this.type = 'wave';
    this.speed = 50;
    this.intensity = 50;
    this.enabled = false;
    this.frame = 0;
    this._startTime = 0;
    this._rainDrops = null;
    this._typingProgress = 0;
    this._glitchTimer = 0;
  }

  reset() {
    this.frame = 0;
    this._startTime = performance.now();
    this._rainDrops = null;
    this._typingProgress = 0;
    this._glitchTimer = 0;
  }

  getOffsets(rows, cols) {
    if (!this.enabled || rows === 0 || cols === 0) return null;

    this.frame++;
    const t = this.frame * (this.speed / 500);
    const intensity = this.intensity / 50;

    switch (this.type) {
      case 'wave': return this._wave(rows, cols, t, intensity);
      case 'matrix': return this._matrix(rows, cols, t, intensity);
      case 'glitch': return this._glitch(rows, cols, t, intensity);
      case 'pulse': return this._pulse(rows, cols, t, intensity);
      case 'typing': return this._typing(rows, cols, t, intensity);
      case 'rain': return this._rain(rows, cols, t, intensity);
      case 'spiral': return this._spiral(rows, cols, t, intensity);
      case 'scanline': return this._scanline(rows, cols, t, intensity);
      case 'dissolve': return this._dissolve(rows, cols, t, intensity);
      default: return null;
    }
  }

  _wave(rows, cols, t, intensity) {
    const offsets = [];
    for (let r = 0; r < rows; r++) {
      offsets[r] = [];
      for (let c = 0; c < cols; c++) {
        const wave1 = Math.sin(c * 0.15 + t * 2) * intensity * 2;
        const wave2 = Math.cos(r * 0.1 + t * 1.5) * intensity;
        offsets[r][c] = Math.round(wave1 + wave2);
      }
    }
    return offsets;
  }

  _matrix(rows, cols, t, intensity) {
    const offsets = [];
    const matrixChars = '01アイウエオカキクケコサシスセソタチツテト';
    const numStreams = Math.floor(cols * 0.3 * intensity);

    if (!this._matrixStreams || this.frame % 60 === 0) {
      this._matrixStreams = [];
      for (let i = 0; i < numStreams; i++) {
        this._matrixStreams.push({
          col: Math.floor(Math.random() * cols),
          speed: 0.3 + Math.random() * 0.7,
          length: 5 + Math.floor(Math.random() * 15),
          offset: Math.random() * rows * 2,
        });
      }
    }

    for (let r = 0; r < rows; r++) {
      offsets[r] = [];
      for (let c = 0; c < cols; c++) {
        offsets[r][c] = 0;
      }
    }

    for (const stream of this._matrixStreams) {
      const head = (t * stream.speed * 8 + stream.offset) % (rows + stream.length);
      for (let i = 0; i < stream.length; i++) {
        const row = Math.floor(head - i);
        if (row >= 0 && row < rows && stream.col < cols) {
          const alpha = 1 - i / stream.length;
          const char = matrixChars[Math.floor(Math.random() * matrixChars.length)];
          const green = Math.floor(100 + 155 * alpha);
          offsets[row][stream.col] = {
            char,
            color: `rgba(0, ${green}, 0, ${alpha * 0.9})`,
          };
        }
      }
    }

    return offsets;
  }

  _glitch(rows, cols, t, intensity) {
    const offsets = [];
    for (let r = 0; r < rows; r++) {
      offsets[r] = [];
      for (let c = 0; c < cols; c++) {
        offsets[r][c] = 0;
      }
    }

    this._glitchTimer++;
    if (this._glitchTimer % Math.max(1, Math.floor(10 / intensity)) === 0) {
      const numGlitches = Math.floor(3 * intensity);
      for (let g = 0; g < numGlitches; g++) {
        const startRow = Math.floor(Math.random() * rows);
        const glitchHeight = 1 + Math.floor(Math.random() * 5 * intensity);
        const shiftAmount = Math.floor((Math.random() - 0.5) * 10 * intensity);
        const glitchChars = '█▓▒░╔╗╚╝║═';

        for (let r = startRow; r < Math.min(startRow + glitchHeight, rows); r++) {
          for (let c = 0; c < cols; c++) {
            if (Math.random() < 0.3 * intensity) {
              offsets[r][c] = {
                char: glitchChars[Math.floor(Math.random() * glitchChars.length)],
                color: Math.random() < 0.5
                  ? `rgba(255, 0, ${Math.floor(Math.random() * 100)}, 0.9)`
                  : `rgba(0, ${Math.floor(Math.random() * 255)}, 255, 0.9)`,
              };
            } else {
              offsets[r][c] = shiftAmount;
            }
          }
        }
      }
    }

    return offsets;
  }

  _pulse(rows, cols, t, intensity) {
    const offsets = [];
    const centerR = rows / 2;
    const centerC = cols / 2;
    const maxDist = Math.sqrt(centerR * centerR + centerC * centerC);

    for (let r = 0; r < rows; r++) {
      offsets[r] = [];
      for (let c = 0; c < cols; c++) {
        const dist = Math.sqrt((r - centerR) ** 2 + (c - centerC) ** 2) / maxDist;
        const pulse = Math.sin(dist * 10 - t * 3) * intensity * 3;
        offsets[r][c] = Math.round(pulse);
      }
    }
    return offsets;
  }

  _typing(rows, cols, t, intensity) {
    const offsets = [];
    const totalCells = rows * cols;
    const progress = Math.min(1, (t * intensity * 0.5) % 1.5);
    const visibleCells = Math.floor(progress * totalCells);

    for (let r = 0; r < rows; r++) {
      offsets[r] = [];
      for (let c = 0; c < cols; c++) {
        const cellIndex = r * cols + c;
        if (cellIndex > visibleCells) {
          offsets[r][c] = { char: ' ', color: 'transparent' };
        } else if (cellIndex === visibleCells) {
          offsets[r][c] = { char: '█', color: 'rgba(255,255,255,0.8)' };
        } else {
          offsets[r][c] = 0;
        }
      }
    }
    return offsets;
  }

  _rain(rows, cols, t, intensity) {
    const offsets = [];

    if (!this._rainDrops || this.frame % 120 === 0) {
      this._rainDrops = [];
      const numDrops = Math.floor(cols * 0.4 * intensity);
      for (let i = 0; i < numDrops; i++) {
        this._rainDrops.push({
          col: Math.floor(Math.random() * cols),
          speed: 0.2 + Math.random() * 0.8,
          offset: Math.random() * rows * 3,
          length: 2 + Math.floor(Math.random() * 6),
        });
      }
    }

    for (let r = 0; r < rows; r++) {
      offsets[r] = [];
      for (let c = 0; c < cols; c++) {
        offsets[r][c] = 0;
      }
    }

    const rainChars = '|│┃╎╏';
    for (const drop of this._rainDrops) {
      const head = (t * drop.speed * 6 + drop.offset) % (rows + drop.length * 2);
      for (let i = 0; i < drop.length; i++) {
        const row = Math.floor(head - i);
        if (row >= 0 && row < rows && drop.col < cols) {
          const alpha = (1 - i / drop.length) * 0.8;
          offsets[row][drop.col] = {
            char: rainChars[Math.floor(Math.random() * rainChars.length)],
            color: `rgba(100, 180, 255, ${alpha})`,
          };
        }
      }
    }

    return offsets;
  }

  _spiral(rows, cols, t, intensity) {
    const offsets = [];
    const cr = rows / 2, cc = cols / 2;
    for (let r = 0; r < rows; r++) {
      offsets[r] = [];
      for (let c = 0; c < cols; c++) {
        const dx = c - cc, dy = r - cr;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        offsets[r][c] = Math.round(Math.sin(dist * 0.3 - t * 2 + angle) * intensity * 3);
      }
    }
    return offsets;
  }

  _scanline(rows, cols, t, intensity) {
    const offsets = [];
    const scanY = (t * 4) % (rows + 10) - 5;
    for (let r = 0; r < rows; r++) {
      offsets[r] = [];
      const dist = Math.abs(r - scanY);
      for (let c = 0; c < cols; c++) {
        if (dist < 4) {
          const glow = (4 - dist) / 4;
          offsets[r][c] = Math.round(glow * intensity * 4);
        } else {
          offsets[r][c] = 0;
        }
      }
    }
    return offsets;
  }

  _dissolve(rows, cols, t, intensity) {
    const offsets = [];
    const cycle = (t * 0.4) % 2;
    const threshold = cycle < 1 ? cycle : 2 - cycle;
    for (let r = 0; r < rows; r++) {
      offsets[r] = [];
      for (let c = 0; c < cols; c++) {
        const hash = Math.sin(r * 12.9898 + c * 78.233 + Math.floor(t * 2)) * 43758.5453;
        const rand = hash - Math.floor(hash);
        offsets[r][c] = rand > threshold * intensity
          ? { char: ' ', color: 'transparent' }
          : 0;
      }
    }
    return offsets;
  }
}
