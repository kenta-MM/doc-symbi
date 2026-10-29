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
  "measuredAt": "2026-10-27T11:30:39.138Z"
}
```

Counts within display 2000ms / navigation 1000ms / input 100ms: {"display":20,"navigation":20,"input":20}.

| Run | Display ms | Navigation ms | Input ms |
| --- | ---: | ---: | ---: |
| 1 | 137.60 | 99.80 | 30.20 |
| 2 | 157.40 | 90.10 | 29.30 |
| 3 | 154.60 | 107.00 | 24.80 |
| 4 | 142.90 | 116.20 | 63.30 |
| 5 | 227.90 | 96.00 | 47.50 |
| 6 | 272.40 | 90.40 | 44.50 |
| 7 | 241.00 | 129.80 | 30.80 |
| 8 | 146.90 | 74.10 | 30.60 |
| 9 | 141.30 | 72.10 | 30.60 |
| 10 | 145.90 | 76.10 | 29.20 |
| 11 | 144.50 | 74.30 | 29.90 |
| 12 | 150.80 | 73.60 | 28.50 |
| 13 | 162.10 | 110.50 | 56.20 |
| 14 | 231.90 | 114.70 | 56.40 |
| 15 | 193.80 | 115.40 | 50.30 |
| 16 | 271.50 | 98.80 | 36.10 |
| 17 | 282.40 | 107.30 | 43.60 |
| 18 | 295.00 | 103.90 | 58.20 |
| 19 | 284.10 | 113.20 | 50.80 |
| 20 | 226.70 | 107.10 | 64.60 |

All raw values retained. Display/navigation include Playwright interaction; input measures browser beforeinput to the second animation frame.
Reference-device acceptance, AC/power mode and real stable Chrome/Edge remain unverified.
