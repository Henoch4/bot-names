# BotNames — on-chain name registry on BOT Chain

A human-readable name registry for wallets and agents on **BOT Chain testnet (chain 968)**.
Register a name like `zenith`, transfer it, renew yearly, and set a primary name that
resolves back to your address.

## Pages

| Page | What it does |
|---|---|
| `index.html` | Landing — live registry stats and name search |
| `app.html` | Register, transfer, renew, set primary, resolve |
| `docs.html` | Naming rules, contract API, demo activity, build & verify |

## On-chain (testnet)

- **BotNames:** [`0x2d41cdfbaC769696f5c2cA1630a293c28B2BEC2E`](https://scan.bohr.life/address/0x2d41cdfbaC769696f5c2cA1630a293c28B2BEC2E) — verified ✓
- **TestWBOT (fee token):** [`0xD8FBaBf44B2dbb427d881F8Ea66F14D8287A55c0`](https://scan.bohr.life/address/0xD8FBaBf44B2dbb427d881F8Ea66F14D8287A55c0) — `faucet()` mints 1,000 per tx
- Chain: `968` · RPC `https://rpc.bohr.life` · explorer `https://scan.bohr.life`

## Core API

```
register(label)                — claim an available name (TestWBOT fee, 1-year expiry)
renew(label)                   — extend expiry
transferName(label, to)        — sell or hand over
setPrimary(label)              — your headline name
resolve(label) → (owner, exp)  — lookup
isAvailable(label)             — preflight check
```

Events: `NameRegistered`, `NameRenewed`, `NameTransferred`, `PrimarySet`.

## Run locally

Static site — any file server works:

```bash
npx serve .
```

## Stack

- Vanilla HTML/CSS/JS (no build step)
- [ethers.js 6](https://docs.ethers.org/) via esm.sh
- [Reown AppKit](https://reown.com/appkit) for wallet connect
- Testnet tokens only — no monetary value
