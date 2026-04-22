# 名刺メーラー

名刺を撮影するだけでお礼メールを自動送信するWebアプリ。

## セットアップ

```bash
npm install
```

## 環境変数

`.env.local` を作成：

```
ANTHROPIC_API_KEY=your_api_key_here
```

## ローカル起動

```bash
npm run dev
```

http://localhost:3000 をスマホ（同じWi-Fi）でアクセスする場合:
http://<PCのIPアドレス>:3000

## Vercelデプロイ

```bash
npm i -g vercel
vercel
```

Vercelの環境変数に `ANTHROPIC_API_KEY` を設定する。

## 注意

Gmail送信にはClaude.aiのGmail MCP連携が必要です。
Vercelデプロイ後、claude.aiのGmailツールがオンになっている状態でアクセスしてください。
