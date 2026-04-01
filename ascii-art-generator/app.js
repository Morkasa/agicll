(() => {
  const canvas = document.getElementById('asciiCanvas');
  const previewCanvas = document.getElementById('previewCanvas');
  const dropZone = document.getElementById('dropZone');
  const canvasArea = document.getElementById('canvasArea');
  const fileInput = document.getElementById('fileInput');
  const uploadBtn = document.getElementById('uploadBtn');
  const exportBtn = document.getElementById('exportBtn');
  const exportModal = document.getElementById('exportModal');
  const modalClose = document.getElementById('modalClose');
  const fullscreenBtn = document.getElementById('fullscreenBtn');

  const videoEl = document.getElementById('videoSource');
  const videoControls = document.getElementById('videoControls');
  const vcPlayPause = document.getElementById('vcPlayPause');
  const vcPlayIcon = document.getElementById('vcPlayIcon');
  const vcPauseIcon = document.getElementById('vcPauseIcon');
  const vcSeek = document.getElementById('vcSeek');
  const vcCurrentTime = document.getElementById('vcCurrentTime');
  const vcDuration = document.getElementById('vcDuration');
  const vcSpeed = document.getElementById('vcSpeed');
  const vcMute = document.getElementById('vcMute');

  const recordBar = document.getElementById('recordBar');
  const recordBtn = document.getElementById('recordBtn');
  const recordLabel = document.getElementById('recordLabel');
  const recPauseBtn = document.getElementById('recPauseBtn');
  const recPauseIcon = document.getElementById('recPauseIcon');
  const recResumeIcon = document.getElementById('recResumeIcon');
  const recFpsSelect = document.getElementById('recFps');
  const recFormatSelect = document.getElementById('recFormat');
  const recDurationSelect = document.getElementById('recDuration');
  const recTimeElapsed = document.getElementById('recTimeElapsed');
  const recTimeTotal = document.getElementById('recTimeTotal');
  const recProgressFill = document.getElementById('recProgressFill');
  const recProgressSeek = document.getElementById('recProgressSeek');
  const recPreviewVideo = document.getElementById('recPreviewVideo');

  const engine = new ASCIIEngine(canvas);
  const animator = new AnimationController();
  let animFrameId = null;
  let videoRenderLoopId = null;
  let isExporting = false;
  let isVideoMode = false;
  let isGifMode = false;
  const recordingIndicator = document.getElementById('recordingIndicator');

  let isRecording = false;
  let isRecPaused = false;
  let mediaRecorder = null;
  let recordedChunks = [];
  let recStartTime = 0;
  let recElapsedBeforePause = 0;
  let recTimerInterval = null;
  let recMaxDurationSec = 300;
  let recPreviewUrl = null;
  let isSeeking = false;
  let recAutoExport = false;
  let recUsedFormat = 'mp4';
  let recUsedMime = '';

  let animStateBeforePause = null;

  function updateSliderFill(slider) {
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    const val = parseFloat(slider.value);
    const pct = ((val - min) / (max - min)) * 100;
    slider.style.background = `linear-gradient(to right, #666 0%, #666 ${pct}%, #333 ${pct}%, #333 100%)`;
  }

  document.querySelectorAll('.slider').forEach(s => {
    updateSliderFill(s);
    s.addEventListener('input', () => updateSliderFill(s));
  });

  // --- File type detection ---
  function getFileCategory(file) {
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    if (type === 'image/gif' || name.endsWith('.gif')) return 'gif';
    if (type.startsWith('video/') || name.endsWith('.webm') || name.endsWith('.mp4') || name.endsWith('.mov') || name.endsWith('.avi')) return 'video';
    if (type.startsWith('image/')) return 'image';
    return 'unknown';
  }

  // --- Unified file handler ---
  function handleFileUpload(file) {
    if (!file) return;
    stopVideoRenderLoop();
    stopAnimationLoop();
    videoEl.pause();
    videoEl.removeAttribute('src');
    videoControls.classList.remove('visible');
    isVideoMode = false;
    isGifMode = false;

    const category = getFileCategory(file);
    if (category === 'video') {
      handleVideoLoad(file);
    } else if (category === 'gif') {
      handleGifLoad(file);
    } else if (category === 'image') {
      handleImageLoad(file);
    }
  }

  function handleImageLoad(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        engine.loadImage(img);
        showCanvas();
        scheduleRender();
        engine.renderPreview(previewCanvas);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function handleGifLoad(file) {
    isGifMode = true;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      engine.loadAnimatedImage(img);
      showCanvas();
      startVideoRenderLoop();
      engine.renderPreview(previewCanvas);
    };
    img.src = url;
  }

  function handleVideoLoad(file) {
    isVideoMode = true;
    const url = URL.createObjectURL(file);
    videoEl.src = url;
    videoEl.load();

    videoEl.onloadeddata = () => {
      engine.loadVideo(videoEl);
      showCanvas();
      videoControls.classList.add('visible');
      vcDuration.textContent = formatTime(videoEl.duration);
      videoEl.play();
      updatePlayPauseIcon();
      startVideoRenderLoop();
      engine.renderPreview(previewCanvas);
    };
  }

  function showCanvas() {
    dropZone.classList.add('hidden');
    canvas.style.display = 'block';
  }

  // --- Drag & drop ---
  canvasArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  canvasArea.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  canvasArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFileUpload(e.dataTransfer.files[0]);
  });

  uploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    handleFileUpload(e.target.files[0]);
    e.target.value = '';
  });

  // --- Video controls ---
  vcPlayPause.addEventListener('click', () => {
    if (!isVideoMode) return;
    if (videoEl.paused) {
      videoEl.play();
    } else {
      videoEl.pause();
    }
    updatePlayPauseIcon();
  });

  function updatePlayPauseIcon() {
    const playing = !videoEl.paused;
    vcPlayIcon.style.display = playing ? 'none' : 'block';
    vcPauseIcon.style.display = playing ? 'block' : 'none';
  }

  videoEl.addEventListener('play', updatePlayPauseIcon);
  videoEl.addEventListener('pause', updatePlayPauseIcon);

  videoEl.addEventListener('timeupdate', () => {
    if (!isVideoMode) return;
    vcCurrentTime.textContent = formatTime(videoEl.currentTime);
    if (videoEl.duration) {
      vcSeek.value = (videoEl.currentTime / videoEl.duration) * 1000;
      updateSliderFill(vcSeek);
    }
  });

  vcSeek.addEventListener('input', () => {
    if (!isVideoMode || !videoEl.duration) return;
    videoEl.currentTime = (vcSeek.value / 1000) * videoEl.duration;
  });

  vcSpeed.addEventListener('change', () => {
    videoEl.playbackRate = parseFloat(vcSpeed.value);
  });

  vcMute.addEventListener('click', () => {
    videoEl.muted = !videoEl.muted;
    vcMute.style.opacity = videoEl.muted ? '0.4' : '1';
  });

  function formatTime(sec) {
    if (!isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // --- Style buttons ---
  document.querySelectorAll('.style-btn:not(.anim-btn):not(.dither-type-btn):not(.dither-anim-btn)').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.style-btn:not(.anim-btn):not(.dither-type-btn):not(.dither-anim-btn)').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      engine.params.style = btn.dataset.style;

      const customInput = document.getElementById('customChars');
      customInput.style.display = btn.dataset.style === 'custom' ? 'block' : 'none';

      scheduleRender();
    });
  });

  document.getElementById('customChars').addEventListener('input', (e) => {
    engine.params.customChars = e.target.value;
    scheduleRender();
  });

  // --- Sliders ---
  const sliderMap = {
    sizeSlider: 'fontSize',
    coverageSlider: 'coverage',
    edgeSlider: 'edgeEmphasis',
    opacitySlider: 'opacity',
    brightnessSlider: 'brightness',
    contrastSlider: 'contrast',
    bgBlurSlider: 'bgBlur',
    bgOpacitySlider: 'bgOpacity',
  };

  Object.entries(sliderMap).forEach(([id, param]) => {
    const slider = document.getElementById(id);
    slider.addEventListener('input', () => {
      engine.params[param] = parseFloat(slider.value);
      scheduleRender();
    });
  });

  // --- Toggles ---
  document.getElementById('invertToggle').addEventListener('change', (e) => {
    engine.params.invert = e.target.checked;
    scheduleRender();
  });

  document.getElementById('dotGridToggle').addEventListener('change', (e) => {
    engine.params.dotGrid = e.target.checked;
    scheduleRender();
  });

  // --- Dithering ---
  document.querySelectorAll('.dither-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dither-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      engine.params.ditherType = btn.dataset.dtype;
      scheduleRender();
    });
  });

  document.getElementById('ditherOrigColors').addEventListener('change', (e) => {
    engine.params.ditherOriginalColors = e.target.checked;
    scheduleRender();
  });

  document.getElementById('ditherInvert').addEventListener('change', (e) => {
    engine.params.ditherInvert = e.target.checked;
    scheduleRender();
  });

  document.getElementById('ditherSizeSlider').addEventListener('input', (e) => {
    engine.params.ditherSize = parseInt(e.target.value);
    scheduleRender();
  });

  document.getElementById('ditherStepsSlider').addEventListener('input', (e) => {
    engine.params.ditherColorSteps = parseInt(e.target.value);
    scheduleRender();
  });

  document.getElementById('ditherFg1').addEventListener('input', (e) => {
    engine.params.ditherFgColors[0] = e.target.value;
    scheduleRender();
  });

  document.getElementById('ditherFg2').addEventListener('input', (e) => {
    engine.params.ditherFgColors[1] = e.target.value;
    scheduleRender();
  });

  document.getElementById('ditherFill').addEventListener('input', (e) => {
    engine.params.ditherBgColor = e.target.value;
    scheduleRender();
  });

  document.querySelectorAll('.dither-anim-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dither-anim-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const type = btn.dataset.danim;
      engine.params.ditherAnimType = type;
      engine.params.ditherAnimEnabled = type !== 'none';
      if (engine.params.ditherAnimEnabled) {
        engine._ditherAnimStart = performance.now();
        startDitherAnimLoop();
      } else {
        stopDitherAnimLoop();
        scheduleRender();
      }
    });
  });

  document.getElementById('ditherAnimSpeed').addEventListener('input', (e) => {
    engine.params.ditherAnimSpeed = parseFloat(e.target.value);
  });

  document.getElementById('ditherAnimIntensity').addEventListener('input', (e) => {
    engine.params.ditherAnimIntensity = parseFloat(e.target.value);
  });

  // --- Glitch Art ---
  const glitchSliderMap = {
    glitchRgbSlider: 'glitchRgbShift',
    glitchScanlinesSlider: 'glitchScanlines',
    glitchBlockSlider: 'glitchBlock',
    glitchNoiseSlider: 'glitchNoise',
    glitchColorSlider: 'glitchColorShift',
  };

  Object.entries(glitchSliderMap).forEach(([id, param]) => {
    const slider = document.getElementById(id);
    slider.addEventListener('input', () => {
      engine.params[param] = parseFloat(slider.value);
      scheduleRender();
    });
  });

  // --- Background color ---
  document.getElementById('bgColorPicker').addEventListener('input', (e) => {
    engine.params.bgColor = e.target.value;
    scheduleRender();
  });

  // --- Animation ---
  const animControls = document.getElementById('animationControls');
  const animToggle = document.getElementById('animationToggle');

  animToggle.addEventListener('change', (e) => {
    animator.enabled = e.target.checked;
    animControls.classList.toggle('visible', e.target.checked);
    if (e.target.checked) {
      animator.reset();
      if (!videoRenderLoopId) startAnimationLoop();
    } else {
      stopAnimationLoop();
      if (!videoRenderLoopId) scheduleRender();
    }
  });

  document.querySelectorAll('.anim-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.anim-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      animator.type = btn.dataset.anim;
      animator.reset();
    });
  });

  document.getElementById('animSpeedSlider').addEventListener('input', (e) => {
    animator.speed = parseFloat(e.target.value);
  });

  document.getElementById('animIntensitySlider').addEventListener('input', (e) => {
    animator.intensity = parseFloat(e.target.value);
  });

  // --- Render scheduling ---
  let renderPending = false;

  function scheduleRender() {
    if (renderPending) return;
    if (videoRenderLoopId || ditherAnimLoopId || glitchLoopId) return;
    renderPending = true;
    requestAnimationFrame(() => {
      renderPending = false;
      engine.render(null);
      fitCanvasToArea();
    });
  }

  function startVideoRenderLoop() {
    if (videoRenderLoopId) return;
    function loop() {
      if (!isVideoMode && !isGifMode) {
        videoRenderLoopId = null;
        return;
      }
      engine.updateFrame();
      if (animator.enabled && engine.imageData) {
        const dims = engine.getGridDimensions();
        const offsets = animator.getOffsets(dims.rows, dims.cols);
        engine.render(offsets);
      } else {
        engine.render(null);
      }
      fitCanvasToArea();
      videoRenderLoopId = requestAnimationFrame(loop);
    }
    loop();
  }

  function stopVideoRenderLoop() {
    if (videoRenderLoopId) {
      cancelAnimationFrame(videoRenderLoopId);
      videoRenderLoopId = null;
    }
  }

  function startAnimationLoop() {
    if (videoRenderLoopId) return;
    if (animFrameId) return;
    function loop() {
      if (!animator.enabled) {
        animFrameId = null;
        return;
      }
      if (engine.imageData) {
        const dims = engine.getGridDimensions();
        const offsets = animator.getOffsets(dims.rows, dims.cols);
        engine.render(offsets);
        fitCanvasToArea();
      }
      animFrameId = requestAnimationFrame(loop);
    }
    loop();
  }

  function stopAnimationLoop() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  let ditherAnimLoopId = null;

  function startDitherAnimLoop() {
    if (ditherAnimLoopId || videoRenderLoopId || animFrameId) return;
    function loop() {
      if (engine.params.renderMode !== 'dithering' || !engine.params.ditherAnimEnabled) {
        ditherAnimLoopId = null;
        return;
      }
      if (engine.imageData) {
        engine.render(null);
        fitCanvasToArea();
      }
      ditherAnimLoopId = requestAnimationFrame(loop);
    }
    loop();
  }

  function stopDitherAnimLoop() {
    if (ditherAnimLoopId) {
      cancelAnimationFrame(ditherAnimLoopId);
      ditherAnimLoopId = null;
    }
  }

  let glitchLoopId = null;

  function startGlitchLoop() {
    if (glitchLoopId || videoRenderLoopId) return;
    function loop() {
      if (engine.params.renderMode !== 'glitch') {
        glitchLoopId = null;
        return;
      }
      if (engine.imageData) {
        engine.render(null);
        fitCanvasToArea();
      }
      glitchLoopId = requestAnimationFrame(loop);
    }
    loop();
  }

  function stopGlitchLoop() {
    if (glitchLoopId) {
      cancelAnimationFrame(glitchLoopId);
      glitchLoopId = null;
    }
  }

  function fitCanvasToArea() {
    const areaW = canvasArea.clientWidth;
    const areaH = canvasArea.clientHeight;
    const cW = canvas.width;
    const cH = canvas.height;
    if (!cW || !cH) return;
    const scale = Math.min(areaW / cW, areaH / cH, 2);
    canvas.style.width = `${cW * scale}px`;
    canvas.style.height = `${cH * scale}px`;
  }

  window.addEventListener('resize', () => {
    if (engine.sourceImage || engine.sourceVideo) fitCanvasToArea();
  });

  // --- Fullscreen ---
  fullscreenBtn.addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      canvasArea.requestFullscreen();
    }
  });

  // --- Tabs (mode switching) ---
  const animationSection = document.getElementById('animationSection');

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const mode = tab.dataset.tab;
      engine.params.renderMode = mode;

      document.querySelectorAll('.tab-content').forEach(tc => {
        tc.classList.toggle('active', tc.dataset.tab === mode);
      });

      animationSection.style.display = mode === 'dithering' ? 'none' : '';

      if (mode === 'dithering' && engine.params.ditherAnimEnabled) {
        startDitherAnimLoop();
      } else {
        stopDitherAnimLoop();
      }

      if (mode === 'glitch' && !videoRenderLoopId && !animFrameId) {
        startGlitchLoop();
      } else {
        stopGlitchLoop();
      }

      scheduleRender();
    });
  });

  // --- Export ---
  exportBtn.addEventListener('click', () => {
    if (!engine.sourceImage && !engine.sourceVideo) return;
    exportModal.classList.add('visible');
  });

  modalClose.addEventListener('click', () => {
    exportModal.classList.remove('visible');
  });

  exportModal.addEventListener('click', (e) => {
    if (e.target === exportModal) exportModal.classList.remove('visible');
  });

  document.querySelectorAll('.export-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const format = opt.dataset.format;
      exportModal.classList.remove('visible');
      performExport(format);
    });
  });

  async function performExport(format) {
    if (isExporting || (!engine.sourceImage && !engine.sourceVideo)) return;
    isExporting = true;

    try {
      if ((format === 'mp4' || format === 'webm') && recordedChunks.length > 0) {
        await exportRecordedChunks(format);
        return;
      }
      switch (format) {
        case 'png':
          exportPNG();
          break;
        case 'txt':
          exportTXT();
          break;
        case 'gif':
          await exportAnimatedGIF();
          break;
        case 'mp4':
          await exportMP4();
          break;
        case 'webm':
          await exportWebM();
          break;
      }
    } finally {
      isExporting = false;
    }
  }

  async function exportRecordedChunks(format) {
    const usedMime = recUsedMime || 'video/webm';
    const isWebm = usedMime.includes('webm');
    const rawBlob = new Blob(recordedChunks, { type: isWebm ? 'video/webm' : 'video/mp4' });
    recordedChunks = [];

    if (format === 'mp4' && isWebm && typeof VideoEncoder !== 'undefined') {
      recordingIndicator.querySelector('span').textContent = 'Converting to MP4...';
      recordingIndicator.classList.add('visible');
      try {
        const mp4Blob = await convertWebmToMp4(rawBlob);
        downloadBlob(mp4Blob, 'ascii-art-rec.mp4');
      } catch (err) {
        console.error('MP4 conversion failed, falling back to WebM:', err);
        downloadBlob(rawBlob, 'ascii-art-rec.webm');
      }
      recordingIndicator.querySelector('span').textContent = 'Recording...';
      recordingIndicator.classList.remove('visible');
    } else {
      const ext = isWebm ? 'webm' : 'mp4';
      downloadBlob(rawBlob, `ascii-art-rec.${ext}`);
    }
    isExporting = false;
  }

  function exportPNG() {
    engine.render(null);
    const link = document.createElement('a');
    link.download = 'ascii-art.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function exportTXT() {
    engine.render(null);
    const text = engine.getASCIIText();
    const blob = new Blob([text], { type: 'text/plain' });
    const link = document.createElement('a');
    link.download = 'ascii-art.txt';
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function exportWebM() {
    await exportVideoFrameByFrame('webm');
  }

  async function exportMP4() {
    await exportVideoFrameByFrame('mp4');
  }

  async function exportVideoFrameByFrame(format) {
    const hasMotion = animator.enabled || isVideoMode || isGifMode || engine.params.ditherAnimEnabled || engine.params.renderMode === 'glitch';
    if (!hasMotion) {
      alert('请先启用动画或上传视频/GIF 才能导出视频。');
      return;
    }

    if (typeof VideoEncoder === 'undefined') {
      alert('您的浏览器不支持逐帧导出，请使用最新版 Chrome 或 Edge。');
      return;
    }

    const fps = 30;
    const totalDuration = isVideoMode ? Math.min(videoEl.duration, 30) : 5;
    const totalFrames = Math.floor(totalDuration * fps);
    const frameDurUs = 1000000 / fps;

    recordingIndicator.classList.add('visible');
    recordingIndicator.querySelector('span').textContent = 'Exporting 0%...';

    try {
      let Muxer, ArrayBufferTarget;
      if (format === 'mp4') {
        ({ Muxer, ArrayBufferTarget } = await import(
          'https://cdn.jsdelivr.net/npm/mp4-muxer@5/build/mp4-muxer.min.mjs'
        ));
      } else {
        ({ Muxer, ArrayBufferTarget } = await import(
          'https://cdn.jsdelivr.net/npm/webm-muxer@5/build/webm-muxer.min.mjs'
        ));
      }

      const w = canvas.width;
      const h = canvas.height;
      const encW = w + (w % 2);
      const encH = h + (h % 2);

      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        video: format === 'mp4'
          ? { codec: 'avc', width: encW, height: encH }
          : { codec: 'V_VP9', width: encW, height: encH },
        fastStart: format === 'mp4' ? 'in-memory' : undefined,
      });

      const codecStr = format === 'mp4' ? 'avc1.42001f' : 'vp09.00.10.08';
      const encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => console.error('VideoEncoder error:', e),
      });

      encoder.configure({
        codec: codecStr,
        width: encW,
        height: encH,
        bitrate: 8000000,
        framerate: fps,
      });

      let srcCanvas = canvas;
      if (encW !== w || encH !== h) {
        srcCanvas = document.createElement('canvas');
        srcCanvas.width = encW;
        srcCanvas.height = encH;
      }
      const srcCtx = srcCanvas !== canvas ? srcCanvas.getContext('2d') : null;

      const savedAnimFrame = animator.frame;
      const savedDitherStart = engine._ditherAnimStart;
      if (animator.enabled) { animator.frame = 0; animator.reset(); }
      engine._ditherAnimStart = 0;

      if (isVideoMode) videoEl.pause();

      for (let i = 0; i < totalFrames; i++) {
        const frameTimeMs = (i / fps) * 1000;
        engine._renderTimeMs = frameTimeMs;

        if (isVideoMode) {
          videoEl.currentTime = i / fps;
          await new Promise(r => { videoEl.onseeked = r; });
          engine.updateFrame();
        } else if (isGifMode) {
          engine.updateFrame();
        }

        const dims = engine.getGridDimensions();
        const offsets = animator.enabled ? animator.getOffsets(dims.rows, dims.cols) : null;
        engine.render(offsets);

        if (srcCtx) {
          srcCtx.clearRect(0, 0, encW, encH);
          srcCtx.drawImage(canvas, 0, 0);
        }

        const frame = new VideoFrame(srcCanvas, { timestamp: Math.round(i * frameDurUs) });
        encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
        frame.close();

        if (i % 5 === 0) {
          const pct = Math.round((i / totalFrames) * 100);
          recordingIndicator.querySelector('span').textContent = `Exporting ${pct}%...`;
          await new Promise(r => setTimeout(r, 0));
        }
      }

      engine._renderTimeMs = null;
      if (animator.enabled) animator.frame = savedAnimFrame;
      engine._ditherAnimStart = savedDitherStart;
      if (isVideoMode) videoEl.play();

      await encoder.flush();
      encoder.close();
      muxer.finalize();

      const mimeType = format === 'mp4' ? 'video/mp4' : 'video/webm';
      const blob = new Blob([target.buffer], { type: mimeType });
      const link = document.createElement('a');
      link.download = `ascii-art.${format}`;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error(`${format.toUpperCase()} export failed:`, err);
      alert(`${format.toUpperCase()} 导出失败: ${err.message}`);
    }

    recordingIndicator.querySelector('span').textContent = 'Recording...';
    recordingIndicator.classList.remove('visible');
  }

  async function exportAnimatedGIF() {
    const hasMotion = animator.enabled || isVideoMode || isGifMode || engine.params.ditherAnimEnabled || engine.params.renderMode === 'glitch';
    if (!hasMotion) {
      alert('请先启用动画或上传视频/GIF 才能导出 GIF。');
      return;
    }

    recordingIndicator.classList.add('visible');
    recordingIndicator.querySelector('span').textContent = 'Encoding GIF...';

    await new Promise(r => setTimeout(r, 50));

    const maxGifDim = 400;
    const scaleW = Math.min(1, maxGifDim / canvas.width);
    const scaleH = Math.min(1, maxGifDim / canvas.height);
    const scale = Math.min(scaleW, scaleH);
    const gifW = Math.floor(canvas.width * scale);
    const gifH = Math.floor(canvas.height * scale);

    const encoder = new SimpleGIFEncoder(gifW, gifH);
    const frameDelay = 66;
    encoder.setDelay(frameDelay);

    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = gifW;
    tmpCanvas.height = gifH;
    const tmpCtx = tmpCanvas.getContext('2d');

    const totalFrames = isVideoMode
      ? Math.min(Math.floor(videoEl.duration / (frameDelay / 1000)), 60)
      : 30;

    if (isVideoMode) {
      videoEl.pause();
      for (let i = 0; i < totalFrames; i++) {
        videoEl.currentTime = i * (frameDelay / 1000);
        await new Promise(r => { videoEl.onseeked = r; });
        engine.updateFrame();
        const dims = engine.getGridDimensions();
        const offsets = animator.enabled ? animator.getOffsets(dims.rows, dims.cols) : null;
        engine.render(offsets);
        tmpCtx.drawImage(canvas, 0, 0, gifW, gifH);
        encoder.addFrame(tmpCanvas);
      }
      videoEl.play();
    } else {
      const savedFrame = animator.frame;
      if (animator.enabled) { animator.frame = 0; animator.reset(); }
      for (let i = 0; i < totalFrames; i++) {
        if (isGifMode) engine.updateFrame();
        const dims = engine.getGridDimensions();
        const offsets = animator.enabled ? animator.getOffsets(dims.rows, dims.cols) : null;
        engine.render(offsets);
        tmpCtx.drawImage(canvas, 0, 0, gifW, gifH);
        encoder.addFrame(tmpCanvas);
        await new Promise(r => setTimeout(r, frameDelay));
      }
      if (animator.enabled) animator.frame = savedFrame;
    }

    const gifData = encoder.finish();
    const blob = new Blob([gifData], { type: 'image/gif' });
    const link = document.createElement('a');
    link.download = 'ascii-art.gif';
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);

    recordingIndicator.querySelector('span').textContent = 'Recording...';
    recordingIndicator.classList.remove('visible');
  }

  // --- Duration selector ---
  recDurationSelect.addEventListener('change', () => {
    recMaxDurationSec = parseInt(recDurationSelect.value) || 0;
    recTimeTotal.textContent = recMaxDurationSec > 0 ? formatRecTime(recMaxDurationSec) : '∞';
  });

  function formatRecTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  }

  function getRecElapsed() {
    if (isRecPaused) return recElapsedBeforePause;
    return recElapsedBeforePause + (Date.now() - recStartTime) / 1000;
  }

  // --- Record / Stop ---
  recordBtn.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });

  // --- Pause / Resume ---
  recPauseBtn.addEventListener('click', () => {
    if (!isRecording || !mediaRecorder) return;
    if (isRecPaused) {
      resumeRecording();
    } else {
      pauseRecording();
    }
  });

  function startRecording() {
    if (!engine.sourceImage && !engine.sourceVideo) return;
    if (isRecording) return;

    const fps = parseInt(recFpsSelect.value);
    const format = recFormatSelect.value;
    recMaxDurationSec = parseInt(recDurationSelect.value) || 0;

    let mimeType = '';
    if (format === 'webm') {
      for (const t of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
        if (MediaRecorder.isTypeSupported(t)) { mimeType = t; break; }
      }
    } else {
      for (const t of ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4']) {
        if (MediaRecorder.isTypeSupported(t)) { mimeType = t; break; }
      }
      if (!mimeType) {
        for (const t of ['video/webm;codecs=vp9', 'video/webm']) {
          if (MediaRecorder.isTypeSupported(t)) { mimeType = t; break; }
        }
      }
    }

    if (!mimeType) {
      alert('您的浏览器不支持视频录制，请使用 Chrome 或 Edge。');
      return;
    }

    const stream = canvas.captureStream(fps);
    recordedChunks = [];

    try {
      mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: fps >= 60 ? 10000000 : 6000000,
      });
    } catch (e) {
      alert('录制初始化失败: ' + e.message);
      return;
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      if (recAutoExport) finishRecording(format, mimeType);
    };

    recUsedFormat = format;
    recUsedMime = mimeType;
    recAutoExport = false;

    mediaRecorder.start(1000);
    isRecording = true;
    isRecPaused = false;
    recStartTime = Date.now();
    recElapsedBeforePause = 0;

    recordBtn.classList.add('recording');
    recordBar.classList.add('is-recording');
    recordBar.classList.remove('is-paused');
    recordLabel.textContent = 'STOP';
    recPauseBtn.style.display = 'flex';
    recPauseIcon.style.display = 'block';
    recResumeIcon.style.display = 'none';
    recPauseBtn.classList.remove('is-paused');
    recTimeElapsed.textContent = '00:00';
    recTimeTotal.textContent = recMaxDurationSec > 0 ? formatRecTime(recMaxDurationSec) : '∞';
    recProgressFill.style.width = '0%';
    recProgressSeek.value = 0;
    recordingIndicator.classList.add('visible');
    cleanupPreview();

    recTimerInterval = setInterval(updateRecProgress, 300);
  }

  function pauseRecording() {
    if (!isRecording || isRecPaused || !mediaRecorder) return;
    mediaRecorder.pause();
    recElapsedBeforePause += (Date.now() - recStartTime) / 1000;
    isRecPaused = true;

    recPauseIcon.style.display = 'none';
    recResumeIcon.style.display = 'block';
    recPauseBtn.classList.add('is-paused');
    recordBar.classList.add('is-paused');
    recordingIndicator.querySelector('span').textContent = 'Paused';

    animStateBeforePause = {
      videoPlaying: isVideoMode && !videoEl.paused,
      animLoop: !!animFrameId,
      ditherLoop: !!ditherAnimLoopId,
      glitchLoop: !!glitchLoopId,
      videoLoop: !!videoRenderLoopId,
    };
    if (isVideoMode && !videoEl.paused) videoEl.pause();
    stopAnimationLoop();
    stopDitherAnimLoop();
    stopGlitchLoop();
    stopVideoRenderLoop();

    buildPreview();
  }

  function resumeRecording() {
    if (!isRecording || !isRecPaused || !mediaRecorder) return;
    cleanupPreview();
    mediaRecorder.resume();
    recStartTime = Date.now();
    isRecPaused = false;

    recPauseIcon.style.display = 'block';
    recResumeIcon.style.display = 'none';
    recPauseBtn.classList.remove('is-paused');
    recordBar.classList.remove('is-paused');
    recordingIndicator.querySelector('span').textContent = 'Recording...';

    if (animStateBeforePause) {
      if (animStateBeforePause.videoPlaying) videoEl.play();
      if (animStateBeforePause.videoLoop) startVideoRenderLoop();
      if (animStateBeforePause.animLoop && animator.enabled) startAnimationLoop();
      if (animStateBeforePause.ditherLoop && engine.params.ditherAnimEnabled) startDitherAnimLoop();
      if (animStateBeforePause.glitchLoop && engine.params.renderMode === 'glitch') startGlitchLoop();
      animStateBeforePause = null;
    }
  }

  function stopRecording() {
    if (!isRecording || !mediaRecorder) return;
    const wasPaused = isRecPaused;
    if (isRecPaused) {
      mediaRecorder.resume();
    }
    recAutoExport = false;
    mediaRecorder.stop();
    isRecording = false;
    isRecPaused = false;

    clearInterval(recTimerInterval);
    recTimerInterval = null;

    recordBtn.classList.remove('recording');
    recordBar.classList.remove('is-recording');
    recordBar.classList.remove('is-paused');
    recordLabel.textContent = 'REC';
    recPauseBtn.style.display = 'none';
    recPauseBtn.classList.remove('is-paused');
    recordingIndicator.classList.remove('visible');
    cleanupPreview();

    if (wasPaused && animStateBeforePause) {
      if (animStateBeforePause.videoPlaying) videoEl.play();
      if (animStateBeforePause.videoLoop) startVideoRenderLoop();
      if (animStateBeforePause.animLoop && animator.enabled) startAnimationLoop();
      if (animStateBeforePause.ditherLoop && engine.params.ditherAnimEnabled) startDitherAnimLoop();
      if (animStateBeforePause.glitchLoop && engine.params.renderMode === 'glitch') startGlitchLoop();
      animStateBeforePause = null;
    }
  }

  function updateRecProgress() {
    if (isSeeking) return;
    const elapsedSec = getRecElapsed();
    recTimeElapsed.textContent = formatRecTime(elapsedSec);

    if (recMaxDurationSec > 0) {
      const pct = Math.min(100, (elapsedSec / recMaxDurationSec) * 100);
      recProgressFill.style.width = `${pct}%`;
      recProgressSeek.value = Math.round(pct * 10);

      if (!isRecPaused && elapsedSec >= recMaxDurationSec) {
        stopRecording();
      }
    } else {
      const totalSoFar = Math.max(elapsedSec, 1);
      recProgressFill.style.width = '100%';
      recProgressSeek.value = 1000;
      recTimeTotal.textContent = formatRecTime(totalSoFar);
    }
  }

  // --- Seek preview when paused ---
  recProgressSeek.addEventListener('input', () => {
    if (!isRecPaused) return;
    isSeeking = true;

    const elapsed = getRecElapsed();
    const seekTime = (recProgressSeek.value / 1000) * elapsed;
    recTimeElapsed.textContent = formatRecTime(seekTime);
    recProgressFill.style.width = `${(recProgressSeek.value / 10)}%`;

    if (recPreviewVideo.readyState >= 1 && isFinite(recPreviewVideo.duration)) {
      recPreviewVideo.currentTime = Math.min(seekTime, recPreviewVideo.duration);
    }
  });

  recProgressSeek.addEventListener('change', () => {
    isSeeking = false;
  });

  recPreviewVideo.addEventListener('seeked', () => {
    if (!isRecPaused) return;
    const ctx2 = canvas.getContext('2d');
    ctx2.drawImage(recPreviewVideo, 0, 0, canvas.width, canvas.height);
  });

  function buildPreview() {
    if (recordedChunks.length === 0) return;
    const usedMime = mediaRecorder.mimeType || 'video/webm';
    const blob = new Blob(recordedChunks, { type: usedMime });
    if (recPreviewUrl) URL.revokeObjectURL(recPreviewUrl);
    recPreviewUrl = URL.createObjectURL(blob);
    recPreviewVideo.src = recPreviewUrl;
    recPreviewVideo.load();

    const elapsed = getRecElapsed();
    if (recMaxDurationSec > 0) {
      recProgressSeek.max = 1000;
      recProgressSeek.value = Math.round((elapsed / recMaxDurationSec) * 1000);
    } else {
      recProgressSeek.max = 1000;
      recProgressSeek.value = 1000;
    }
  }

  function cleanupPreview() {
    if (recPreviewUrl) {
      URL.revokeObjectURL(recPreviewUrl);
      recPreviewUrl = null;
    }
    recPreviewVideo.removeAttribute('src');
    recPreviewVideo.load();
    isSeeking = false;
  }

  async function finishRecording(requestedFormat, usedMime) {
    if (recordedChunks.length === 0) return;

    const isWebm = usedMime.includes('webm');
    const rawBlob = new Blob(recordedChunks, { type: isWebm ? 'video/webm' : 'video/mp4' });
    recordedChunks = [];

    if (requestedFormat === 'mp4' && isWebm && typeof VideoEncoder !== 'undefined') {
      recordingIndicator.querySelector('span').textContent = 'Converting to MP4...';
      recordingIndicator.classList.add('visible');
      try {
        const mp4Blob = await convertWebmToMp4(rawBlob);
        downloadBlob(mp4Blob, 'ascii-art-rec.mp4');
      } catch (err) {
        console.error('MP4 conversion failed, falling back to WebM:', err);
        downloadBlob(rawBlob, 'ascii-art-rec.webm');
      }
      recordingIndicator.querySelector('span').textContent = 'Recording...';
      recordingIndicator.classList.remove('visible');
      return;
    }

    const ext = isWebm ? 'webm' : 'mp4';
    downloadBlob(rawBlob, `ascii-art-rec.${ext}`);
  }

  function downloadBlob(blob, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function convertWebmToMp4(webmBlob) {
    const { Muxer, ArrayBufferTarget } = await import(
      'https://cdn.jsdelivr.net/npm/mp4-muxer@5/build/mp4-muxer.min.mjs'
    );

    const videoEl2 = document.createElement('video');
    videoEl2.muted = true;
    videoEl2.src = URL.createObjectURL(webmBlob);
    await new Promise((resolve, reject) => {
      videoEl2.onloadedmetadata = resolve;
      videoEl2.onerror = reject;
    });

    const w = videoEl2.videoWidth;
    const h = videoEl2.videoHeight;
    const encW = w + (w % 2);
    const encH = h + (h % 2);
    const fps = parseInt(recFpsSelect.value) || 30;
    const duration = videoEl2.duration;
    const totalFrames = Math.floor(duration * fps);

    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target,
      video: { codec: 'avc', width: encW, height: encH },
      fastStart: 'in-memory',
    });

    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => console.error('VideoEncoder error:', e),
    });

    encoder.configure({
      codec: 'avc1.42001f',
      width: encW,
      height: encH,
      bitrate: 8000000,
      framerate: fps,
    });

    const tmpCvs = document.createElement('canvas');
    tmpCvs.width = encW;
    tmpCvs.height = encH;
    const tmpCtx2 = tmpCvs.getContext('2d');
    const frameDurUs = 1000000 / fps;

    videoEl2.pause();
    for (let i = 0; i < totalFrames; i++) {
      videoEl2.currentTime = i / fps;
      await new Promise(r => { videoEl2.onseeked = r; });
      tmpCtx2.clearRect(0, 0, encW, encH);
      tmpCtx2.drawImage(videoEl2, 0, 0, encW, encH);
      const frame = new VideoFrame(tmpCvs, { timestamp: Math.round(i * frameDurUs) });
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      if (i % 10 === 0) await new Promise(r => setTimeout(r, 0));
    }

    await encoder.flush();
    encoder.close();
    muxer.finalize();

    URL.revokeObjectURL(videoEl2.src);

    return new Blob([target.buffer], { type: 'video/mp4' });
  }
})();
