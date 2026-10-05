package io.github.srajpal.hyperspace3d

import android.view.Surface
import org.junit.Assert.assertEquals
import org.junit.Test

/** The messages to the room's page, and the tilt as parallax (milestone 24). */
class JsonAndTiltTest {
    @Test
    fun `messages are JSON that is also safe JavaScript`() {
        val text = Json.write(
            mapOf(
                "type" to "tabs",
                "tabs" to listOf(mapOf("id" to 1, "title" to "A \"quote\", a \\ and\na line\u2028end", "loading" to true, "url" to null)),
                "focused" to 1,
                "x" to 0.5,
                "bad" to Double.NaN,
            ),
        )
        assertEquals(
            "{\"type\":\"tabs\",\"tabs\":[{\"id\":1,\"title\":\"A \\\"quote\\\", a \\\\ and\\na line\\u2028end\",\"loading\":true,\"url\":null}],\"focused\":1,\"x\":0.5,\"bad\":null}",
            text,
        )
        assertEquals("\"\\u0001\"", Json.write("\u0001"))
    }

    @Test
    fun `a tilt of about twelve degrees moves the room all the way, and no further`() {
        assertEquals(0.0, TiltSensor.parallax(0.0), 1e-9)
        assertEquals(1.0, TiltSensor.parallax(0.21), 1e-9)
        assertEquals(-1.0, TiltSensor.parallax(-1.0), 1e-9)
        assertEquals(0.5, TiltSensor.parallax(0.105), 1e-9)
    }

    @Test
    fun `a turned screen swaps the tilt's axes`() {
        assertEquals(Pair(0.1, 0.2), TiltSensor.screenAxes(0.1, 0.2, Surface.ROTATION_0))
        assertEquals(Pair(-0.2, 0.1), TiltSensor.screenAxes(0.1, 0.2, Surface.ROTATION_90))
        assertEquals(Pair(-0.1, -0.2), TiltSensor.screenAxes(0.1, 0.2, Surface.ROTATION_180))
        assertEquals(Pair(0.2, -0.1), TiltSensor.screenAxes(0.1, 0.2, Surface.ROTATION_270))
    }
}
