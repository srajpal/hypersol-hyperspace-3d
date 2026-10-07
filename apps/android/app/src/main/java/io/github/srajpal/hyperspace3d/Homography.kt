package io.github.srajpal.hyperspace3d

/**
 * The map from a page's own rectangle to the four corners the 3D room
 * puts it at on screen (milestone 24). On the desktop the page is placed
 * with CSS 3D; here the room computes the same outline (room.ts,
 * screenQuad) and the page's native view is drawn through this map, and
 * touches are brought back through its inverse, so that they land where
 * they appear.
 *
 * A projective map: x' = (a x + b y + c) / (g x + h y + 1), and the same
 * for y' with d, e, f. Stored row by row, as android.graphics.Matrix
 * reads its nine values.
 */
class Homography private constructor(val values: DoubleArray) {
    data class Point(val x: Double, val y: Double)

    fun map(x: Double, y: Double): Point {
        val v = values
        val w = v[6] * x + v[7] * y + v[8]
        return Point((v[0] * x + v[1] * y + v[2]) / w, (v[3] * x + v[4] * y + v[5]) / w)
    }

    /** The map back, from screen to page; null if the outline has no area. */
    fun inverse(): Homography? {
        val m = values
        val a = m[4] * m[8] - m[5] * m[7]
        val b = m[5] * m[6] - m[3] * m[8]
        val c = m[3] * m[7] - m[4] * m[6]
        val det = m[0] * a + m[1] * b + m[2] * c
        if (Math.abs(det) < 1e-12) return null
        val inv = doubleArrayOf(
            a, m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
            b, m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
            c, m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3],
        )
        return Homography(DoubleArray(9) { inv[it] / det })
    }

    /** The nine values as android.graphics.Matrix.setValues takes them. */
    fun floats(): FloatArray = FloatArray(9) { values[it].toFloat() }

    companion object {
        /**
         * The map from the rectangle (0, 0) to (width, height) onto four
         * corners: top-left, top-right, bottom-right, bottom-left. Null if
         * the corners do not make a quadrilateral that can be drawn (three
         * in a line, or crossing).
         */
        fun fromRectangle(width: Double, height: Double, corners: List<Point>): Homography? {
            if (corners.size != 4 || width <= 0 || height <= 0) return null
            if (corners.any { !it.x.isFinite() || !it.y.isFinite() }) return null
            val square = squareTo(corners) ?: return null
            // Scale the page down to the unit square first, then the square onto the corners.
            val s = square.values
            val values = doubleArrayOf(
                s[0] / width, s[1] / height, s[2],
                s[3] / width, s[4] / height, s[5],
                s[6] / width, s[7] / height, s[8],
            )
            return Homography(values)
        }

        /** The map from the unit square onto four corners (Heckbert's closed form). */
        private fun squareTo(q: List<Point>): Homography? {
            val (x0, y0) = q[0]
            val (x1, y1) = q[1]
            val (x2, y2) = q[2]
            val (x3, y3) = q[3]
            val sx = x0 - x1 + x2 - x3
            val sy = y0 - y1 + y2 - y3
            val g: Double
            val h: Double
            if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
                g = 0.0
                h = 0.0
            } else {
                val dx1 = x1 - x2
                val dx2 = x3 - x2
                val dy1 = y1 - y2
                val dy2 = y3 - y2
                val det = dx1 * dy2 - dx2 * dy1
                if (Math.abs(det) < 1e-12) return null
                g = (sx * dy2 - dx2 * sy) / det
                h = (dx1 * sy - sx * dy1) / det
            }
            val values = doubleArrayOf(
                x1 - x0 + g * x1, x3 - x0 + h * x3, x0,
                y1 - y0 + g * y1, y3 - y0 + h * y3, y0,
                g, h, 1.0,
            )
            val result = Homography(values)
            // Corners that cross, or that put a point behind the eye, give a denominator that changes sign inside the square.
            for (u in listOf(0.0, 1.0)) for (v in listOf(0.0, 1.0)) {
                if (g * u + h * v + 1.0 <= 1e-9) return null
            }
            return result
        }
    }
}
