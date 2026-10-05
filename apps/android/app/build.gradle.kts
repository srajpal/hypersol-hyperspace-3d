plugins {
    id("com.android.application")
}

android {
    namespace = "io.github.srajpal.hyperspace3d"
    compileSdk = 36

    defaultConfig {
        applicationId = "io.github.srajpal.hyperspace3d"
        // Android 10: a view's animation matrix, which places the page on its tilted panel.
        minSdk = 29
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }

    buildTypes {
        debug {
            // Signed with Android's debug key, installed by hand over USB: nothing is published.
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    // The room's page, the top bar, and the HoloML viewer, built from the desktop's code (`pnpm build:web`).
    sourceSets.getByName("main") { assets.directories.add("build/web-assets") }
}

dependencies {
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.webkit:webkit:1.14.0")
    testImplementation("junit:junit:4.13.2")
}
