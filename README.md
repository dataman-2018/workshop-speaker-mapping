# Workshop Speaker Mapping

ワークショップ音声・動画から、参加者ごとの自己紹介音声で話者を事前登録し、本番の会話を話者分離して会話ログを生成する Web アプリ。

## 機能

- プロジェクト / セッション / 参加者の管理
- 参加者ごとの自己紹介音声アップロード（話者登録）
- 本番音声・動画アップロード
- 非同期での話者分離 + 話者照合 + 文字起こし
- タイムスタンプ付き会話ログ表示
- 話者ラベルの手動修正（unknown 絞り込み対応）
- 再処理の実行

## アーキテクチャ

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Next.js UI │────▶│  API Routes  │────▶│  Prisma (PG)    │
│  (App Router)│     │  (BFF)       │     └─────────────────┘
└─────────────┘     └──────┬───────┘
                           │
                    ┌──────▼───────┐     ┌─────────────────┐
                    │  Processing  │────▶│  Audio Provider  │
                    │  Pipeline    │     │  (adapter)       │
                    └──────────────┘     └─────────────────┘
                                                │
                                         ┌──────▼───────┐
                                         │  Vercel Blob  │
                                         └──────────────┘
```

## 処理フロー

```
1. 参加者ごとの自己紹介ファイルを受信
2. 自己紹介から speaker embedding を抽出
3. 品質スコアを算出し speaker profile を作成
4. 本番ファイルを受信
5. 本番ファイルを話者分離 (diarization)
6. 分離された各クラスタの特徴量を抽出
7. speaker profile と照合し A/B/C を割り当て
8. 信頼度が閾値未満なら unknown にする
9. STT 結果と結合して発話単位ログを生成
```

## セットアップ

### 前提

- Node.js 20+
- PostgreSQL
- Vercel Blob トークン（デプロイ時）

### インストール

```bash
git clone <repo>
cd workshop-speaker-mapping
npm install
cp .env.example .env
# .env の DATABASE_URL を編集
```

### DB セットアップ

```bash
npm run db:push      # スキーマをDBに反映
npm run db:seed      # デモデータ投入
npm run db:studio    # Prisma Studio (GUI)
```

### 起動

```bash
npm run dev          # http://localhost:3000
```

### テスト

```bash
npm test             # 全テスト実行
npm run test:watch   # ウォッチモード
```

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui |
| BFF | Next.js Route Handlers |
| DB | PostgreSQL + Prisma 6 |
| ファイル | Vercel Blob |
| バリデーション | Zod |
| 音声処理 | Adapter pattern（差し替え可能） |
| テスト | Vitest |

## API 一覧

| Method | Path | 説明 |
|--------|------|------|
| GET | `/api/projects` | プロジェクト一覧 |
| POST | `/api/projects` | プロジェクト作成 |
| GET | `/api/projects/:id` | プロジェクト詳細 |
| GET | `/api/sessions?projectId=` | セッション一覧 |
| POST | `/api/sessions` | セッション作成 |
| GET | `/api/sessions/:id` | セッション詳細 |
| GET | `/api/participants?sessionId=` | 参加者一覧 |
| POST | `/api/participants` | 参加者追加 |
| POST | `/api/uploads/enrollment` | 自己紹介アップロード |
| POST | `/api/uploads/session` | 本番音声アップロード |
| POST | `/api/jobs/start` | 処理開始 |
| GET | `/api/jobs?sessionId=` | ジョブ一覧 |
| GET | `/api/jobs/:id` | ジョブ状態 |
| GET | `/api/sessions/:id/transcript` | 会話ログ取得 |
| PATCH | `/api/utterances/:id` | 話者ラベル修正 |
| POST | `/api/sessions/:id/reprocess` | 再処理 |

## DB モデル

```
User ─┬─ Project ─── Session ─┬─ Participant ─┬─ EnrollmentSample
      │                        │               ├─ SpeakerProfile
      │                        │               └─ SpeakerAssignment
      │                        ├─ MediaAsset
      │                        ├─ ProcessingJob
      │                        └─ TranscriptUtterance ── SpeakerAssignment
      └─ AuditLog
```

## 音声処理プロバイダー

Adapter pattern により音声処理 API を差し替え可能。

```
AUDIO_PROVIDER=dummy      # ダミー（開発用）
AUDIO_PROVIDER=deepgram   # Deepgram（未実装）
AUDIO_PROVIDER=assemblyai # AssemblyAI（未実装）
```

新しいプロバイダーを追加するには:
1. `src/lib/audio/providers/` に `AudioProcessingProvider` を実装
2. `src/lib/audio/provider-factory.ts` に登録

## ディレクトリ構成

```
src/
  app/                    # Next.js App Router
    (dashboard)/          # ダッシュボードページ群
    api/                  # API Route Handlers
  components/             # 共通UIコンポーネント (shadcn/ui)
  features/               # 機能別モジュール
    uploads/              # アップロード UI
    processing/           # 処理状態 UI
    transcripts/          # 会話ログ・手修正 UI
  lib/                    # インフラ層
    audio/                # 音声処理 (provider interface + adapter)
    db/                   # Prisma client
    blob/                 # Vercel Blob client
    validations/          # Zod スキーマ
  server/                 # サーバーサイドロジック
    repositories/         # DB アクセス層
    services/             # ビジネスロジック
  types/                  # 共通型定義
prisma/
  schema.prisma           # DB スキーマ
  seed.ts                 # シードデータ
```

## 設計判断

- **unknown を許容**: 全発話を必ず A/B/C に割り当てない。短い発話・相槌・重なりは低信頼として扱う
- **Adapter pattern**: 音声処理 API への依存を固定しない
- **非同期処理**: 重い音声処理はジョブとして非同期実行
- **再処理可能**: ジョブは idempotent。既存データをクリーンアップして再実行
- **手修正**: 自動結果を人間が確認・修正できる UI を提供
