# Railway Deployment Guide

This guide deploys the bot to Railway so it can run continuously without your computer staying on.

## What Railway Should Run

This repository is a long-running Node.js worker, not a web app.

Railway should:

- build the TypeScript project
- run `npm start`
- keep one instance alive
- store all secrets as Railway environment variables

## 1. Create a Railway Project

In Railway:

1. Create a new project
2. Choose `Deploy from GitHub repo`
3. Select this repository

Railway will detect Node.js automatically.

## 2. Build and Start Commands

This repo now includes `railway.json`, so Railway should use:

- Build: Nixpacks default Node build
- Start: `npm start`

If Railway asks manually, use:

```bash
npm run build
```

for build, and:

```bash
npm start
```

for start.

## 3. Add Environment Variables

In Railway project variables, add the same values you validated locally.

Required variables:

- `USER_ADDRESSES`
- `PROXY_WALLET`
- `PRIVATE_KEY`
- `MONGO_URI`
- `RPC_URL`
- `CLOB_HTTP_URL`
- `CLOB_WS_URL`
- `USDC_CONTRACT_ADDRESS`

Recommended live-trading safeguards:

- `NODE_ENV=production`
- `MAX_BALANCE_USAGE_PERCENT=10`
- `MAX_ORDER_SIZE_USD=5`
- `MIN_ORDER_SIZE_USD=1`

Optional if needed for your account type:

- `CLOB_SIGNATURE_TYPE=AUTO`

## 4. Database and RPC Requirements

Before deploying, confirm:

- `MONGO_URI` points to MongoDB Atlas or another always-on MongoDB instance
- your MongoDB network access rules allow Railway egress
- `RPC_URL` is a stable Polygon mainnet RPC endpoint

## 5. First Deployment Check

After deploy, open Railway logs and confirm:

- MongoDB connected
- CLOB client initialized
- bot starts monitoring traders
- no `invalid signature` errors on executable trades

## 6. Important Railway Notes

- Do not expose a public domain for this service unless you actually add an HTTP server
- Keep exactly one running instance
- Do not scale horizontally; multiple bot instances can double-execute trades

## 7. Updating Later

Once connected to GitHub, pushes to your selected branch can redeploy automatically.

Recommended update flow:

1. test locally
2. push to GitHub
3. watch Railway deploy logs
4. verify runtime logs after deploy

## 8. Common Problems

### Build succeeds but bot skips all buys

- wallet has too little USDC
- copied size falls below `$1`
- `MAX_BALANCE_USAGE_PERCENT` is too restrictive for your balance

### Bot starts but cannot connect to MongoDB

- wrong Atlas credentials
- Atlas network access blocks Railway

### Bot detects trades but order placement fails

- wrong `PROXY_WALLET` / `PRIVATE_KEY` pairing
- wrong Polymarket signature mode for the account
- missing allowance or insufficient balance

### Bot restarts repeatedly

- missing env vars
- health check would fail locally too
- invalid MongoDB or RPC configuration

## 9. Safer Starting Configuration

If you want conservative live behavior, start with:

```env
COPY_SIZE=10
MAX_BALANCE_USAGE_PERCENT=10
MAX_ORDER_SIZE_USD=5
MIN_ORDER_SIZE_USD=1
```

Then fund the wallet modestly, observe behavior, and only scale up after several successful live copies.