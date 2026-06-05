export async function startSystemAudioCapture({ onAudioStream, onError } = {}) {
  try {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('getDisplayMedia is not available in this browser.');
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        sampleRate: 44100,
      },
    });

    const audioTracks = stream.getAudioTracks();
    const videoLabel = stream.getVideoTracks()[0]?.label ?? 'Shared screen';
    const audioStream = new MediaStream(audioTracks);

    stream.getVideoTracks().forEach((track) => track.stop());
    onAudioStream?.({ audioStream, label: videoLabel, rawStream: stream });

    return { audioStream, label: videoLabel, rawStream: stream };
  } catch (error) {
    onError?.(error);
    throw error;
  }
}

export function stopSystemAudioCapture(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
}
