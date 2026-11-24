// Transcode a video to H.264 at a maximum width and a target bitrate. No
// audio (the hero is muted), unless a fifth argument, `audio`, asks for the
// sound to be kept as AAC (the full film). Used by optimize-media.mjs.
//   transcode <in> <out> <maxWidth> <bitsPerSecond> [audio]
import AVFoundation
import Foundation

let a = CommandLine.arguments
guard a.count == 5 || a.count == 6, let maxW = Double(a[3]), let bps = Int(a[4]) else {
  FileHandle.standardError.write("usage: transcode <in> <out> <maxWidth> <bitsPerSecond> [audio]\n".data(using: .utf8)!); exit(2)
}
let keepAudio = a.count == 6 && a[5] == "audio"
let inURL = URL(fileURLWithPath: a[1]), outURL = URL(fileURLWithPath: a[2])
try? FileManager.default.removeItem(at: outURL)

let asset = AVURLAsset(url: inURL)
guard let track = asset.tracks(withMediaType: .video).first else { FileHandle.standardError.write("no video track\n".data(using: .utf8)!); exit(1) }
let size = track.naturalSize.applying(track.preferredTransform)
let srcW = abs(size.width), srcH = abs(size.height)
let k = min(1.0, maxW / Double(srcW))
// H.264 wants even dimensions.
let outW = Int((Double(srcW) * k / 2).rounded()) * 2, outH = Int((Double(srcH) * k / 2).rounded()) * 2

let reader = try AVAssetReader(asset: asset)
let readerOut = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
reader.add(readerOut)

let writer = try AVAssetWriter(outputURL: outURL, fileType: .mp4)
writer.shouldOptimizeForNetworkUse = true
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264,
  AVVideoWidthKey: outW, AVVideoHeightKey: outH,
  AVVideoScalingModeKey: AVVideoScalingModeResizeAspectFill,
  AVVideoCompressionPropertiesKey: [
    AVVideoAverageBitRateKey: bps,
    AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
    AVVideoMaxKeyFrameIntervalKey: 48,
  ],
])
input.transform = track.preferredTransform
input.expectsMediaDataInRealTime = false
writer.add(input)

// The sound, decoded to PCM and re-encoded as stereo AAC.
var audioPair: (AVAssetReaderTrackOutput, AVAssetWriterInput)? = nil
if keepAudio, let at = asset.tracks(withMediaType: .audio).first {
  let out = AVAssetReaderTrackOutput(track: at, outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM])
  reader.add(out)
  let ain = AVAssetWriterInput(mediaType: .audio, outputSettings: [
    AVFormatIDKey: kAudioFormatMPEG4AAC, AVNumberOfChannelsKey: 2, AVSampleRateKey: 48000, AVEncoderBitRateKey: 160_000,
  ])
  ain.expectsMediaDataInRealTime = false
  writer.add(ain)
  audioPair = (out, ain)
}

reader.startReading()
writer.startWriting()
writer.startSession(atSourceTime: .zero)
// Each track is pumped on its own queue; the file is finished when both are.
let group = DispatchGroup()
func pump(_ out: AVAssetReaderTrackOutput, _ inp: AVAssetWriterInput, _ label: String) {
  group.enter()
  var finished = false
  inp.requestMediaDataWhenReady(on: DispatchQueue(label: label)) {
    while inp.isReadyForMoreMediaData && !finished {
      if let buf = out.copyNextSampleBuffer() { inp.append(buf) }
      else { finished = true; inp.markAsFinished(); group.leave() }
    }
  }
}
pump(readerOut, input, "video")
if let (out, ain) = audioPair { pump(out, ain, "audio") }
group.wait()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
if writer.status != .completed { FileHandle.standardError.write("failed: \(String(describing: writer.error))\n".data(using: .utf8)!); exit(1) }
print("\(outW)x\(outH)")
