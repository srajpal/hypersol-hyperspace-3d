# Branding

- logo-concepts/: the app logo's first concepts (its own README);
  concept 4d is the app's icon since 0.9.1 (`pnpm --filter
  @hypersol/browser icons` makes apps/browser/resources/icons from it).
- social-preview.png: the picture GitHub and link cards show for the
  repository (1280 by 640), the logo and the words over the README's
  first screenshot, drawn by `pnpm --filter @hypersol/browser
  social-previews` (apps/browser/scripts/social-previews.mjs), which
  draws holoml's too when that repository is beside this one (GitHub
  issue #95). Uploaded by hand in Settings, General, Social preview.
- attested.svg: the *attested* badge beside each zip in the README's
  Download section (72 by 20), linked to that zip's build provenance
  attestation; drawn by hand for this project, a white check mark and
  word on its own green, so it reads on light and dark pages, and
  loads nothing from elsewhere (GitHub issue #127).
