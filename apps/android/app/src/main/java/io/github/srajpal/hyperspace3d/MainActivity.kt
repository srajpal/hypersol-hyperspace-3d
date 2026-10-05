package io.github.srajpal.hyperspace3d

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.Message
import android.util.Base64
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.window.OnBackInvokedDispatcher
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream

/**
 * HyperSpace 3D for Android (milestone 24). The window holds two layers:
 * the room's page (the desktop's 3D room and top bar, built into the
 * app's assets) in a WebView that fills it, and over it the page layer
 * with each tab's page in a WebView of its own, drawn onto the panel the
 * room shows (PageLayer.kt). The room's page and the app talk in short
 * JSON messages: the room asks (open an address, go back, focus a tab,
 * here is where the page is), and the app tells it the tabs.
 */
class MainActivity : Activity() {
    private lateinit var room: WebView
    private lateinit var pages: PageLayer
    private lateinit var tilt: TiltSensor
    private val tabs = TabList()
    private val byId = mutableMapOf<Int, Tab>()
    private val main = Handler(Looper.getMainLooper())
    private var roomReady = false
    private val prefs by lazy { getSharedPreferences("settings", MODE_PRIVATE) }
    private val userAgent by lazy { WebSettings.getDefaultUserAgent(this) }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // A debug build's pages can be inspected from Chrome on the computer the tablet is plugged into (USB only).
        WebView.setWebContentsDebuggingEnabled((applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0)
        val stage = FrameLayout(this)
        stage.setBackgroundColor(Color.rgb(0x0b, 0x0f, 0x1e))
        room = WebView(this)
        pages = PageLayer(this)
        stage.addView(room, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        stage.addView(pages, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        setContentView(stage)
        // The window reaches the screen's edges (Android 15 and later): the bars and the keyboard keep their room.
        ViewCompat.setOnApplyWindowInsetsListener(stage) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }

        setUpRoom()
        tilt = TiltSensor(this, { display?.rotation ?: 0 }) { x, y -> tell(mapOf("type" to "tilt", "x" to x, "y" to y)) }
        if (Build.VERSION.SDK_INT >= 33) {
            onBackInvokedDispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT) { back() }
        }
        newTab(webAddress(intent))
    }

