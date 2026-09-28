# AMO source package instructions

This source archive matches the version 1.15 upload archive. The extension's JavaScript and UI files are included in source form under `extension/`; the extension has no project-specific transpilation, minification, or bundling step.

To recreate the AMO extension archive, zip the contents of `extension/` so `manifest.json` is at the archive root. The upload archive contains those files directly; it is not a generated JavaScript bundle.

The vendored `extension/lib/pbf@3.0.5/pbf.js` is a third-party release artifact, not project-generated code. It is identical to `package/dist/pbf.js` in the official `pbf@3.0.5` npm package. Its SHA-256 is `bf45b17ab66d67a005eff1623279496cfcc74454a6f8a9b68cf86fe116152346`. To retrieve and inspect the same published artifact, run:

```sh
npm pack pbf@3.0.5
tar -xzf pbf-3.0.5.tgz package/dist/pbf.js
```

The readable source is `index.js` at the upstream `v3.0.5` tag. The release package metadata documents the `build-min` command and its Browserify/UglifyJS tools. The source archive does not rebuild or modify this third-party file.

Links:

- Exact release archive: https://registry.npmjs.org/pbf/-/pbf-3.0.5.tgz
- Readable source: https://github.com/mapbox/pbf/blob/v3.0.5/index.js
- Build metadata: https://github.com/mapbox/pbf/blob/v3.0.5/package.json
- BSD 3-Clause license: https://github.com/mapbox/pbf/blob/v3.0.5/LICENSE
