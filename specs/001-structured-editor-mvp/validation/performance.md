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
  "measuredAt": "2026-10-27T06:19:13.132Z"
}
```

Counts within display 2000ms / navigation 1000ms / input 100ms: {"display":20,"navigation":20,"input":19}.

| Run | Display ms | Navigation ms | Input ms |
| --- | ---: | ---: | ---: |
| 1 | 185.30 | 111.30 | 58.90 |
| 2 | 176.70 | 104.80 | 36.10 |
| 3 | 165.20 | 88.30 | 43.70 |
| 4 | 344.40 | 135.20 | 91.80 |
| 5 | 315.60 | 146.70 | 86.10 |
| 6 | 315.50 | 131.10 | 82.80 |
| 7 | 306.70 | 137.30 | 98.50 |
| 8 | 325.00 | 140.20 | 88.40 |
| 9 | 297.70 | 134.90 | 93.40 |
| 10 | 317.60 | 139.30 | 90.80 |
| 11 | 318.40 | 144.60 | 81.90 |
| 12 | 314.80 | 138.70 | 94.10 |
| 13 | 300.50 | 137.10 | 87.40 |
| 14 | 328.80 | 137.70 | 101.90 |
| 15 | 304.60 | 158.30 | 84.70 |
| 16 | 280.50 | 129.20 | 92.30 |
| 17 | 337.70 | 134.30 | 79.50 |
| 18 | 290.50 | 157.10 | 91.90 |
| 19 | 321.40 | 148.70 | 95.10 |
| 20 | 294.80 | 143.00 | 91.50 |

All raw values retained. Display/navigation include Playwright interaction; input measures browser beforeinput to the second animation frame.
Reference-device acceptance, AC/power mode and real stable Chrome/Edge remain unverified.
