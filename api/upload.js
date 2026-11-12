import { put } from "@vercel/blob";
import { send, fail } from "./_lib.js";

// POST /api/upload?name=file.pdf  (raw file bytes as the body)
// Stores SOP PDFs and client logos in Vercel Blob. Vercel caps request bodies at ~4.5 MB.
const ALLOWED = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return send(res, 503, { error: "File storage not connected. Add a Blob store in Vercel → Storage, then redeploy." });
    }
    const type = String(req.headers["content-type"] || "").split(";")[0].trim();
    if (!ALLOWED[type]) return send(res, 415, { error: "Upload a PDF, PNG, JPG or WebP file." });

    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 4.4 * 1024 * 1024) return send(res, 413, { error: "File is over 4.4 MB." });
      chunks.push(chunk);
    }
    if (!size) return send(res, 400, { error: "The file is empty." });

    const raw = String(req.query.name || "file").replace(/[^\w.\- ]+/g, "").slice(0, 80) || "file";
    const folder = type === "application/pdf" ? "sops" : "logos";
    const blob = await put(`${folder}/${raw}`, Buffer.concat(chunks), {
      access: "public",
      contentType: type,
      addRandomSuffix: true,
    });
    send(res, 200, { url: blob.url });
  } catch (e) {
    fail(res, e);
  }
}
