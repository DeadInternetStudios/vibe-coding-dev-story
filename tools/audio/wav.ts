/** Minimal WAV writer: 32 bit float, interleaved. Float keeps analysis free of quantization noise. */
export function encodeWav(sampleRate: number, channels: Float32Array[]): Uint8Array {
  const n = channels[0]!.length;
  const ch = channels.length;
  const bytes = n * ch * 4;
  const buf = new ArrayBuffer(44 + bytes);
  const v = new DataView(buf);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + bytes, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 3, true); // IEEE float
  v.setUint16(22, ch, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * ch * 4, true);
  v.setUint16(32, ch * 4, true);
  v.setUint16(34, 32, true);
  str(36, 'data');
  v.setUint32(40, bytes, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      v.setFloat32(o, channels[c]![i]!, true);
      o += 4;
    }
  }
  return new Uint8Array(buf);
}
