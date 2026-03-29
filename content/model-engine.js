/**
 * Model Engine
 * Abstraction layer for face detection engines: Face-API.js, TensorFlow.js, and Hybrid mode.
 * Handles model loading, inference, and gender classification.
 */

class ModelEngine {
  constructor() {
    this.faceApiLoaded = false;
    this.tfLoaded = false;
    this.activeEngine = 'hybrid';
    this.confidenceThreshold = 0.6;
    this._loadingFaceApi = null;
    this._loadingTf = null;
  }

  setEngine(engine) {
    this.activeEngine = engine;
  }

  setConfidenceThreshold(threshold) {
    this.confidenceThreshold = threshold;
  }

  async initialize(engine) {
    this.activeEngine = engine || this.activeEngine;

    switch (this.activeEngine) {
      case 'faceapi':
        await this._loadFaceApi();
        break;
      case 'tensorflow':
        await this._loadTensorFlow();
        break;
      case 'hybrid':
        await Promise.all([this._loadFaceApi(), this._loadTensorFlow()]);
        break;
    }
  }

  async _loadFaceApi() {
    if (this.faceApiLoaded) return;
    if (this._loadingFaceApi) return this._loadingFaceApi;

    this._loadingFaceApi = (async () => {
      try {
        await this._injectScript(chrome.runtime.getURL('lib/face-api.min.js'));
        if (typeof faceapi === 'undefined') {
          throw new Error('face-api.js failed to load');
        }
        const modelPath = chrome.runtime.getURL('models/');
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(modelPath),
          faceapi.nets.ageGenderNet.loadFromUri(modelPath),
        ]);
        this.faceApiLoaded = true;
        console.log('[BlurFemaleAI] Face-API.js models loaded');
      } catch (err) {
        console.error('[BlurFemaleAI] Face-API.js load error:', err);
        throw err;
      }
    })();

    return this._loadingFaceApi;
  }

  async _loadTensorFlow() {
    if (this.tfLoaded) return;
    if (this._loadingTf) return this._loadingTf;

    this._loadingTf = (async () => {
      try {
        await this._injectScript(chrome.runtime.getURL('lib/tf.min.js'));
        await this._injectScript(chrome.runtime.getURL('lib/blazeface.min.js'));
        if (typeof blazeface === 'undefined') {
          throw new Error('BlazeFace failed to load');
        }
        this._blazefaceModel = await blazeface.load();
        this.tfLoaded = true;
        console.log('[BlurFemaleAI] TensorFlow.js + BlazeFace loaded');
      } catch (err) {
        console.error('[BlurFemaleAI] TensorFlow.js load error:', err);
        throw err;
      }
    })();

    return this._loadingTf;
  }

  _injectScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      (document.head || document.documentElement).appendChild(script);
    });
  }

  /**
   * Detect female faces in a given image or video element.
   * Returns array of { box: {x, y, width, height}, confidence, source }
   */
  async detect(element) {
    switch (this.activeEngine) {
      case 'faceapi':
        return this._detectFaceApi(element);
      case 'tensorflow':
        return this._detectTensorFlow(element);
      case 'hybrid':
        return this._detectHybrid(element);
      default:
        return this._detectFaceApi(element);
    }
  }

  async _detectFaceApi(element) {
    if (!this.faceApiLoaded) await this._loadFaceApi();

    try {
      const detections = await faceapi
        .detectAllFaces(element, new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.5,
        }))
        .withAgeAndGender();

      return detections
        .filter(d => d.gender === 'female' && d.genderProbability >= this.confidenceThreshold)
        .map(d => ({
          box: {
            x: d.detection.box.x,
            y: d.detection.box.y,
            width: d.detection.box.width,
            height: d.detection.box.height,
          },
          confidence: d.genderProbability,
          source: 'faceapi',
        }));
    } catch (err) {
      console.error('[BlurFemaleAI] Face-API detection error:', err);
      return [];
    }
  }

  async _detectTensorFlow(element) {
    if (!this.tfLoaded) await this._loadTensorFlow();

    try {
      const canvas = this._elementToCanvas(element);
      const predictions = await this._blazefaceModel.estimateFaces(canvas, false);

      // BlazeFace doesn't classify gender — return all faces with a flag
      return predictions.map(pred => {
        const start = pred.topLeft;
        const end = pred.bottomRight;
        return {
          box: {
            x: start[0],
            y: start[1],
            width: end[0] - start[0],
            height: end[1] - start[1],
          },
          confidence: pred.probability?.[0] ?? pred.probability ?? 0.9,
          source: 'tensorflow',
          genderUnknown: true,
        };
      });
    } catch (err) {
      console.error('[BlurFemaleAI] TensorFlow detection error:', err);
      return [];
    }
  }

  async _detectHybrid(element) {
    // Use TensorFlow BlazeFace for fast face detection,
    // then Face-API for gender classification on detected regions.
    const tfResults = await this._detectTensorFlow(element);
    if (tfResults.length === 0) return [];

    if (!this.faceApiLoaded) await this._loadFaceApi();

    try {
      const canvas = this._elementToCanvas(element);
      const detections = await faceapi
        .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.4,
        }))
        .withAgeAndGender();

      const femaleFaces = detections
        .filter(d => d.gender === 'female' && d.genderProbability >= this.confidenceThreshold)
        .map(d => d.detection.box);

      // Match TF detections with face-api gender results
      return tfResults.filter(tfFace => {
        return femaleFaces.some(fBox => this._boxesOverlap(tfFace.box, fBox));
      }).map(face => ({
        ...face,
        source: 'hybrid',
        genderUnknown: false,
      }));
    } catch {
      // Fallback: if gender classification fails, return TF results as-is
      return tfResults;
    }
  }

  _boxesOverlap(a, b) {
    const aRight = a.x + a.width;
    const aBottom = a.y + a.height;
    const bRight = b.x + b.width;
    const bBottom = b.y + b.height;

    return !(aRight < b.x || a.x > bRight || aBottom < b.y || a.y > bBottom);
  }

  _elementToCanvas(element) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (element instanceof HTMLVideoElement) {
      canvas.width = element.videoWidth || element.clientWidth;
      canvas.height = element.videoHeight || element.clientHeight;
    } else {
      canvas.width = element.naturalWidth || element.width;
      canvas.height = element.naturalHeight || element.height;
    }

    ctx.drawImage(element, 0, 0, canvas.width, canvas.height);
    return canvas;
  }
}

// Export as global for content scripts
window.BlurFemaleAI = window.BlurFemaleAI || {};
window.BlurFemaleAI.ModelEngine = ModelEngine;
