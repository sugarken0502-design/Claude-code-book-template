# GitHub Actions ワークフロー ドキュメント

このドキュメントでは、`.github/workflows` に設定されている GitHub Actions ワークフローについて説明します。

---

## ワークフロー一覧

| ファイル名 | ワークフロー名 | 概要 |
|---|---|---|
| `claude.yml` | Claude Code | Issue・PRコメントで `@claude` をメンションすると Claude が応答・実装を行う |
| `claude-code-review.yml` | Claude Code Review | PRが作成・更新されると Claude が自動でコードレビューを行う |

---

## claude.yml

**ファイルパス:** `.github/workflows/claude.yml`

### 概要

Issue やプルリクエストのコメントで `@claude` をメンションすると、Claude が自動で応答・コード実装・質問回答などを行います。

### トリガー条件

以下のイベントが発生したとき、かつコメント本文または Issue タイトルに `@claude` が含まれている場合に実行されます。

| イベント | 詳細 |
|---|---|
| `issue_comment` | Issue にコメントが作成されたとき |
| `pull_request_review_comment` | PRのレビューコメントが作成されたとき |
| `pull_request_review` | PRのレビューが送信されたとき |
| `issues` | Issueが作成された、またはアサインされたとき |

### 必要な権限 (permissions)

| 権限 | レベル |
|---|---|
| `contents` | read |
| `pull-requests` | read |
| `issues` | read |
| `id-token` | write |
| `actions` | read（CI結果の読み取りに使用） |

### 使用するアクション

- `actions/checkout@v4` — リポジトリのチェックアウト
- `anthropics/claude-code-action@v1` — Claude Code の実行

### 必要なシークレット

| シークレット名 | 説明 |
|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code の認証トークン |

### カスタマイズ

`claude_args` パラメータを使用することで、Claude の動作を詳細に設定できます。  
詳細は [claude-code-action の使用方法](https://github.com/anthropics/claude-code-action/blob/main/docs/usage.md) を参照してください。

---

## claude-code-review.yml

**ファイルパス:** `.github/workflows/claude-code-review.yml`

### 概要

プルリクエストが作成・更新されると、Claude が自動でコードレビューを実施します。

### トリガー条件

以下の PR イベントが発生したときに実行されます。

| イベント | 説明 |
|---|---|
| `opened` | PRが新規作成されたとき |
| `synchronize` | PRに新しいコミットがプッシュされたとき |
| `ready_for_review` | ドラフトPRがレビュー可能になったとき |
| `reopened` | 閉じられたPRが再度オープンされたとき |

> **補足:** `paths` フィルターを設定することで、特定のファイル変更があった場合のみ実行するよう制限できます（現在はコメントアウト済み）。

### 必要な権限 (permissions)

| 権限 | レベル |
|---|---|
| `contents` | read |
| `pull-requests` | read |
| `issues` | read |
| `id-token` | write |

### 使用するアクション

- `actions/checkout@v4` — リポジトリのチェックアウト
- `anthropics/claude-code-action@v1` — Claude Code Review の実行

### プラグイン設定

| パラメータ | 値 | 説明 |
|---|---|---|
| `plugin_marketplaces` | `https://github.com/anthropics/claude-code.git` | プラグインのマーケットプレイスURL |
| `plugins` | `code-review@claude-code-plugins` | 使用するプラグイン |
| `prompt` | `/code-review:code-review {リポジトリ}/pull/{PR番号}` | レビュー実行コマンド |

### 必要なシークレット

| シークレット名 | 説明 |
|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code の認証トークン |

### カスタマイズ

`if` 条件を使用することで、特定の PR 作成者のみレビューを実行するよう制限できます（現在はコメントアウト済み）。

例:
```yaml
if: |
  github.event.pull_request.user.login == 'external-contributor' ||
  github.event.pull_request.author_association == 'FIRST_TIME_CONTRIBUTOR'
```

---

## セットアップ方法

1. リポジトリの **Settings > Secrets and variables > Actions** を開く
2. `CLAUDE_CODE_OAUTH_TOKEN` シークレットを追加する
   - トークンは [Claude Code](https://claude.ai/code) から取得できます

---

## 参考リンク

- [claude-code-action リポジトリ](https://github.com/anthropics/claude-code-action)
- [使用方法ドキュメント](https://github.com/anthropics/claude-code-action/blob/main/docs/usage.md)
- [Claude Code CLI リファレンス](https://code.claude.com/docs/en/cli-reference)
- [FAQ](https://github.com/anthropics/claude-code-action/blob/main/docs/faq.md)
