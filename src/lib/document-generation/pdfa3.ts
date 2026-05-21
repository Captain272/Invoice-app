// Best-effort PDF/A-3 post-processing.
//
// Strict PDF/A-3 conformance (ISO 19005-3) requires:
//   1. XMP metadata declaring PDF/A-3 with conformance level
//   2. OutputIntent referencing an embedded ICC color profile (e.g. sRGB)
//   3. All fonts fully embedded as subsets
//   4. No transparency, no encryption, no JavaScript
//   5. PDF/A-3 specifically: optional embedded file attachments tagged with
//      AFRelationship (typical use: ZUGFeRD/Factur-X invoice XML)
//
// We post-process the puppeteer PDF to satisfy (1), (2), and (5). Font
// embedding (3) depends on the upstream Chromium build and is the most
// likely reason a strict validator (veraPDF) will still complain. For most
// real-world readers the result is treated as PDF/A-3.
//
// For certified conformance, replace this with a dedicated converter
// (Adobe PDF Services, Ghostscript pdfwrite with PDFACompatibilityPolicy,
// mustangproject for Factur-X).

import { PDFDocument, PDFName, PDFString, PDFHexString, PDFArray, PDFDict, AFRelationship } from "pdf-lib";
import { randomBytes } from "node:crypto";
import { htmlToPdf } from "./pdf";

