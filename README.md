# Protok · Airport Ops Agentic OS

Two agents run a simulated passenger terminal:

- the **simulation agent** runs Monte Carlo forecasts of the security queues (100 possible futures for the next 3 hours, P10/P50/P90 wait per 15 minutes),
- the **logistics agent** reads the live flight feed and proposes staff moves between security zones,
- a **gate in code** checks 8 rules before any notification reaches the staff.

You can also load your own flight schedule (Excel or CSV, one or several files), analyse a whole day with and without the agent, and ask questions about the result. The app opens on a **Guide** tab with step-by-step tours (Macedonian and English).

Македонски: [README.mk.md](README.mk.md).

## Run it (no installation)

The ready-to-run app is the folder [`dist/Protok`](dist/Protok):

| File | What it is |
|---|---|
| `Protok.exe` | Windows launcher: opens the app in its own window with Edge or Chrome |
| `Protok.html` | The whole app in one file (works on Windows, macOS and Linux) |
| `README.txt` | Short help |

1. Get the folder (see *Getting the app from GitHub* below).
2. On Windows double-click `dist/Protok/Protok.exe`. On any other computer double-click `dist/Protok/Protok.html`.

Nothing to install, no internet needed. The folder can live on a USB stick.
If Windows shows "Windows protected your PC", click **More info** and then **Run anyway**, or open `Protok.html` directly.

## Getting the app from GitHub

**Easiest, no account and no tools:** on this page click the green **Code** button, then **Download ZIP**. Unzip it and open `dist/Protok`.

**With Git** (lets you update later with one command):

```bash
git clone https://github.com/Ljupcho1982/protok.git
cd protok
```

To get the latest version later:

```bash
git pull
```

## For developers

No dependencies; Node.js 18 or newer is enough for the web version and the tests.

```bash
node server.mjs                 # web version on http://127.0.0.1:8820 (MK/EN)
node --test test.mjs            # 11 engine tests, about 1 minute
node desktop/build.mjs          # rebuilds dist/Protok (Protok.exe needs Windows)
```

| Folder | Contents |
|---|---|
| `engine/` | Simulation, logistics agent, gate rules, queue model (runs in the browser and in Node) |
| `public/` | Web version (Macedonian/English) |
| `desktop/` | Source of the portable English desktop edition: 3D scene, data import, analysis, guide |
| `dist/Protok/` | Built portable app |

## Measured (my tests, 10 simulated days, 60 futures per step)

| | with agent | roster only |
|---|---|---|
| average wait | 1.14 min | 3.35 min |
| passengers over 10 min | 2,222 | 7,901 |
| boarding at risk | 26 | 1,248 |
| longest wait | 26.8 min | 66.7 min |

The forecast is a little overconfident: the real wait falls inside P10–P90 in 74% of cases (target 80%).

## What is not real

Every built-in flight, passenger and event is invented; the app is not connected to any real airport. The terminal is fixed (3 zones, 7 + 6 + 5 lanes, 138 passengers per hour per lane). There is no language model: notifications and answers are templates and every decision is made in code.

The 3D view uses [three.js](https://threejs.org) (MIT licence, see `dist/Protok/THREE-LICENSE.txt`).
