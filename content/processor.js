/**
 * Media Processor
 * Handles applying blur effects to images and video elements with detected female faces.
 * Manages concurrency, caching, and canvas overlay rendering.
 */

class MediaProcessor {
  constructor(modelEngine) {
    this.engine = modelEngine;
    this.processedCache = new Map();
    this.activeTasks = 0;
    this.maxConcurrency = 3;
    this.queue = [];
    this.stats = { processed: 0, detected: 0 };
    this.blurIntensity = 25;
    this.processImages = true;
    this.processVideos = true;
    this._videoIntervals = new Map();
  }

  updateSettings(settings) {
    this.blurIntensity = settings.blurIntensity ?? 25;
    this.processImages = settings.processImages ?? true;
    this.processVideos = settings.processVideos ?? true;
    this.engine.setEngine(settings.detectionEngine || 'hybrid');
    this.engine.setConfidenceThreshold(settings.confidenceThreshold ?? 0.6);
  }

  getStats() {
    return { ...this.stats };
  }

  /**
   * Process an image element: detect faces and apply blur overlay.
   */
  async processImage(img) {
    if (!this.processImages) return;
    if (!img.complete || !img.naturalWidth || img.naturalWidth < 50) return;

    const cacheKey = img.src || img.dataset.blurId;
    if (!cacheKey) return;

    if (this.processedCache.has(cacheKey)) {
      const cached = this.processedCache.get(cacheKey);
      if (cached.timestamp > Date.now() - 60000) return;
    }

    return this._enqueue(() => this._processImageElement(img, cacheKey));
  }

  /**
   * Process a video element: start periodic face detection and blur.
   */
  processVideo(video) {
    if (!this.processVideos) return;
    if (this._videoIntervals.has(video)) return;

    const processFrame = async () => {
      if (video.paused || video.ended || !video.videoWidth) return;
      await this._enqueue(() => this._processVideoFrame(video));
    };

    video.addEventListener('play', () => {
      if (this._videoIntervals.has(video)) return;
      const interval = setInterval(processFrame, 500);
      this._videoIntervals.set(video, interval);
    });

    video.addEventListener('pause', () => this._stopVideoProcessing(video));
    video.addEventListener('ended', () => this._stopVideoProcessing(video));

    if (!video.paused && video.readyState >= 2) {
      const interval = setInterval(processFrame, 500);
      this._videoIntervals.set(video, interval);
    }
  }

  _stopVideoProcessing(video) {
    const interval = this._videoIntervals.get(video);
    if (interval) {
      clearInterval(interval);
      this._videoIntervals.delete(video);
    }
  }

  _enqueue(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this._processQueue();
    });
  }

  async _processQueue() {
    if (this.activeTasks >= this.maxConcurrency || this.queue.length === 0) return;

    this.activeTasks++;
    const { task, resolve, reject } = this.queue.shift();

    try {
      const result = await task();
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      this.activeTasks--;
      this._processQueue();
    }
  }

  async _processImageElement(img, cacheKey) {
    try {
      const faces = await this.engine.detect(img);
      this.stats.processed++;

      if (faces.length === 0) {
        this.processedCache.set(cacheKey, { faces: [], timestamp: Date.now() });
        return;
      }

      this.stats.detected += faces.length;
      this.processedCache.set(cacheKey, { faces, timestamp: Date.now() });
      this._applyImageBlur(img, faces);
    } catch (err) {
      console.error('[BlurFemaleAI] Image processing error:', err);
    }
  }

  async _processVideoFrame(video) {
    try {
      const faces = await this.engine.detect(video);
      this.stats.processed++;

      const overlay = this._getOrCreateVideoOverlay(video);
      const ctx = overlay.getContext('2d');
      ctx.clearRect(0, 0, overlay.width, overlay.height);

      if (faces.length === 0) return;

      this.stats.detected += faces.length;
      this._drawBlurRegions(ctx, video, faces, overlay.width, overlay.height);
    } catch (err) {
      console.error('[BlurFemaleAI] Video processing error:', err);
    }
  }

  _applyImageBlur(img, faces) {
    let wrapper = img.parentElement;
    if (!wrapper?.classList.contains('blur-female-ai-wrapper')) {
      wrapper = document.createElement('div');
      wrapper.classList.add('blur-female-ai-wrapper');
      wrapper.style.position = 'relative';
      wrapper.style.display = 'inline-block';
      wrapper.style.width = img.clientWidth + 'px';
      wrapper.style.height = img.clientHeight + 'px';
      img.parentNode.insertBefore(wrapper, img);
      wrapper.appendChild(img);
    }

    let canvas = wrapper.querySelector('.blur-female-ai-overlay');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.classList.add('blur-female-ai-overlay');
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '10';
      wrapper.appendChild(canvas);
    }

    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = img.clientWidth / (img.naturalWidth || img.clientWidth);
    const scaleY = img.clientHeight / (img.naturalHeight || img.clientHeight);

    for (const face of faces) {
      const x = face.box.x * scaleX;
      const y = face.box.y * scaleY;
      const w = face.box.width * scaleX;
      const h = face.box.height * scaleY;

      ctx.save();
      ctx.filter = `blur(${this.blurIntensity}px)`;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2 + 10, h / 2 + 10, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  }

  _getOrCreateVideoOverlay(video) {
    let wrapper = video.parentElement;
    if (!wrapper?.classList.contains('blur-female-ai-wrapper')) {
      wrapper = document.createElement('div');
      wrapper.classList.add('blur-female-ai-wrapper');
      wrapper.style.position = 'relative';
      wrapper.style.display = 'inline-block';
      video.parentNode.insertBefore(wrapper, video);
      wrapper.appendChild(video);
    }

    let canvas = wrapper.querySelector('.blur-female-ai-overlay');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.classList.add('blur-female-ai-overlay');
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '10';
      wrapper.appendChild(canvas);
    }

    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;
    return canvas;
  }

  _drawBlurRegions(ctx, source, faces, canvasW, canvasH) {
    const sourceW = source.videoWidth || source.naturalWidth || source.clientWidth;
    const sourceH = source.videoHeight || source.naturalHeight || source.clientHeight;
    const scaleX = canvasW / sourceW;
    const scaleY = canvasH / sourceH;

    for (const face of faces) {
      const x = face.box.x * scaleX;
      const y = face.box.y * scaleY;
      const w = face.box.width * scaleX;
      const h = face.box.height * scaleY;

      ctx.save();
      ctx.filter = `blur(${this.blurIntensity}px)`;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2 + 10, h / 2 + 10, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(source, 0, 0, canvasW, canvasH);
      ctx.restore();
    }
  }

  /**
   * Remove all blur overlays and clean up.
   */
  cleanup() {
    for (const [video, interval] of this._videoIntervals) {
      clearInterval(interval);
    }
    this._videoIntervals.clear();

    document.querySelectorAll('.blur-female-ai-overlay').forEach(el => el.remove());
    document.querySelectorAll('.blur-female-ai-wrapper').forEach(wrapper => {
      const child = wrapper.firstElementChild;
      if (child) {
        wrapper.parentNode.insertBefore(child, wrapper);
      }
      wrapper.remove();
    });

    this.processedCache.clear();
    this.stats = { processed: 0, detected: 0 };
  }
}

window.BlurFemaleAI = window.BlurFemaleAI || {};
window.BlurFemaleAI.MediaProcessor = MediaProcessor;
