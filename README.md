# RiffGame

A browser rhythm game with in-app song and chart editors. Play, compose, and chart
songs entirely in the browser — no install required.

## Stack

- Blazor WebAssembly (.NET 10)
- C# front-end
- Web Audio via JavaScript interop (ES modules)

## Local development

```
dotnet run
```

Then open the URL printed by the dev server.

## Deploy

Push to `main`. The GitHub Actions workflow in `.github/workflows/deploy.yml`
publishes the project and deploys `wwwroot` to GitHub Pages.

Repository Pages settings: **Settings → Pages → Source = GitHub Actions**.

## Hosting / base href

This repo is meant to be served from:

```
https://mist-eros.github.io/Rhythm-Game-In-browser-thing/
```

The base href in `wwwroot/index.html` is set to `/Rhythm-Game-In-browser-thing/`
so that navigation and asset paths resolve correctly under that subpath.

## Project layout

| Folder | Purpose |
| --- | --- |
| `Game/` | Game loop, state, timing |
| `Audio/` | Web Audio interop wrappers |
| `Charts/` | JSON chart models + loader (gameplay layer) |
| `Songs/` | JSON song models + loader (music layer) |
| `Input/` | Input handling |
| `Interop/` | C# wrappers around JS modules |
| `Components/` | Razor components |
| `wwwroot/js/` | JS ES modules |
| `wwwroot/songs/` | Saved song JSON files |
| `wwwroot/charts/` | Saved chart JSON files |

> Skeleton only — gameplay, audio, and editor logic are not implemented yet.
