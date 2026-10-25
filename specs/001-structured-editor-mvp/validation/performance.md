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
  "measuredAt": "2026-10-25T13:22:37.913Z"
}
```

Counts within display 2000ms / navigation 1000ms / input 100ms: {"display":20,"navigation":20,"input":20}.

| Run | Display ms | Navigation ms | Input ms |
| --- | ---: | ---: | ---: |
| 1 | 172.70 | 80.40 | 41.90 |
| 2 | 189.00 | 97.00 | 40.90 |
| 3 | 174.70 | 81.50 | 36.70 |
| 4 | 185.10 | 83.20 | 40.10 |
| 5 | 176.10 | 77.30 | 34.00 |
| 6 | 172.20 | 80.80 | 35.70 |
| 7 | 387.20 | 97.60 | 98.10 |
| 8 | 369.10 | 98.70 | 93.60 |
| 9 | 323.10 | 81.00 | 71.90 |
| 10 | 366.30 | 124.40 | 85.30 |
| 11 | 318.10 | 80.80 | 67.60 |
| 12 | 282.50 | 97.40 | 69.50 |
| 13 | 356.50 | 98.30 | 89.20 |
| 14 | 330.10 | 95.00 | 79.80 |
| 15 | 311.20 | 81.70 | 90.60 |
| 16 | 294.10 | 98.20 | 74.50 |
| 17 | 400.90 | 90.50 | 94.60 |
| 18 | 371.70 | 96.80 | 93.40 |
| 19 | 330.20 | 81.10 | 65.40 |
| 20 | 393.80 | 92.80 | 82.60 |

All raw values retained. Display/navigation include Playwright interaction; input measures browser beforeinput to the second animation frame.
Reference-device acceptance, AC/power mode and real stable Chrome/Edge remain unverified.
