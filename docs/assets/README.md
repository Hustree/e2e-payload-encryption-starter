# docs/assets

Images embedded in top-level documentation (README, docs/*).

## `demo.gif`

Short screen recording of the end-to-end encrypted flow — form submit → encrypted request in the Network tab → decrypted response rendered. Target length: 10–20 seconds, under 4 MB.

Suggested recorders:

- **macOS** — [LICEcap](https://www.cockos.com/licecap/) or [Kap](https://getkap.co/) (both output GIF/MP4 directly)
- **Windows/Linux** — [Peek](https://github.com/phw/peek) or [ScreenToGif](https://www.screentogif.com/)
- **Terminal flow only** — [asciinema](https://asciinema.org/) + [agg](https://github.com/asciinema/agg) → GIF

Recording steps:

1. `./scripts/dev.sh`
2. Open http://localhost:3000, hard-refresh to clear any cached `kid`.
3. Open DevTools → Network tab, filter for `loan`.
4. Record: fill form → submit → expand the request → show the compact-JWE body → show decrypted response in the UI.
5. Save as `demo.gif` in this folder. The root `README.md` already references it.

## `hero.png`

Optional static hero image. A 1200×630 OG-style graphic works well — the left half can show the JWE structure (`Header.EncryptedKey.IV.Ciphertext.AuthTag`), the right half a browser/server split.
