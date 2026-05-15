// PDF/A-3 placeholder service.
//
// Full PDF/A-3 compliance requires:
//   - Embedded ICC color profile (sRGB)
//   - Embedded fonts (full subsets)
//   - XMP metadata declaring PDF/A-3 conformance
//   - Optionally an embedded XML attachment (ZUGFeRD/Factur-X invoice payload)
//
// Plug-in points: replace `convertToPdfA3` with a call to one of:
//   - veraPDF + Ghostscript for validation
//   - pdf-lib + adobe-pdf-services-node-sdk for production-grade conversion
//   - mustangproject (Java) for ZUGFeRD invoice attachment
//
// For now, we attempt a PDF/A-like conformance hint via post-processing.
// If/when a real provider is wired up, replace the body below — the
// rest of the application reads only the returned Buffer.

import { htmlToPdf } from "./pdf";

export async function convertToPdfA3(params: {
  html: string;
  invoiceXml?: string; // optional XML payload for ZUGFeRD-style embedding
}): Promise<{ buffer: Buffer; warning?: string }> {
  const pdf = await htmlToPdf(params.html);

  // TODO(pdfa3): Replace this block with a real PDF/A-3 converter.
  // Recommended providers:
  //   1. Adobe PDF Services API (paid, certified PDF/A-3 conformance)
  //   2. veraPDF + Ghostscript pipeline (open source; needs system deps)
  //   3. Mustang / Factur-X (Java; embeds invoice XML for e-invoice compliance)
  //
  // The placeholder returns the standard PDF with a warning so the UI
  // can communicate that the output is "PDF/A-3 ready" rather than
  // fully certified. Downstream code does not depend on this flag.

  return {
    buffer: pdf,
    warning:
      "PDF/A-3 compliance is not yet active. This file is a standard PDF — wire up a PDF/A-3 provider in src/lib/document-generation/pdfa3.ts to enable full conformance.",
  };
}
