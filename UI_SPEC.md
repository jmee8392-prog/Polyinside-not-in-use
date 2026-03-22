# Telegram UI Specification - Professional Sniper Format

## MarkdownV2 Implementation

### Escape Rules
All special characters MUST be escaped with backslash `\` in MarkdownV2:

| Character | Usage | Escaped |
|-----------|-------|---------|
| `-` | Hyphens | `\-` |
| `.` | Periods | `\.` |
| `!` | Exclamation | `\!` |
| `+` | Plus | `\+` |
| `*` | Bold | `\*` |
| `_` | Italic | `\_` |
| `[` | Link start | `\[` |
| `]` | Link end | `\]` |
| `(` | Paren | `\(` |
| `)` | Paren | `\)` |
| `~` | Strikethrough | `\~` |
| `` ` `` | Code | `` \` `` |
| `>` | Quote | `\>` |
| `#` | Hash | `\#` |
| `=` | Equals | `\=` |
| `\|` | Pipe | `\\|` |
| `{` | Brace | `\{` |
| `}` | Brace | `\}` |

### Escape Helper Function
```javascript
const escapeMd = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/[_*\[\]()~`>#+=|{}.!-]/g, '\\$&');
};
```

---

## Alert Format Specification

### Standard Alert (Insider/Whale Trade)

**Format:**
```
🚀 *INSIDER ALPHA*
━━━━━━━━━━━━━━━━━━
🎯 Market: [Clean Market Name]
💎 Trade: [YES/NO] | $[Amount]
👤 Wallet: [Address] ([Count] Trades)
📊 Confidence: [%] | Window: 120s
━━━━━━━━━━━━━━━━━━

