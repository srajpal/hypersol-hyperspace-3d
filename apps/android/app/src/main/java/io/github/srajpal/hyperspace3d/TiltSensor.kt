package io.github.srajpal.hyperspace3d

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.SystemClock
import android.view.Surface

/**
 * The tablet's tilt as the room's parallax (milestone 24), in place of
 * the desktop's pointer: tilting the tablet moves the room's camera a
 * little, as moving the mouse does there. The tilt is measured from
 * where the tablet is held, which the sensor follows slowly, so the room
 * settles back as the hand rests. Sent at most 30 times a second, and
 * only when it changes.
 */
class TiltSensor(context: Context, private val rotation: () -> Int, private val send: (x: Double, y: Double) -> Unit) :
    SensorEventListener {
    private val manager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val sensor: Sensor? = manager.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR)
    private val matrix = FloatArray(9)
    private val angles = FloatArray(3)
    private var rest: Pair<Double, Double>? = null
    private var sent = Pair(0.0, 0.0)
    private var sentAt = 0L

    fun start() {
        rest = null
        sensor?.let { manager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
    }

    fun stop() {
        manager.unregisterListener(this)
        send(0.0, 0.0)
    }

    override fun onSensorChanged(event: SensorEvent) {
        SensorManager.getRotationMatrixFromVector(matrix, event.values)
        SensorManager.getOrientation(matrix, angles)
        // Pitch is the tilt toward and away from the eyes, roll from side to side, as the tablet is held upright.
        val (side, toward) = screenAxes(angles[2].toDouble(), angles[1].toDouble(), rotation())
        val held = rest ?: Pair(side, toward)
        // Where the tablet is held follows the tablet slowly: about two seconds to settle.
        val next = Pair(held.first + (side - held.first) * FOLLOW, held.second + (toward - held.second) * FOLLOW)
        rest = next
        val x = parallax(side - next.first)
        val y = parallax(toward - next.second)
        val now = SystemClock.uptimeMillis()
        if (now - sentAt < 33) return
        if (Math.abs(x - sent.first) < 0.02 && Math.abs(y - sent.second) < 0.02) return
        sent = Pair(x, y)
        sentAt = now
        send(x, y)
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    companion object {
        /** Tilt for the full parallax: about 12 degrees. */
        private const val RANGE = 0.21
        private const val FOLLOW = 0.008

        /** A tilt, in radians from where the tablet rests, as the room's -1 to 1. */
        fun parallax(radians: Double): Double = (radians / RANGE).coerceIn(-1.0, 1.0)

        /**
         * The tilt across the screen and up it, as the screen is turned:
         * the sensor's roll and pitch belong to the tablet held upright,
         * and a turned screen swaps them.
         */
        fun screenAxes(roll: Double, pitch: Double, rotation: Int): Pair<Double, Double> = when (rotation) {
            Surface.ROTATION_90 -> Pair(-pitch, roll)
            Surface.ROTATION_180 -> Pair(-roll, -pitch)
            Surface.ROTATION_270 -> Pair(pitch, -roll)
            else -> Pair(roll, pitch)
        }
    }
}
