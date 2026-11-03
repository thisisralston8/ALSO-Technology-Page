// Transcode a video to H.264 at a maximum width and a target bitrate, with no
// audio (the hero is muted). Used by optimize-media.mjs.
//   transcode <in> <out> <maxWidth> <bitsPerSecond>
import AVFoundation
import Foundation

let a = CommandLine.arguments
guard a.count == 5, let maxW = Double(a[3]), let bps = Int(a[4]) else {
  FileHandle.standardError.write("usage: transcode <in> <out> <maxWidth> <bitsPerSecond>\n".data(using: .utf8)!); exit(2)
}
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

reader.startReading()
writer.startWriting()
writer.startSession(atSourceTime: .zero)
let q = DispatchQueue(label: "transcode")
let done = DispatchSemaphore(value: 0)
input.requestMediaDataWhenReady(on: q) {
  while input.isReadyForMoreMediaData {
    if let buf = readerOut.copyNextSampleBuffer() { input.append(buf) }
    else { input.markAsFinished(); writer.finishWriting { done.signal() }; return }
  }
}
done.wait()
if writer.status != .completed { FileHandle.standardError.write("failed: \(String(describing: writer.error))\n".data(using: .utf8)!); exit(1) }
print("\(outW)x\(outH)")
