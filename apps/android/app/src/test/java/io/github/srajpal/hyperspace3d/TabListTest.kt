package io.github.srajpal.hyperspace3d

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The tabs in order, the one in front, and the closed ones to reopen (milestone 24). */
class TabListTest {
    @Test
    fun `a new tab opens after the one in front, and comes to the front`() {
        val tabs = TabList()
        val a = tabs.open()
        val b = tabs.open()
        tabs.focus(a)
        val c = tabs.open()
        assertEquals(listOf(a, c, b), tabs.ids)
        assertEquals(c, tabs.focused)
        assertFalse(tabs.focus(99))
        assertEquals(c, tabs.focused)
    }

    @Test
    fun `closing the tab in front brings the next one, or the one before the last`() {
        val tabs = TabList()
        val a = tabs.open()
        val b = tabs.open()
        val c = tabs.open()
        tabs.focus(b)
        tabs.close(b, "https://b.example/")
        assertEquals(c, tabs.focused)
        tabs.close(c, "https://c.example/")
        assertEquals(a, tabs.focused)
        tabs.close(a, null)
        assertNull(tabs.focused)
        assertTrue(tabs.ids.isEmpty())
    }

    @Test
    fun `closed tabs reopen last first, a start tab is not kept, and only so many are kept`() {
        val tabs = TabList()
        val ids = (1..30).map { tabs.open() }
        tabs.close(ids[0], "")
        assertFalse(tabs.canReopen)
        for ((i, id) in ids.drop(1).withIndex()) tabs.close(id, "https://$i.example/")
        assertTrue(tabs.canReopen)
        assertEquals("https://28.example/", tabs.takeClosed())
        var left = 1
        while (tabs.takeClosed() != null) left++
        assertEquals(TabList.MAX_CLOSED, left)
    }
}
