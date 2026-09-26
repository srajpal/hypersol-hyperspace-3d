# HyperSol HyperSpace 3D — Brief

The product was named HyperSol WebSurfer 3D until 2026-09-26 (owner,
prompt 42).

## User
The general public: everyday people who browse the web on a Windows, Mac,
or Linux desktop and want something more engaging than a flat browser.
A secondary audience is web developers who want to build native 3D
websites with HoloML.

## Problem
Every mainstream browser shows the web as a flat rectangle. Content that
would benefit from depth, such as products, places, and spaces, is
squeezed into 2D images. There is no open, HTML-like way to publish a
true 3D website, and no browser that turns the everyday web into a 3D
experience without effort from the site owner.

## Full idea
HyperSol HyperSpace 3D is an open-source desktop browser whose interface
lives in a 3D space. Regular websites render on floating panels in a 3D
room, with page sections lifted into layered depth. Where possible, the
browser detects images and 3D models on a page and turns them into
objects you can inspect. It embeds an existing web engine (Chromium, via
Electron) so modern sites work from day one. One known exception: sites
that need DRM video, such as Netflix, do not play in Electron.

Alongside the browser, HoloML is a new open markup language for fully 3D
websites, kept as clean and approachable as HTML. A car maker can publish
a showroom where every car is a 3D model you walk around, with labels,
links, lights, materials, and animation described in plain markup. The
browser and language are developed together, in separate repositories,
so each stays useful on its own.

The browser looks slick and futuristic, supports themes, and treats
privacy as a default: built-in ad and tracker blocking, zero telemetry,
and encrypted DNS. Both projects are licensed under Apache 2.0; the
HoloML specification text is also available under CC BY 4.0.

## First useful result
Open any normal website in the 3D browser interface on Windows, Mac, and
Linux, with themes. Concretely: a working browser with tabs, address bar,
bookmarks, and history, where each page is a panel in a 3D room, page
sections show layered depth, and the user can switch between at least
two themes. Ad and tracker blocking, no telemetry, and encrypted DNS are
on by default. Mouse, keyboard, and touch input.

## Features for later
- HoloML version 1: load a 3D model, place it in a scene, walk or orbit
  around it, text labels and links, lights, materials, animation
- HoloML car showroom demo site
- Detect images and 3D models on 2D pages and lift them into 3D objects
- iOS and Android
- HoloML scripting and interactivity (configurators, paint colors, wheels)
- VR headset support
- Tor or VPN integration
- Extensions, sync, and a theme marketplace
