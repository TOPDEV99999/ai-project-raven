/**
 * AudioWorklet processor code as a blob URL.
 * Captures microphone audio with heartbeat keep-alive.
 */

const processorCode = `
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;

    this.isCapturing = true;
    this.frameCount = 0;
    this.heartbeatInterval = 128;

    this.port.onmessage = (event) => {
      const { command } = event.data || {};

      if (command === "stop") {
        this.isCapturing = false;
      }

      if (command === "start") {
        this.isCapturing = true;
      }
    };

    this.port.postMessage({
      type: "init",
      message: "AudioWorklet initialized"
    });
  }

  process(inputs) {
    this.frameCount++;

    if (this.frameCount % this.heartbeatInterval === 0) {
      this.port.postMessage({
        type: "heartbeat",
        frames: this.frameCount
      });
    }

    if (!this.isCapturing) {
      return true;
    }

    const input = inputs[0];

    if (!input || !input.length) {
      return true;
    }

    const channelData = input[0];

    if (!channelData) {
      return true;
    }

    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.bufferIndex++] = channelData[i];

      if (this.bufferIndex >= this.bufferSize) {

        // Transfer ArrayBuffer to main thread
        this.port.postMessage(
          {
            type: "audio",
            buffer: this.buffer.buffer
          },
          [this.buffer.buffer]
        );

        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor(
  "audio-capture-processor",
  AudioCaptureProcessor
);
`;

const workletUrls = new Map<string, string>();

export function getWorkletUrl(
  processorName = "audio-capture-processor"
): string {

  const existing = workletUrls.get(processorName);

  if (existing) {
    return existing;
  }

  const code = processorCode.replace(
    /audio-capture-processor/g,
    processorName
  );

  const blob = new Blob(
    [code],
    { type: "application/javascript" }
  );

  const url = URL.createObjectURL(blob);

  workletUrls.set(processorName, url);

  return url;
}

export function revokeWorkletUrls() {
  for (const url of workletUrls.values()) {
    URL.revokeObjectURL(url);
  }

  workletUrls.clear();
}
