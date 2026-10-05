package io.github.srajpal.hyperspace3d

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/** The page's rectangle onto the outline the room gives (milestone 24), and back, for touches. */
class HomographyTest {
    private fun p(x: Double, y: Double) = Homography.Point(x, y)

    private fun assertNear(expected: Homography.Point, actual: Homography.Point) {
        assertEquals(expected.x, actual.x, 1e-6)
        assertEquals(expected.y, actual.y, 1e-6)
    }

    @Test
    fun `the page's corners land on the outline's corners`() {
        // A panel leaning back, as the room shows it: narrower at the top.
        val corners = listOf(p(140.0, 90.0), p(660.0, 90.0), p(760.0, 1100.0), p(40.0, 1100.0))
        val map = Homography.fromRectangle(1200.0, 1600.0, corners)!!
        assertNear(corners[0], map.map(0.0, 0.0))
        assertNear(corners[1], map.map(1200.0, 0.0))
        assertNear(corners[2], map.map(1200.0, 1600.0))
        assertNear(corners[3], map.map(0.0, 1600.0))
    }

    @Test
    fun `a touch on screen comes back to the place on the page it points at`() {
        val corners = listOf(p(140.0, 90.0), p(660.0, 120.0), p(760.0, 1100.0), p(40.0, 1150.0))
        val map = Homography.fromRectangle(1200.0, 1600.0, corners)!!
        val back = map.inverse()!!
        for ((u, v) in listOf(0.0 to 0.0, 600.0 to 800.0, 1199.0 to 3.0, 37.0 to 1555.0)) {
            val onScreen = map.map(u, v)
            assertNear(p(u, v), back.map(onScreen.x, onScreen.y))
        }
    }

    @Test
    fun `a flat outline is only a scale and a move`() {
        val map = Homography.fromRectangle(100.0, 50.0, listOf(p(10.0, 20.0), p(210.0, 20.0), p(210.0, 120.0), p(10.0, 120.0)))!!
        assertNear(p(110.0, 70.0), map.map(50.0, 25.0))
        val v = map.values
        assertEquals(0.0, v[6], 1e-12)
        assertEquals(0.0, v[7], 1e-12)
    }

    @Test
    fun `an outline that cannot be drawn gives no map`() {
        // Three corners in a line.
        assertNull(Homography.fromRectangle(100.0, 100.0, listOf(p(0.0, 0.0), p(50.0, 0.0), p(100.0, 0.0), p(0.0, 100.0))))
        // Crossing corners: a bow tie.
        assertNull(Homography.fromRectangle(100.0, 100.0, listOf(p(0.0, 0.0), p(100.0, 100.0), p(100.0, 0.0), p(0.0, 100.0))))
        // Not a number, a page with no size, and too few corners.
        assertNull(Homography.fromRectangle(100.0, 100.0, listOf(p(Double.NaN, 0.0), p(1.0, 0.0), p(1.0, 1.0), p(0.0, 1.0))))
        assertNull(Homography.fromRectangle(0.0, 100.0, listOf(p(0.0, 0.0), p(1.0, 0.0), p(1.0, 1.0), p(0.0, 1.0))))
        assertNull(Homography.fromRectangle(100.0, 100.0, listOf(p(0.0, 0.0), p(1.0, 0.0), p(1.0, 1.0))))
    }

    @Test
    fun `its nine values are row by row, as Android's Matrix takes them`() {
        val map = Homography.fromRectangle(10.0, 10.0, listOf(p(5.0, 7.0), p(25.0, 7.0), p(25.0, 27.0), p(5.0, 27.0)))
        assertNotNull(map)
        val f = map!!.floats()
        assertEquals(9, f.size)
        // x' = 2x + 5 and y' = 2y + 7.
        assertEquals(2f, f[0], 1e-6f)
        assertEquals(5f, f[2], 1e-6f)
        assertEquals(2f, f[4], 1e-6f)
        assertEquals(7f, f[5], 1e-6f)
        assertEquals(1f, f[8], 1e-6f)
    }
}