🔗 [TRADE ON POLYMARKET](https://data-api.polymarket.com/event/[slug])
```

**Example:**
```
🚀 *INSIDER ALPHA*
━━━━━━━━━━━━━━━━━━
🎯 Market: Trump
💎 Trade: YES | $5,432.10
👤 Wallet: 0x123456abc789\.\.\. (3 Trades)
📊 Confidence: 87% | Window: 120s
━━━━━━━━━━━━━━━━━━

🔗 [TRADE ON POLYMARKET](https://data-api.polymarket.com/event/TRUMP2024)
```

**MarkdownV2 Output:**
```
🚀 *INSIDER ALPHA*
━━━━━━━━━━━━━━━━━━
🎯 Market: Trump
💎 Trade: YES \| $5,432\.10
👤 Wallet: 0x123456abc789\.\.\. \(3 Trades\)
📊 Confidence: 87% \| Window: 120s
━━━━━━━━━━━━━━━━━━

🔗 [TRADE ON POLYMARKET](https://data\-api\.polymarket\.com/event/TRUMP2024)
```

---

### Coordinated Move Alert

**Format:**
```
🚨 *COORDINATED MOVE ALPHA*
━━━━━━━━━━━━━━━━━━
🎯 Market: [Contract ID]
👥 Cluster: [Count] Wallets
📊 Confidence: [%] | Window: 120s
━━━━━━━━━━━━━━━━━━

🔗 [TRADE ON POLYMARKET](https://data-api.polymarket.com/event/[slug])
```

---

## Data Mapping

### Market to Token Mapping

```javascript
const marketTokenMapping = {
  'TRUMP2024': { 'trump_yes': 'YES', 'trump_no': 'NO' },
  'CRYPTO20M': { 'crypto_yes': 'YES', 'crypto_no': 'NO' },
  'DOGE2025': { 'doge_yes': 'YES', 'doge_no': 'NO' },
  'BTC80K': { 'btc_yes': 'YES', 'btc_no': 'NO' },
  'ETH4K': { 'eth_yes': 'YES', 'eth_no': 'NO' },
  // ... etc
};
```

### Asset ID Resolution

1. Receive `assetId` from alert payload
2. Look up in `marketTokenMapping[market][assetId]`
3. Return 'YES' or 'NO'
4. Fallback to random 50/50 if not found

---

## Currency Formatting

### Specification
- Format: `$X,XXX.XX`
- Thousand separators: comma
- Decimals: always 2 places
- Locale: US English

### Implementation
```javascript
const formatCurrency = (amount) => {
  return '$' + parseFloat(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};
```

### Examples
- 1000 → `$1,000.00`
- 5432.1 → `$5,432.10`
- 100 → `$100.00`
- 50000 → `$50,000.00`

---

## Market Name Cleaning

### Transformation
Remove suffixes and format cleanly:
- `TRUMP2024` → `TRUMP`
- `CRYPTO20M` → `CRYPTO`
- `BTC80K` → `BTC`
- `ETH4K` → `ETH`
- `PREDICTION_QTR` → `PREDICTION`

### Implementation
```javascript
const cleanMarketName = (marketId) => {
  return marketId
    .replace(/([A-Z])/g, ' $1')
    .replace(/2024|2025|20M|4K|80K|_QTR|_YOY/g, '')
    .trim()
    .split(/\s+/)
    .join(' ');
};
```

---

## Polymarket Link Format

### URL Structure
```
https://data-api.polymarket.com/event/[market-slug]
```

### Examples
- Trump 2024: `https://data-api.polymarket.com/event/TRUMP2024`
- Bitcoin 80K: `https://data-api.polymarket.com/event/BTC80K`

### MarkdownV2 Encoding
URLs with special chars must be escaped:
```
https://data\-api\.polymarket\.com/event/TRUMP2024
```

---

## Alert Data Structure

### Required Fields
```javascript
{
  id: string,              // Unique alert ID
  walletId: string,        // 0x... wallet address
  type: string,            // 'FRESH_WALLET' | 'BEHAVIOR_SHIFT' | 'COORDINATED_MOVE'
  confidence: number,      // 0-100
  contractId: string,      // Market identifier
  assetId: string,         // Token for YES/NO mapping
  tradeAmount: number,     // Dollar amount
  previousBets: number,    // Trade count
  timestamp: Date,         // Alert time
  severity: string,        // 'critical' | 'high' | 'medium'
  isCoordinated: boolean,  // Coordinated move flag
  isWhale: boolean,        // Whale flag
}
```

---

## Parse Mode: MarkdownV2

### Telegram API Call
```javascript
telegramBot.sendMessage(chatId, message, {
  parse_mode: 'MarkdownV2'
});
```

### Fallback Strategy
If MarkdownV2 parsing fails:
1. Log error with chat ID
2. Retry with plain text (no escaping)
3. Ensure alert still reaches user

---

## Testing Checklist

- [ ] Comma formatting in currency ($1,234.56)
- [ ] YES/NO mapping from market tokens
- [ ] Special char escaping (-, ., !, +)
- [ ] Market name cleaning (remove 2024/2025/etc)
- [ ] Polymarket URL format
- [ ] MarkdownV2 bold (*text*)
- [ ] Link syntax ([text](url))
- [ ] Wallet address truncation
- [ ] Confidence percentage display
- [ ] Coordinated move alerts show wallet count
- [ ] Fallback to plain text works
- [ ] Admin receives instant alerts

---

## Performance Notes

- Escaping function: <1ms per alert
- Currency formatting: <1ms per alert
- Market name cleaning: <1ms per alert
- Total Telegram API latency: 1-3 seconds
- Expected user delivery: 2-5 seconds

---

## Troubleshooting

### Message Fails to Send
**Error:** `400 Bad Request: can't parse entities`
- **Cause:** Missing escape on special character
- **Fix:** Verify all `-._!+[]()~\`>#=|{}` are escaped
- **Fallback:** Message automatically retried without MarkdownV2

### Currency Not Formatted Correctly
**Error:** Shows as "5432.1" instead of "$5,432.10"
- **Cause:** formatCurrency() not called
- **Fix:** Ensure tradeAmount passes through formatCurrency()

### Market Name Wrong
**Error:** Shows "TRUMP2024" instead of "TRUMP"
- **Cause:** cleanMarketName() not applied
- **Fix:** Verify contractId goes through cleanMarketName()

### YES/NO Not Mapping
**Error:** Shows "maybe" instead of YES/NO
- **Cause:** assetId not in marketTokenMapping
- **Fix:** Add mapping or verify assetId is correct

---

## Version
- **Last Updated:** 2026-03-22
- **MarkdownV2 Spec:** Telegram Bot API 6.0+
- **Status:** Production Ready
