package io.github.srajpal.hyperspace3d

import java.util.Locale

/**
 * HoloML pages on Android (milestone 24), as the desktop shows them
 * (main/holoml.ts and preload/holoml.ts there): the page's text is kept
 * in the document, hidden, and the browser's HoloML viewer script is
 * added; the viewer reads the text and draws the scene. The viewer is the
 * desktop's own build, packed into the app, and served to the page from a
 * path of the page's own site that the app answers (PageClient.kt), so
 * that it runs as the page's script and finds the page's files beside it.
 */
object HolomlPage {
    /** Where the viewer's files are answered on any page's site. */
    const val VIEWER_PATH = "/__hyperspace3d__/viewer/"

    /** The viewer's script, inside the app's assets (the desktop's out/renderer/assets/viewer.js). */
    const val VIEWER_ENTRY = "assets/viewer.js"

    /**
     * Read no more of a page than this: the viewer refuses a page of more
     * than 2 MB itself, with a card saying so (budget.ts, pageBytes), and
     * one byte more is enough for it to tell.
     */
    const val MAX_READ_BYTES = 2 * 1024 * 1024 + 1

    /** A web address whose path ends in .holoml (in any case), as the desktop decides by the file's extension. */
    fun isHolomlUrl(url: String): Boolean {
        val scheme = url.substringBefore(':', "").lowercase(Locale.ROOT)
        if (scheme != "http" && scheme != "https") return false
        val path = url.substringAfter("://").substringAfter('/', "").substringBefore('?').substringBefore('#')
        return path.lowercase(Locale.ROOT).endsWith(".holoml")
    }

    /**
     * The asset a request for the viewer's files names, or null for any
     * other path or for one that tries to leave the viewer's folder.
     */
    fun viewerAsset(path: String): String? {
        if (!path.startsWith(VIEWER_PATH)) return null
        val rest = path.removePrefix(VIEWER_PATH)
        if (rest.isEmpty() || rest.contains("..") || rest.startsWith("/")) return null
        if (!rest.all { it.isLetterOrDigit() || it in "._-/" }) return null
        return "viewer/$rest"
    }

    /** The type each of the viewer's files is answered with. */
    fun mimeType(asset: String): String = when (asset.substringAfterLast('.', "").lowercase(Locale.ROOT)) {
        "js", "mjs" -> "text/javascript"
        "css" -> "text/css"
        "json" -> "application/json"
        "jpg", "jpeg" -> "image/jpeg"
        "png" -> "image/png"
        "wasm" -> "application/wasm"
        else -> "application/octet-stream"
    }

    /**
     * The document the tab shows for a HoloML page: its text in a hidden
     * <pre>, the viewer's script, and the answer to the viewer's request
     * for its private line, which the desktop's page preload gives; with
     * `lighter`, the viewer's lighter drawing (half the sharpness, no
     * shadows or moving light on water), asked for on the root element
     * before any of the page's scripts can run.
     *
     * The line break after <pre> is the one the HTML parser drops there,
     * so a page whose text starts with a line break keeps it, and the
     * viewer's line numbers stay right.
     */
    fun wrapper(source: String, lighter: Boolean): String {
        val lighterAttribute = if (lighter) " data-hypersol-lighter" else ""
        return """<!doctype html>
<html$lighterAttribute><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>html, body { margin: 0; height: 100%; overflow: hidden; background: #0b0f1e; } body > pre { display: none; }</style>
<script>
addEventListener('message', function asked(e) {
  if (e.source !== window || !e.data || e.data.hypersolHolomlViewer !== true) return;
  removeEventListener('message', asked);
  var channel = new MessageChannel();
  postMessage({ hypersolHolomlLine: true }, '*', [channel.port2]);
  channel.port1.postMessage('in-front');
});
</script>
<script type="module" src="${VIEWER_PATH}$VIEWER_ENTRY"></script>
</head><body><pre>
${escape(source)}</pre></body></html>
"""
    }

    /** Text as it must be written inside an HTML element. */
    fun escape(text: String): String {
        val out = StringBuilder(text.length + 16)
        for (c in text) {
            when (c) {
                '&' -> out.append("&amp;")
                '<' -> out.append("&lt;")
                '>' -> out.append("&gt;")
                else -> out.append(c)
            }
        }
        return out.toString()
    }
}
