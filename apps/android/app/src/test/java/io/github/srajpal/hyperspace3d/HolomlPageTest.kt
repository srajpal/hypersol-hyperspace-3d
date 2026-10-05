package io.github.srajpal.hyperspace3d

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** HoloML pages in a tab (milestone 24): which they are, the viewer's files, and the document that shows them. */
class HolomlPageTest {
    @Test
    fun `a web address ending in holoml is a HoloML page, in any case, with a query or a place`() {
        assertTrue(HolomlPage.isHolomlUrl("https://srajpal.github.io/holoml/aquarium/index.holoml"))
        assertTrue(HolomlPage.isHolomlUrl("http://localhost:8000/A.HOLOML?v=2#door"))
        assertFalse(HolomlPage.isHolomlUrl("https://example.com/index.html"))
        assertFalse(HolomlPage.isHolomlUrl("https://example.com/?page=a.holoml"))
        assertFalse(HolomlPage.isHolomlUrl("https://example.com/holoml"))
        assertFalse(HolomlPage.isHolomlUrl("file:///sdcard/a.holoml"))
        assertFalse(HolomlPage.isHolomlUrl("javascript:a.holoml"))
    }

    @Test
    fun `the viewer's files are answered only from its folder`() {
        assertEquals("viewer/assets/viewer.js", HolomlPage.viewerAsset("/__hyperspace3d__/viewer/assets/viewer.js"))
        assertEquals("viewer/assets/three.module-CuGTKAlq.js", HolomlPage.viewerAsset("/__hyperspace3d__/viewer/assets/three.module-CuGTKAlq.js"))
        assertNull(HolomlPage.viewerAsset("/__hyperspace3d__/viewer/../room/index.html"))
        assertNull(HolomlPage.viewerAsset("/__hyperspace3d__/viewer//etc/passwd"))
        assertNull(HolomlPage.viewerAsset("/__hyperspace3d__/viewer/"))
        assertNull(HolomlPage.viewerAsset("/__hyperspace3d__/viewer/a%2e%2e/b"))
        assertNull(HolomlPage.viewerAsset("/models/car.glb"))
        assertEquals("text/javascript", HolomlPage.mimeType("viewer/assets/viewer.js"))
    }

    @Test
    fun `the document holds the page's text, hidden, and the viewer's script`() {
        val html = HolomlPage.wrapper("<holoml version=\"0.2\"><scene><label>Fish &amp; chips</label></scene></holoml>", lighter = false)
        assertTrue(html.contains("<pre>\n&lt;holoml version=\"0.2\"&gt;&lt;scene&gt;&lt;label&gt;Fish &amp;amp; chips&lt;/label&gt;"))
        assertTrue(html.contains("body > pre { display: none; }"))
        assertTrue(html.contains("<script type=\"module\" src=\"/__hyperspace3d__/viewer/assets/viewer.js\"></script>"))
        assertTrue(html.contains("hypersolHolomlLine: true"))
        assertFalse(html.contains("data-hypersol-lighter"))
        assertTrue(HolomlPage.wrapper("x", lighter = true).contains("<html data-hypersol-lighter>"))
    }

    @Test
    fun `a page that tries to end the hidden text early cannot`() {
        val html = HolomlPage.wrapper("</pre><script>alert(1)</script>", lighter = false)
        assertFalse(html.contains("</pre><script>alert(1)"))
        assertTrue(html.contains("&lt;/pre&gt;&lt;script&gt;alert(1)&lt;/script&gt;"))
    }
}
