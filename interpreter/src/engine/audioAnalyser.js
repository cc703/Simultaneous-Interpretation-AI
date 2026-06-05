import { useStore } from '../store/index.js';

let audioContext = null;
let analyser = null;
let animationFrameId = null;
let mediaElementSource = null;
let mediaStreamSource = null;
const elementSourceMap = new WeakMap();

export function startElementAnalyser(audioElement) {
  if (!audioElement) return;
  stopAudioAnalyser();
  audioContext = getAudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 64;
  mediaElementSource = elementSourceMap.get(audioElement) ?? audioContext.createMediaElementSource(audioElement);
  elementSourceMap.set(audioElement, mediaElementSource);
  mediaElementSource.connect(analyser);
  analyser.connect(audioContext.destination);
  audioContext.resume?.();
  drawWaveform();
}

export function startStreamAnalyser(stream) {
  if (!stream) return;
  stopAudioAnalyser();
  audioContext = getAudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 64;
  mediaStreamSource = audioContext.createMediaStreamSource(stream);
  mediaStreamSource.connect(analyser);
  audioContext.resume?.();
  drawWaveform();
}

export function stopAudioAnalyser() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  mediaElementSource?.disconnect();
  mediaStreamSource?.disconnect();
  analyser?.disconnect();
  mediaElementSource = null;
  mediaStreamSource = null;
  analyser = null;

  audioContext?.suspend?.().catch(() => {});

  useStore.getState().setWaveformData([]);
}

function getAudioContext() {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function drawWaveform() {
  if (!analyser) return;

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);
  useStore.getState().setWaveformData(Array.from(dataArray));
  animationFrameId = requestAnimationFrame(drawWaveform);
}
