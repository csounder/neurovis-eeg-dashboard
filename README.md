# NeuroViz EEG

Next.js **web** dashboard + Node **`server-enhanced.js`** for Muse / OpenBCI-style streaming, DSP, OSC, simulator, and recordings.

## Quick start

**Backend** (API + WebSocket + OSC relay), from repo root:

```bash
npm install
npm start
```

Default: HTTP **3000**, WebSocket **8080**, OSC per your `server-enhanced.js` / `.env` config.

**Frontend** (App Router UI on **3001**):

```bash
cd web
npm install
npm run dev
```

Open **http://localhost:3001**. The app proxies `/api/*` to `http://localhost:3000` (override with `NEUROVIS_API_ORIGIN` in `web/next.config.mjs`).

**Muse quick starts:** [docs/QUICKSTART-ATHENA.md](docs/QUICKSTART-ATHENA.md) (Muse S Athena) · [docs/QUICKSTART-MUSE2.md](docs/QUICKSTART-MUSE2.md) (Muse 2 / Swift).

**OpenBCI:** [docs/QUICKSTART-GANGLION.md](docs/QUICKSTART-GANGLION.md) (Ganglion) · [docs/QUICKSTART-ULTRACORTEX.md](docs/QUICKSTART-ULTRACORTEX.md) (Ultra Cortex / Cyton+Daisy).

**Ports busy?** If `npm start` crashes with `EADDRINUSE` on 3000/8080/5000, an old backend is still running — don’t start two copies, or `kill` the existing `node` on 3000 and retry. See [docs/QUICKSTART-LAUNCH-PAIR-PLAY.md](docs/QUICKSTART-LAUNCH-PAIR-PLAY.md) §2 (two terminals + troubleshooting).

## Docs

Full index: **[docs/README.md](docs/README.md)**

- **One-click launch (macOS):** [LAUNCH.md](LAUNCH.md)
- **Concert mode** (53 visualizers, NIME Csound, record performance, show queues): **[docs/CONCERT-MODE.md](docs/CONCERT-MODE.md)** → <http://localhost:3001/concert>
- **Quick start — launch, pair, play:** [docs/QUICKSTART-LAUNCH-PAIR-PLAY.md](docs/QUICKSTART-LAUNCH-PAIR-PLAY.md)
- **Quick start — Muse S Athena:** [docs/QUICKSTART-ATHENA.md](docs/QUICKSTART-ATHENA.md)
- **Quick start — Muse 2 (Swift):** [docs/QUICKSTART-MUSE2.md](docs/QUICKSTART-MUSE2.md)
- **Quick start — OpenBCI Ganglion:** [docs/QUICKSTART-GANGLION.md](docs/QUICKSTART-GANGLION.md)
- **Quick start — Ultra Cortex (Cyton+Daisy):** [docs/QUICKSTART-ULTRACORTEX.md](docs/QUICKSTART-ULTRACORTEX.md)
- **Handoff / architecture / continuation prompt:** [docs/HANDOFF.md](docs/HANDOFF.md)
- **V12–V17 workstation (MIDI CC + EEG mapping):** [docs/V12-V17-WORKSTATION-MODES.md](docs/V12-V17-WORKSTATION-MODES.md)

## License

MIT (see historical `package.json` author field).
