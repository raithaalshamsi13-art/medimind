// On-device printed-text recognition for medicine labels (Apple Vision).
//
// A local Expo module: it compiles into the MediMind development build and
// is absent in Expo Go. The JavaScript side (`modules/label-ocr/index.ts`)
// checks for it with `requireOptionalNativeModule` and falls back to the
// server reader when it is missing.
//
// What it does: runs VNRecognizeTextRequest on a photo file and returns the
// recognised lines with their confidence and position. It transcribes the
// printed words only — it has no idea what a medicine is. Working out the
// name, strength, form and expiry from those lines happens in TypeScript
// (`src/domain/labelText.ts`), where it can be unit-tested.
//
// Language correction is OFF on purpose: Vision would otherwise "fix"
// medicine names into dictionary words.

import ExpoModulesCore
import UIKit
import Vision

public final class LabelOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LabelOcr")

    Constants([
      "supportedLanguages": LabelOcrModule.supportedLanguages()
    ])

    AsyncFunction("recognize") { (uri: String, languages: [String], promise: Promise) in
      guard
        let url = URL(string: uri),
        let data = try? Data(contentsOf: url),
        let image = UIImage(data: data),
        let cgImage = image.cgImage
      else {
        promise.reject("E_IMAGE", "The photo could not be opened for text recognition.")
        return
      }

      let request = VNRecognizeTextRequest { request, error in
        if let error = error {
          promise.reject("E_VISION", error.localizedDescription)
          return
        }
        let observations = (request.results as? [VNRecognizedTextObservation]) ?? []
        var lines: [[String: Any]] = []
        for observation in observations {
          guard let candidate = observation.topCandidates(1).first else { continue }
          let box = observation.boundingBox // normalised, origin bottom-left
          lines.append([
            "text": candidate.string,
            "confidence": Double(candidate.confidence),
            "x": Double(box.minX),
            // Flip to top-left origin so JavaScript can sort top-to-bottom.
            "y": Double(1.0 - box.maxY),
            "width": Double(box.width),
            "height": Double(box.height),
          ])
        }
        promise.resolve(["lines": lines])
      }

      request.recognitionLevel = .accurate
      request.usesLanguageCorrection = false
      let supported = LabelOcrModule.supportedLanguages()
      let wanted = languages.filter { supported.contains($0) }
      request.recognitionLanguages = wanted.isEmpty ? ["en-US"] : wanted
      if #available(iOS 16.0, *) {
        request.automaticallyDetectsLanguage = false
      }

      let handler = VNImageRequestHandler(
        cgImage: cgImage,
        orientation: LabelOcrModule.orientation(from: image.imageOrientation),
        options: [:]
      )
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          try handler.perform([request])
        } catch {
          promise.reject("E_VISION", error.localizedDescription)
        }
      }
    }
  }

  private static func supportedLanguages() -> [String] {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    return (try? request.supportedRecognitionLanguages()) ?? ["en-US"]
  }

  private static func orientation(from orientation: UIImage.Orientation) -> CGImagePropertyOrientation {
    switch orientation {
    case .up: return .up
    case .upMirrored: return .upMirrored
    case .down: return .down
    case .downMirrored: return .downMirrored
    case .left: return .left
    case .leftMirrored: return .leftMirrored
    case .right: return .right
    case .rightMirrored: return .rightMirrored
    @unknown default: return .up
    }
  }
}
