package io.github.srajpal.hyperspace3d

import java.util.Locale

/**
 * Writes the messages the app sends to the room's page as JSON
 * (milestone 24). Small on purpose: the values are strings, numbers,
 * booleans, null, lists, and maps of those.
 */
object Json {
    private const val LINE_SEPARATOR = '\u2028'
    private const val PARAGRAPH_SEPARATOR = '\u2029'

    fun write(value: Any?): String = StringBuilder().also { append(it, value) }.toString()

    private fun append(out: StringBuilder, value: Any?) {
        when (value) {
            null -> out.append("null")
            is String -> string(out, value)
            is Boolean -> out.append(value)
            is Int, is Long -> out.append(value)
            is Number -> {
                val d = value.toDouble()
                out.append(if (d.isFinite()) d.toString() else "null")
            }
            is Map<*, *> -> {
                out.append('{')
                var first = true
                for ((k, v) in value) {
                    if (!first) out.append(',')
                    first = false
                    string(out, k.toString())
                    out.append(':')
                    append(out, v)
                }
                out.append('}')
            }
            is Iterable<*> -> {
                out.append('[')
                var first = true
                for (v in value) {
                    if (!first) out.append(',')
                    first = false
                    append(out, v)
                }
                out.append(']')
            }
            else -> string(out, value.toString())
        }
    }

    private fun string(out: StringBuilder, s: String) {
        out.append('"')
        for (c in s) {
            when {
                c == '"' -> out.append("\\\"")
                c == '\\' -> out.append("\\\\")
                c == '\n' -> out.append("\\n")
                c == '\r' -> out.append("\\r")
                c == '\t' -> out.append("\\t")
                // Line and paragraph separators end a line of JavaScript, though not of JSON: written as escapes.
                c.code < 0x20 || c == LINE_SEPARATOR || c == PARAGRAPH_SEPARATOR -> out.append(String.format(Locale.ROOT, "\\u%04x", c.code))
                else -> out.append(c)
            }
        }
        out.append('"')
    }
}
