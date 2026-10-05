package io.github.srajpal.hyperspace3d

/**
 * The tabs in order, the one in front, and the addresses of closed tabs
 * to reopen (milestone 24), as the desktop's shell keeps them
 * (renderer/state/tabs.ts and closed-tabs.ts there). Plain data: the
 * pages themselves are kept by the activity.
 */
class TabList {
    private val order = mutableListOf<Int>()
    private val closed = ArrayDeque<String>()
    private var nextId = 1

    /** The tab in front, or null when there is none. */
    var focused: Int? = null
        private set

    val ids: List<Int> get() = order.toList()
    val canReopen: Boolean get() = closed.isNotEmpty()

    /** Adds a tab after the one in front (or at the end), puts it in front, and returns its id. */
    fun open(): Int {
        val id = nextId++
        val at = focused?.let { order.indexOf(it) + 1 } ?: order.size
        order.add(at, id)
        focused = id
        return id
    }

    fun focus(id: Int): Boolean {
        if (id !in order) return false
        focused = id
        return true
    }

    /**
     * Closes a tab; `address` is where it was, kept to reopen (a start
     * tab has none). The tab after it comes to the front, or the one
     * before when it was the last.
     */
    fun close(id: Int, address: String?) {
        val at = order.indexOf(id)
        if (at < 0) return
        order.removeAt(at)
        if (!address.isNullOrEmpty()) {
            closed.addLast(address)
            while (closed.size > MAX_CLOSED) closed.removeFirst()
        }
        if (focused == id) focused = order.getOrNull(at) ?: order.lastOrNull()
    }

    /** The address of the tab closed last, taken off the list. */
    fun takeClosed(): String? = closed.removeLastOrNull()

    companion object {
        /** As many closed tabs as the desktop remembers. */
        const val MAX_CLOSED = 25
    }
}