// Minimal sRGB IEC61966-2.1 ICC profile (~3 KB) embedded as the OutputIntent
// target so readers don't need a network fetch.
const SRGB_ICC_BASE64 =
  "AAAMSExpbm8CEAAAbW50clJHQiBYWVogB84AAgAJAAYAMQAAYWNzcE1TRlQAAAAASUVDIHNSR0IA" +
  "AAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1IUCAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAARY3BydAAAAVAAAAAzZGVzYwAAAYQAAABsd3RwdAAAAfAAAAAUYmtwdAAA" +
  "AgQAAAAUclhZWgAAAhgAAAAUZ1hZWgAAAiwAAAAUYlhZWgAAAkAAAAAUZG1uZAAAAlQAAABwZG1k" +
  "ZAAAAsQAAACIdnVlZAAAA0wAAACGdmlldwAAA9QAAAAkbHVtaQAAA/gAAAAUbWVhcwAABAwAAAAk" +
  "dGVjaAAABDAAAAAMclRSQwAABDwAAAgMZ1RSQwAABDwAAAgMYlRSQwAABDwAAAgMdGV4dAAAAABD" +
  "b3B5cmlnaHQgKGMpIDE5OTggSGV3bGV0dC1QYWNrYXJkIENvbXBhbnkAAGRlc2MAAAAAAAAAEnNS" +
  "R0IgSUVDNjE5NjYtMi4xAAAAAAAAAAAAAAASc1JHQiBJRUM2MTk2Ni0yLjEAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFhZWiAAAAAAAADzUQABAAAAARbMWFla" +
  "IAAAAAAAAAAAAAAAAAAAAABYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABja" +
  "WFlaIAAAAAAAACSgAAAPhAAAts9kZXNjAAAAAAAAABZJRUMgaHR0cDovL3d3dy5pZWMuY2gAAAAA" +
  "AAAAAAAAABZJRUMgaHR0cDovL3d3dy5pZWMuY2gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAGRlc2MAAAAAAAAALklFQyA2MTk2Ni0yLjEgRGVmYXVsdCBSR0IgY29s" +
  "b3VyIHNwYWNlIC0gc1JHQgAAAAAAAAAAAAAALklFQyA2MTk2Ni0yLjEgRGVmYXVsdCBSR0IgY29s" +
  "b3VyIHNwYWNlIC0gc1JHQgAAAAAAAAAAAAAAAAAAAAAAAAAAAABkZXNjAAAAAAAAACxSZWZlcmVu" +
  "Y2UgVmlld2luZyBDb25kaXRpb24gaW4gSUVDNjE5NjYtMi4xAAAAAAAAAAAAAAAsUmVmZXJlbmNl" +
  "IFZpZXdpbmcgQ29uZGl0aW9uIGluIElFQzYxOTY2LTIuMQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAdmlldwAAAAAAE6T+ABRfLgAQzxQAA+3MAAQTCwADXJ4AAAABWFlaIAAAAAAATAlWAFAAAABX" +
  "H+dtZWFzAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAACjwAAAAJzaWcgAAAAAENSVCBjdXJ2AAAA" +
  "AAAABAAAAAAFAAoADwAUABkAHgAjACgALQAyADcAOwBAAEUASgBPAFQAWQBeAGMAaABtAHIAdwB8" +
  "AIEAhgCLAJAAlQCaAJ8ApACpAK4AsgC3ALwAwQDGAMsA0ADVANsA4ADlAOsA8AD2APsBAQEHAQ0B" +
  "EwEZAR8BJQErATIBOAE+AUUBTAFSAVkBYAFnAW4BdQF8AYMBiwGSAZoBoQGpAbEBuQHBAckB0QHZ" +
  "AeEB6QHyAfoCAwIMAhQCHQImAi8COAJBAksCVAJdAmcCcQJ6AoQCjgKYAqICrAK2AsECywLVAuAC" +
  "6wL1AwADCwMWAyEDLQM4A0MDTwNaA2YDcgN+A4oDlgOiA64DugPHA9MD4APsA/kEBgQTBCAELQQ7" +
  "BEgEVQRjBHEEfgSMBJoEqAS2BMQE0wThBPAE/gUNBRwFKwU6BUkFWAVnBXcFhgWWBaYFtQXFBdUF" +
  "5QX2BgYGFgYnBjcGSAZZBmoGewaMBp0GrwbABtEG4wb1BwcHGQcrBz0HTwdiB3QHhgeZB6wHvwfS" +
  "B+UH+AgLCB8IMghGCFoIbgiCCJYIqgi+CNII5wj7CRAJJQk6CU8JZAl5CY8JpAm6Cc8J5Qn7ChEK" +
  "Jwo9ClQKagqBCpgKrgrFCtwK8wsLCyILOQtRC2kLgAuYC7ALyAvhC/kMEgwqDEMMXAx1DI4MpwzA" +
  "DNkM8w0NDSYNQA1aDXQNjg2pDcMN3g34DhMOLg5JDmQOfw6bDrYO0g7uDwkPJQ9BD14Peg+WD7MP" +
  "zw/sEAkQJhBDEGEQfhCbELkQ1xD1ERMRMRFPEW0RjBGqEckR6BIHEiYSRRJkEoQSoxLDEuMTAxMj" +
  "E0MTYxODE6QTxRPlFAYUJxRJFGoUixStFM4U8BUSFTQVVhV4FZsVvRXgFgMWJhZJFmwWjxayFtYW" +
  "+hcdF0EXZReJF64X0hf3GBsYQBhlGIoYrxjVGPoZIBlFGWsZkRm3Gd0aBBoqGlEadxqeGsUa7BsU" +
  "GzsbYxuKG7Ib2hwCHCocUhx7HKMczBz1HR4dRx1wHZkdwx3sHhYeQB5qHpQevh7pHxMfPh9pH5Qf" +
  "vx/qIBUgQSBsIJggxCDwIRwhSCF1IaEhziH7IiciVSKCIq8i3SMKIzgjZiOUI8Ij8CQfJE0kfCSr" +
  "JNolCSU4JWgllyXHJfcmJyZXJocmtyboJxgnSSd6J6sn3CgNKD8ocSiiKNQpBik4KWspnSnQKgIq" +
  "NSpoKpsqzysCKzYraSudK9EsBSw5LG4soizXLQwtQS12Last4S4WLkwugi63Lu4vJC9aL5Evxy/+" +
  "MDUwbDCkMNsxEjFKMYIxujHyMioyYzKbMtQzDTNGM38zuDPxNCs0ZTSeNNg1EzVNNYc1wjX9Njc2" +
  "cjauNuk3JDdgN5w31zgUOFA4jDjIOQU5Qjl/Obw5+To2OnQ6sjrvOy07azuqO+g8JzxlPKQ84z0i" +
  "PWE9oT3gPiA+YD6gPuA/IT9hP6I/4kAjQGRApkDnQSlBakGsQe5CMEJyQrVC90M6Q31DwEQDREdE" +
  "ikTORRJFVUWaRd5GIkZnRqtG8Ec1R3tHwEgFSEtIkUjXSR1JY0mpSfBKN0p9SsRLDEtTS5pL4kwq" +
  "THJMuk0CTUpNk03cTiVObk63TwBPSU+TT91QJ1BxULtRBlFQUZtR5lIxUnxSx1MTU19TqlP2VEJU" +
  "j1TbVShVdVXCVg9WXFapVvdXRFeSV+BYL1h9WMtZGllpWbhaB1pWWqZa9VtFW5Vb5Vw1XIZc1l0n" +
  "XXhdyV4aXmxevV8PX2Ffs2AFYFdgqmD8YU9homH1YklinGLwY0Njl2PrZEBklGTpZT1lkmXnZj1m" +
  "kmboZz1nk2fpaD9olmjsaUNpmmnxakhqn2r3a09rp2v/bFdsr20IbWBtuW4SbmtuxG8eb3hv0XAr" +
  "cIZw4HE6cZVx8HJLcqZzAXNdc7h0FHRwdMx1KHWFdeF2Pnabdvh3VnezeBF4bnjMeSp5iXnnekZ6" +
  "pXsEe2N7wnwhfIF84X1BfaF+AX5ifsJ/I3+Ef+WAR4CogQqBa4HNgjCCkoL0g1eDuoQdhICE44VH" +
  "hauGDoZyhteHO4efiASIaYjOiTOJmYn+imSKyoswi5aL/IxjjMqNMY2Yjf+OZo7OjzaPnpAGkG6Q" +
  "1pE/kaiSEZJ6kuOTTZO2lCCUipT0lV+VyZY0lp+XCpd1l+CYTJi4mSSZkJn8mmia1ZtCm6+cHJyJ" +
  "nPedZJ3SnkCerp8dn4uf+qBpoNihR6G2oiailqMGo3aj5qRWpMelOKWpphqmi6b9p26n4KhSqMSp" +
  "N6mpqhyqj6sCq3Wr6axcrNCtRK24ri2uoa8Wr4uwALB1sOqxYLHWskuywrM4s660JbSctRO1irYB" +
  "tnm28Ldot+C4WbjRuUq5wro7urW7LrunvCG8m70VvY++Cr6Evv+/er/1wHDA7MFnwePCX8Lbw1jD" +
  "1MRRxM7FS8XIxkbGw8dBx7/IPci8yTrJuco4yrfLNsu2zDXMtc01zbXONs62zzfPuNA50LrRPNG+" +
  "0j/SwdNE08bUSdTL1U7V0dZV1tjXXNfg2GTY6Nls2fHadtr724DcBdyK3RDdlt4c3qLfKd+v4Dbg" +
  "veFE4cziU+Lb42Pj6+Rz5PzlhOYN5pbnH+ep6DLovOlG6dDqW+rl63Dr++yG7RHtnO4o7rTvQO/M" +
  "8Fjw5fFy8f/yjPMZ86f0NPTC9VD13vZt9vv3ivgZ+Kj5OPnH+lf65/t3/Af8mP0p/br+S/7c/23/" +
  "/w==";