    /** One window: an address opened from another app comes to it in a new tab. */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        webAddress(intent)?.let { newTab(it) }
    }

    /** The web address an intent carries, if any. */
    private fun webAddress(intent: Intent?): String? {
        val address = intent?.data?.toString() ?: return null
        return address.takeIf { it.startsWith("https://") || it.startsWith("http://") }
    }

    @Deprecated("Android 12 and older; later, the callback registered in onCreate")
    override fun onBackPressed() {
        back()
    }

    private fun back() {
        val view = focusedTab()?.webView
        if (view != null && view.canGoBack()) view.goBack() else finish()
    }

    override fun onResume() {
        super.onResume()
        focusedTab()?.webView?.onResume()
        tilt.start()
    }

    override fun onPause() {
        tilt.stop()
        for (tab in byId.values) tab.webView?.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        for (tab in byId.values) tab.webView?.destroy()
        room.destroy()
        super.onDestroy()
    }

    // ---- The room ------------------------------------------------------------

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    private fun setUpRoom() {
        // The room's page is served from the app's assets at a secure address of Android's own, so its modules load.
        val loader = WebViewAssetLoader.Builder().addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this)).build()
        room.setBackgroundColor(Color.rgb(0x0b, 0x0f, 0x1e))
        room.settings.javaScriptEnabled = true
        room.settings.allowFileAccess = false
        room.settings.allowContentAccess = false
        room.webViewClient = object : WebViewClient() {
            // Only the app's own files: anything else the room's page asks for (the WebView's favicon) is answered here, empty, not sent out.
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                loader.shouldInterceptRequest(request.url)
                    ?: WebResourceResponse("text/plain", "utf-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(ByteArray(0)))

            // The room's page never goes anywhere: its links open in a tab.
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = true
        }
        room.addJavascriptInterface(RoomBridge(), "HyperSpaceAndroid")
        room.loadUrl("https://${WebViewAssetLoader.DEFAULT_DOMAIN}/assets/room/index.html")
    }

    /** What the room's page calls: one JSON message at a time, handled on the main thread. */
    inner class RoomBridge {
        @JavascriptInterface
        fun post(json: String) {
            main.post { handle(json) }
        }
    }

    private fun handle(json: String) {
        val m = try {
            JSONObject(json)
        } catch (_: Exception) {
            return
        }
        when (m.optString("type")) {
            "ready" -> {
                roomReady = true
                tell(mapOf("type" to "settings", "lighter" to lighter()))
                sendTabs()
                for (tab in byId.values) snapshot(tab)
            }
            "open" -> open(m.optString("url"), m.optBoolean("newTab"))
            "back" -> focusedTab()?.webView?.let { if (it.canGoBack()) it.goBack() }
            "forward" -> focusedTab()?.webView?.let { if (it.canGoForward()) it.goForward() }
            "reload" -> focusedTab()?.webView?.reload()
            "stop" -> focusedTab()?.webView?.stopLoading()
            "new-tab" -> newTab(null)
            "focus" -> focus(m.optInt("id"))
            "close" -> close(m.optInt("id"))
            "reopen" -> tabs.takeClosed()?.let { newTab(it) }
            "quad" -> place(m)
            "covered" -> cover(m.optBoolean("on"))
            "lighter" -> prefs.edit().putBoolean("lighter", m.optBoolean("on")).apply()
        }
    }

    private fun tell(message: Map<String, Any?>) {
        if (!roomReady) return
        room.evaluateJavascript("window.hyperspace&&window.hyperspace.receive(${Json.write(message)})", null)
    }

    private fun lighter() = prefs.getBoolean("lighter", true)

    /** Where the room shows the page in front: its panel's size and its outline on screen, in the room's CSS pixels. */
    private fun place(m: JSONObject) {
        val tab = byId[m.optInt("id")]
        val view = tab?.webView
        if (tab == null || tab.id != tabs.focused || view == null || !m.optBoolean("visible")) {
            pages.show(null, 0, 0, null)
            return
        }
        val dpr = m.optDouble("dpr", resources.displayMetrics.density.toDouble())
        val quad = m.optJSONArray("quad") ?: return
        if (quad.length() != 8) return
        val corners = (0 until 4).map { Homography.Point(quad.getDouble(it * 2) * dpr, quad.getDouble(it * 2 + 1) * dpr) }
        pages.show(view, Math.round(m.optDouble("width") * dpr).toInt(), Math.round(m.optDouble("height") * dpr).toInt(), corners)
    }

    /** A menu or dialog of the room's is open over the page: the page's picture is shown in its place, and the page hides. */
    private fun cover(on: Boolean) {
        if (on) focusedTab()?.let { snapshot(it) }
        pages.covered = on
    }

    // ---- Tabs ----------------------------------------------------------------

    private fun focusedTab(): Tab? = tabs.focused?.let { byId[it] }

    /** A new tab after the one in front: a start tab, or one that opens `url`. */
    private fun newTab(url: String?, page: WebView? = null): Tab {
        focusedTab()?.webView?.onPause()
        val tab = Tab(tabs.open())
        byId[tab.id] = tab
        if (page != null) tab.webView = page
        if (url != null) load(tab, url)
        sendTabs()
        return tab
    }

    private fun open(url: String, inNewTab: Boolean) {
        if (url.isEmpty()) return
        val tab = focusedTab()
        if (inNewTab || tab == null) newTab(url) else load(tab, url)
    }

    private fun load(tab: Tab, url: String) {
        val view = tab.webView?.takeIf { !tab.crashed } ?: makePage(tab)
        tab.url = url
        tab.holoml = HolomlPage.isHolomlUrl(url)
        view.loadUrl(url)
        sendTabs()
    }

    private fun focus(id: Int) {
        if (!tabs.focus(id)) return
        for (tab in byId.values) if (tab.id == id) tab.webView?.onResume() else tab.webView?.onPause()
        pages.show(null, 0, 0, null)
        sendTabs()
    }

    private fun close(id: Int) {
        val tab = byId.remove(id) ?: return
        tabs.close(id, tab.url.takeIf { it.isNotEmpty() })
        tab.webView?.let {
            pages.removeView(it)
            it.destroy()
        }
        if (tabs.ids.isEmpty()) newTab(null)
        focusedTab()?.webView?.onResume()
        sendTabs()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun makePage(tab: Tab): WebView {
        tab.webView?.let {
            pages.removeView(it)
            it.destroy()
        }
        tab.crashed = false
        val view = WebView(this)
        with(view.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            builtInZoomControls = true
            displayZoomControls = false
            loadWithOverviewMode = true
            useWideViewPort = true
            allowFileAccess = false
            allowContentAccess = false
            mediaPlaybackRequiresUserGesture = true
            setGeolocationEnabled(false)
            setSupportMultipleWindows(true)
        }
        view.setBackgroundColor(Color.WHITE)
        view.webViewClient = PageClient(tab, assets, userAgent, ::lighter, { sendTabs() }, { snapshotSoon(it) }, { crashed(it) })
        view.webChromeClient = object : WebChromeClient() {
            override fun onReceivedTitle(view: WebView, title: String?) {
                tab.title = title ?: ""
                sendTabs()
            }

            override fun onProgressChanged(view: WebView, newProgress: Int) {
                tab.progress = newProgress
            }

            // A link that opens a new window opens a new tab, when a tap or a click asked for it; pop-ups that nothing asked for are refused.
            override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message): Boolean {
                if (!isUserGesture) return false
                val tab = newTab(null)
                val page = makePage(tab)
                tab.webView = page
                (resultMsg.obj as WebView.WebViewTransport).webView = page
                resultMsg.sendToTarget()
                sendTabs()
                return true
            }

            // The camera, the microphone, and the rest: refused until site permissions come to Android (a later milestone).
            override fun onPermissionRequest(request: PermissionRequest) {
                request.deny()
            }
        }
        // Downloads come to Android in a later milestone; until then nothing is saved.
        view.setDownloadListener { _, _, _, _, _ -> }
        tab.webView = view
        pages.add(view)
        return view
    }

    private fun crashed(tab: Tab) {
        tab.crashed = true
        tab.loading = false
        tab.title = "This page stopped working"
        tab.webView?.let { pages.removeView(it) }
        tab.webView = null
        if (tab.id == tabs.focused) pages.show(null, 0, 0, null)
        sendTabs()
    }

    private fun sendTabs() {
        val list = tabs.ids.mapNotNull { byId[it] }.map { tab ->
            mapOf(
                "id" to tab.id,
                "url" to tab.url,
                "title" to tab.title,
                "loading" to tab.loading,
                "canGoBack" to (tab.webView?.canGoBack() ?: false),
                "canGoForward" to (tab.webView?.canGoForward() ?: false),
                "holoml" to tab.holoml,
                "crashed" to tab.crashed,
            )
        }
        tell(mapOf("type" to "tabs", "tabs" to list, "focused" to tabs.focused, "canReopen" to tabs.canReopen))
    }

    // ---- Pictures of pages, for the tab cards ---------------------------------

    private fun snapshotSoon(tab: Tab) {
        main.postDelayed({ snapshot(tab) }, 600)
    }

    private fun snapshot(tab: Tab) {
        val view = tab.webView ?: return
        if (view.width <= 1 || view.height <= 1) return
        val width = 320
        val height = (width * view.height / view.width).coerceAtLeast(1)
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.scale(width.toFloat() / view.width, height.toFloat() / view.height)
        view.draw(canvas)
        val out = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.JPEG, 75, out)
        bitmap.recycle()
        val data = "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        tell(mapOf("type" to "snapshot", "id" to tab.id, "dataUrl" to data))
    }
}
