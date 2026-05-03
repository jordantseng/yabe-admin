# Database migrations

目前只有 **一支** migration，由上到下一次跑完即為完整 schema，不必記順序：

| 檔案 | 說明 |
|------|------|
| `20260429120000_initial_schema.sql` | `packages`、`orders`、RLS、`peek_next_package_number` RPC |

本機：`supabase db reset`（會套用這一支）。

**若 Supabase 雲端曾套用過舊的多檔 migration**：版本紀錄與現在 repo 不一致，請與團隊決定是要建新專案／手動對齊 `schema_migrations`，不要直接混用以免重複建表或版本錯亂。
