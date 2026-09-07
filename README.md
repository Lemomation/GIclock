# GIclock

Study app with Genshin Impact theme. Earn primogems by studying, pull characters, and build friendships!

## Features

- Pomodoro timer + stopwatch
- Gacha system with real pity (5★ at hard pity 90, 4★ at 10)
- Companions that grow friendship while you study
- Unlock character-specific rewards (backgrounds, pfps, namecards)
- Sync via Supabase (coming soon)

## Setup

```bash
npm install
npx cap init
npx cap add android
npm run build  # or use GitHub Actions
```

## Adding Characters

Place assets in `app/assets/characters/char_<Name>/`:
- `pfp.jpg` - 736×736 square
- `Background.jpg` - landscape
- `Namecard.jpg` - horizontal banner (rotate if needed)
- `banner.jpg` - full gacha banner (1080×1920)
