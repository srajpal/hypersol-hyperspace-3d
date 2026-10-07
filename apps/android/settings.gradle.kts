// HyperSpace 3D for Android (milestone 24): the Gradle build of the app.
// Plugins and libraries come from Google's Maven repository and Maven
// Central only (approved with the plan, prompt 155).
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "hyperspace3d-android"
include(":app")