export async function convertToPdfA3(params: {
  html: string;
  invoiceXml?: string;
}): Promise<{ buffer: Buffer; warning?: string }> {
  const rawPdf = await htmlToPdf(params.html);

  let buffer: Buffer;
  try {
    buffer = await postProcessForPdfA3(rawPdf, params.invoiceXml);
  } catch (e) {
    return {
      buffer: rawPdf,
      warning: `PDF/A-3 post-processing failed (${(e as Error).message}). Returning the standard PDF instead.`,
    };
  }

  return {
    buffer,
    warning:
      "Best-effort PDF/A-3: the file is declared as PDF/A-3 with an embedded sRGB OutputIntent, XMP metadata, and any Factur-X attachment. For ISO 19005-3 certified conformance, route this through a dedicated converter (Adobe PDF Services / Ghostscript / mustangproject).",
  };
}

async function postProcessForPdfA3(pdfBuffer: Buffer, invoiceXml?: string): Promise<Buffer> {
  const pdf = await PDFDocument.load(new Uint8Array(pdfBuffer), { updateMetadata: false });

  pdf.setProducer("invoice-generator (PDF/A-3 post-processor)");
  pdf.setCreator("invoice-generator");
  if (!pdf.getCreationDate()) pdf.setCreationDate(new Date());
  pdf.setModificationDate(new Date());

  const created = (pdf.getCreationDate() ?? new Date()).toISOString();
  const modified = new Date().toISOString();
  const xmp = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
        xmlns:xmp="http://ns.adobe.com/xap/1.0/"
        xmlns:dc="http://purl.org/dc/elements/1.1/"
        xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
      <xmp:CreateDate>${created}</xmp:CreateDate>
      <xmp:ModifyDate>${modified}</xmp:ModifyDate>
      <xmp:CreatorTool>invoice-generator</xmp:CreatorTool>
      <pdf:Producer>invoice-generator (PDF/A-3 post-processor)</pdf:Producer>
      <dc:format>application/pdf</dc:format>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
  const metadataStream = pdf.context.stream(xmp, {
    Type: PDFName.of("Metadata"),
    Subtype: PDFName.of("XML"),
  });
  const metadataRef = pdf.context.register(metadataStream);
  pdf.catalog.set(PDFName.of("Metadata"), metadataRef);

  const iccBytes = Buffer.from(SRGB_ICC_BASE64, "base64");
  const iccStream = pdf.context.stream(iccBytes, { N: 3 });
  const iccRef = pdf.context.register(iccStream);

  const outputIntent = pdf.context.obj({
    Type: PDFName.of("OutputIntent"),
    S: PDFName.of("GTS_PDFA1"),
    OutputConditionIdentifier: PDFString.of("sRGB IEC61966-2.1"),
    Info: PDFString.of("sRGB IEC61966-2.1"),
    DestOutputProfile: iccRef,
  });
  const outputIntentRef = pdf.context.register(outputIntent);
  pdf.catalog.set(PDFName.of("OutputIntents"), pdf.context.obj([outputIntentRef]));

  if (invoiceXml && invoiceXml.trim().length > 0) {
    await pdf.attach(Buffer.from(invoiceXml, "utf-8"), "factur-x.xml", {
      mimeType: "application/xml",
      description: "Factur-X invoice data",
      creationDate: new Date(),
      modificationDate: new Date(),
      afRelationship: AFRelationship.Alternative,
    });
    const af = pdf.catalog.lookup(PDFName.of("AF")) as PDFArray | undefined;
    if (af) {
      af.asArray().forEach((entryRef) => {
        const dict = pdf.context.lookup(entryRef) as PDFDict | undefined;
        if (dict) dict.set(PDFName.of("AFRelationship"), PDFName.of("Alternative"));
      });
    }
  }

  // PDF/A requires a permanent Document ID.
  const id = PDFHexString.of(randomBytes(16).toString("hex"));
  pdf.context.trailerInfo.ID = pdf.context.obj([id, id]);

  const out = await pdf.save({ useObjectStreams: false });
  return Buffer.from(out);
}
