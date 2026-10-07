package io.github.srajpal.hyperspace3d

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Matrix
import android.view.MotionEvent
import android.view.View
import android.widget.FrameLayout

/**
 * The layer over the room that holds the tabs' pages (milestone 24). The
 * page in front is laid out at its panel's size and drawn through the
 * map from its rectangle to the outline the room gives (Homography.kt),
 * as CSS 3D places it on the desktop. A view's animation matrix changes
 * only how it is drawn, so touches are brought back through the inverse
 * map here and handed to the page at the place on the page they point
 * at. A touch outside the page is not this layer's: it goes on to the
 * room's view underneath.
 */
class PageLayer(context: Context) : FrameLayout(context) {
    private var front: View? = null
    private var toScreen: Homography? = null
    private var toPage: Homography? = null
    private var pageWidth = 0
    private var pageHeight = 0
    /** The page took the touch that is going on, so the rest of it is the page's. */
    private var touching = false
    /** The room has a menu or a dialog open over the page: the page is hidden, and touches are the room's. */
    var covered = false
        set(value) {
            field = value
            front?.visibility = if (value || toScreen == null) View.INVISIBLE else View.VISIBLE
        }

    init {
        clipChildren = true
    }

    /**
     * Shows `view` (a tab's page) at `width` by `height` pixels, drawn
     * onto `corners` (top-left, top-right, bottom-right, bottom-left, in
     * this layer's pixels); every other page is hidden. Null corners hide
     * it too (the room shows a start tab, or nothing).
     */
    fun show(view: View?, width: Int, height: Int, corners: List<Homography.Point>?) {
        for (i in 0 until childCount) {
            val child = getChildAt(i)
            if (child !== view) child.visibility = View.INVISIBLE
        }
        front = view
        if (view == null || corners == null || width <= 0 || height <= 0) {
            toScreen = null
            toPage = null
            view?.visibility = View.INVISIBLE
            return
        }
        val map = Homography.fromRectangle(width.toDouble(), height.toDouble(), corners)
        toScreen = map
        toPage = map?.inverse()
        pageWidth = width
        pageHeight = height
        val params = view.layoutParams
        if (params == null || params.width != width || params.height != height) {
            view.layoutParams = LayoutParams(width, height)
        }
        view.animationMatrix = map?.let { Matrix().apply { setValues(it.floats()) } }
        view.visibility = if (map == null || covered) View.INVISIBLE else View.VISIBLE
    }

    fun add(view: View) {
        view.visibility = View.INVISIBLE
        addView(view, LayoutParams(1, 1))
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        val view = front
        val back = toPage
        if (ev.actionMasked == MotionEvent.ACTION_DOWN) {
            touching = false
            if (view == null || back == null || covered || view.visibility != View.VISIBLE) return false
            val p = back.map(ev.x.toDouble(), ev.y.toDouble())
            if (p.x < 0 || p.y < 0 || p.x > pageWidth || p.y > pageHeight) return false
            touching = true
        }
        if (!touching || view == null || back == null) return false
        val event = onPage(ev, back)
        view.dispatchTouchEvent(event)
        event.recycle()
        if (ev.actionMasked == MotionEvent.ACTION_UP || ev.actionMasked == MotionEvent.ACTION_CANCEL) touching = false
        return true
    }

    /** The same touch, every finger moved to where it points on the page. */
    private fun onPage(ev: MotionEvent, back: Homography): MotionEvent {
        val count = ev.pointerCount
        val properties = Array(count) { MotionEvent.PointerProperties().also { p -> ev.getPointerProperties(it, p) } }
        val coords = Array(count) { i ->
            MotionEvent.PointerCoords().also { c ->
                ev.getPointerCoords(i, c)
                val p = back.map(c.x.toDouble(), c.y.toDouble())
                c.x = p.x.toFloat()
                c.y = p.y.toFloat()
            }
        }
        return MotionEvent.obtain(
            ev.downTime, ev.eventTime, ev.action, count, properties, coords,
            ev.metaState, ev.buttonState, ev.xPrecision, ev.yPrecision, ev.deviceId, ev.edgeFlags, ev.source, ev.flags,
        )
    }
}
