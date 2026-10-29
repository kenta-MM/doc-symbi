# Performance measurements

Actual environment (not automatically the specified reference machine):

```json
{
  "os": "Windows 11 Pro",
  "release": "10.0.26300",
  "cpu": "Intel(R) Core(TM) Ultra 7 155H",
  "memoryGiB": 31.521263122558594,
  "browser": "156.0.8078.4",
  "viewport": "1920x1080",
  "mode": "headless Chromium, production-mode test build",
  "measuredAt": "2026-10-28T01:26:38.752Z"
}
```

Counts within display 2000ms / navigation 1000ms / input 100ms: {"display":20,"navigation":20,"input":20}.

| Run | Display ms | Navigation ms | Input ms |
| --- | ---: | ---: | ---: |
| 1 | 197.10 | 116.40 | 58.00 |
| 2 | 189.60 | 103.00 | 39.30 |
| 3 | 158.30 | 120.60 | 45.10 |
| 4 | 238.00 | 106.50 | 52.10 |
| 5 | 247.80 | 118.40 | 47.70 |
| 6 | 215.10 | 91.80 | 59.70 |
| 7 | 177.90 | 98.90 | 39.40 |
| 8 | 183.50 | 90.60 | 32.10 |
| 9 | 211.40 | 118.80 | 49.40 |
| 10 | 229.40 | 107.30 | 56.10 |
| 11 | 241.30 | 96.20 | 46.40 |
| 12 | 244.10 | 124.10 | 48.50 |
| 13 | 229.00 | 109.40 | 58.40 |
| 14 | 197.70 | 93.20 | 48.40 |
| 15 | 170.20 | 123.70 | 44.10 |
| 16 | 191.00 | 100.70 | 47.30 |
| 17 | 236.10 | 107.00 | 43.00 |
| 18 | 207.20 | 99.00 | 47.40 |
| 19 | 224.40 | 110.60 | 51.10 |
| 20 | 235.50 | 86.20 | 42.30 |

All raw values retained. Display/navigation include Playwright interaction; input measures browser beforeinput to the second animation frame.
Reference-device acceptance, AC/power mode and real stable Chrome/Edge remain unverified.
