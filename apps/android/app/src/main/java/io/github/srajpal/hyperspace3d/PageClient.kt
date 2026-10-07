package io.github.srajpal.hyperspace3d

import android.content.res.AssetManager
import android.graphics.Bitmap
import android.webkit.CookieManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * What happens in a tab's page (milestone 24): where it may go, its
 * HoloML pages (HolomlPage.kt), and its state, told to the activity.
 */
class PageClient(
    private val tab: Tab,
    private val assets: AssetManager,
    private val userAgent: String,
    private val lighter: () -> Boolean,
    private val changed: (Tab) -> Unit,
    private val loaded: (Tab) -> Unit,
    private val crashed: (Tab) -> Unit,
) : WebViewClient() {

    /** Only web pages load in a tab; other kinds of address (intent:, mailto:, file:) are left alone. */
    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        val scheme = request.url.scheme?.lowercase() ?: return true
        return scheme != "http" && scheme != "https" && scheme != "about"
    }

    override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
        tab.url = url
        tab.loading = true
        tab.holoml = HolomlPage.isHolomlUrl(url)
        changed(tab)
    }

    override fun onPageFinished(view: WebView, url: String) {
        tab.url = url
        tab.loading = false
        changed(tab)
        loaded(tab)
    }

    override fun doUpdateVisitedHistory(view: WebView, url: String, isReload: Boolean) {
        tab.url = url
        changed(tab)
    }

    override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
        crashed(tab)
        return true
    }

    override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
        val path = request.url.path ?: return null
        HolomlPage.viewerAsset(path)?.let { return viewerFile(it) }
        if (request.isForMainFrame && request.method == "GET" && HolomlPage.isHolomlUrl(request.url.toString())) {
            return holomlPage(request)
        }
        return null
    }

    /** One of the viewer's files, from the app's assets. */
    private fun viewerFile(asset: String): WebResourceResponse {
        return try {
            val stream = assets.open(asset)
            WebResourceResponse(HolomlPage.mimeType(asset), "utf-8", 200, "OK", mapOf("Cache-Control" to "no-store"), stream)
        } catch (_: IOException) {
            WebResourceResponse("text/plain", "utf-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(ByteArray(0)))
        }
    }

    /**
     * A HoloML page: fetched as the page would be (with its cookies), and
     * answered as the document that shows it. A page that does not answer
     * with 200 is left to load as it would, so the page shows its error.
     */
    private fun holomlPage(request: WebResourceRequest): WebResourceResponse? {
        val url = request.url.toString()
        return try {
            val connection = URL(url).openConnection() as HttpURLConnection
            connection.instanceFollowRedirects = true
            connection.connectTimeout = 15_000
            connection.readTimeout = 30_000
            connection.setRequestProperty("User-Agent", userAgent)
            // The page's own headers, but not its encodings: the connection unpacks what it asks for itself.
            for ((name, value) in request.requestHeaders) {
                if (!name.equals("Accept-Encoding", ignoreCase = true)) connection.setRequestProperty(name, value)
            }
            CookieManager.getInstance().getCookie(url)?.let { connection.setRequestProperty("Cookie", it) }
            if (connection.responseCode != 200) {
                connection.disconnect()
                return null
            }
            val bytes = connection.inputStream.use { input ->
                val out = ByteArrayOutputStream()
                val buffer = ByteArray(16 * 1024)
                while (out.size() < HolomlPage.MAX_READ_BYTES) {
                    val n = input.read(buffer, 0, minOf(buffer.size, HolomlPage.MAX_READ_BYTES - out.size()))
                    if (n < 0) break
                    out.write(buffer, 0, n)
                }
                out.toByteArray()
            }
            connection.disconnect()
            val html = HolomlPage.wrapper(String(bytes, Charsets.UTF_8), lighter())
            WebResourceResponse(
                "text/html", "utf-8", 200, "OK",
                mapOf("Cache-Control" to "no-store"),
                ByteArrayInputStream(html.toByteArray(Charsets.UTF_8)),
            )
        } catch (_: IOException) {
            null
        }
    }
}

/** One tab: its page, once it has one (a start tab has none), and what the room shows of it. */
class Tab(val id: Int) {
    var webView: WebView? = null
    var url = ""
    var title = ""
    var loading = false
    var progress = 0
    var holoml = false
    /** Its page's process ended; the next load makes a new page. */
    var crashed = false
}
