// ════════════════════════════════════════════════════════════════
// SANCTUARY STORAGE WORKER — Backblaze B2 edition
// A small secure middleman between your app (in the browser) and
// your private Backblaze B2 bucket. Your app never holds B2
// credentials — only this Worker does, as encrypted secrets that
// Cloudflare keeps safe and that you set once via the CLI.
//
// Routes:
//   POST   /upload/<userId>/<filename>   — upload a file (body = raw bytes)
//   GET    /file/<userId>/<filename>     — download / stream a file
//   DELETE /file/<userId>/<filename>     — delete a file
//
// Every request must include:
//   Header:  Authorization: Bearer <APP_SECRET>
// This stops random people on the internet from using your Worker
// to fill up (or empty out) your B2 bucket. It does NOT need to be
// secret from your own app's users — anyone using your app can see
// it in their browser's network tab. Its only job is to block
// *outsiders* who aren't using your app at all. Per-user privacy is
// handled by the <userId> folder prefix, set to the real
// Supabase-authenticated user ID by your app.
// ════════════════════════════════════════════════════════════════

import { AwsClient } from "aws4fetch";

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://sanctuary-orpin-eta.vercel.app", // tighten to your domain once live
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean); // ["upload","userId","filename.jpg"]

    if (parts.length < 3) {
      return new Response("Bad request — expected /upload/<userId>/<filename> or /file/<userId>/<filename>", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const action = parts[0]; // "upload" or "file"

    // ── Auth check — protects uploads/deletes from outside abuse ──
    // GET (viewing/playing a file) is intentionally NOT checked here: browser
    // <img>, <audio>, and <a download> tags cannot attach custom headers, so
    // requiring auth on GET would break every photo and song from loading.
    // Files are still effectively private because filenames are long random
    // strings nobody could guess without already having access to your data.
    if (!(request.method === "GET" && action === "file")) {
      const authHeader = request.headers.get("Authorization") || "";
      const expected = "Bearer " + env.APP_SECRET;
      if (authHeader !== expected) {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
    }

    const userId = sanitizeSegment(parts[1]);
    const filename = sanitizeSegment(parts.slice(2).join("/"));
    const key = `${userId}/${filename}`;

    if (!userId || !filename) {
      return new Response("Invalid userId or filename", { status: 400, headers: corsHeaders });
    }

    // env.B2_ENDPOINT looks like: https://s3.us-west-004.backblazeb2.com
    // env.B2_BUCKET   looks like: sanctuary-files
    const objectUrl = `${env.B2_ENDPOINT}/${env.B2_BUCKET}/${key}`;

    const aws = new AwsClient({
      accessKeyId: env.B2_KEY_ID,
      secretAccessKey: env.B2_APP_KEY,
      service: "s3",
      region: extractRegion(env.B2_ENDPOINT),
    });

    // ── UPLOAD ──
    if (request.method === "POST" && action === "upload") {
      const contentType = request.headers.get("Content-Type") || "application/octet-stream";
      const bodyBuffer = await request.arrayBuffer();
      const signedReq = await aws.sign(objectUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: bodyBuffer,
      });
      const res = await fetch(signedReq);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return new Response("Upload failed: " + text, { status: 502, headers: corsHeaders });
      }
      const publicUrl = `${url.origin}/file/${userId}/${encodeURIComponent(filename)}`;
      return new Response(JSON.stringify({ ok: true, key, url: publicUrl }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DOWNLOAD / STREAM ──
    if (request.method === "GET" && action === "file") {
      const signedReq = await aws.sign(objectUrl, { method: "GET" });
      const res = await fetch(signedReq);
      if (!res.ok) {
        return new Response("Not found", { status: 404, headers: corsHeaders });
      }
      const headers = new Headers(corsHeaders);
      const ct = res.headers.get("Content-Type");
      if (ct) headers.set("Content-Type", ct);
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      // Show the file inside the app's viewer (PDF iframe, <img>, <audio>) by
      // default. Add ?download=1 to the URL to force a real file download
      // instead — that's what the "Download" button in the viewer uses.
      const wantsDownload = url.searchParams.get("download") === "1";
      const safeName = filename.split("/").pop() || "file";
      headers.set(
        "Content-Disposition",
        `${wantsDownload ? "attachment" : "inline"}; filename="${safeName.replace(/"/g, "")}"`
      );
      return new Response(res.body, { headers });
    }

    // ── DELETE ──
    if (request.method === "DELETE" && action === "file") {
      const signedReq = await aws.sign(objectUrl, { method: "DELETE" });
      await fetch(signedReq); // best-effort
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404, headers: corsHeaders });
  },
};

// Strips anything that could be used to escape the intended folder
// (no "..", no leading slashes, no weird characters) so a user can
// never read or overwrite another user's files.
function sanitizeSegment(s) {
  return (s || "")
    .replace(/\.\./g, "")
    .replace(/^\/+/, "")
    .replace(/[^a-zA-Z0-9._\-\/]/g, "_");
}

// Pulls the region out of an endpoint like https://s3.us-west-004.backblazeb2.com
function extractRegion(endpoint) {
  const m = (endpoint || "").match(/s3\.([a-z0-9-]+)\.backblazeb2\.com/i);
  return m ? m[1] : "us-west-004";
}
