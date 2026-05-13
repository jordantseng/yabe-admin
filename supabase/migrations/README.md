# Database migrations

依檔名前綴時間順序套用：

| 檔案 | 說明 |
|------|------|
| `20260429120000_initial_schema.sql` | `packages`、`orders`、RLS、`peek_next_package_number` RPC（baseline） |
| `20260514120000_security_advisor_fixes.sql` | Security Advisor：`search_path`、RLS 非 `true`、`peek_next_package_number` 改 `SECURITY INVOKER` |
| `20260514130100_revoke_rls_auto_enable_execute.sql` | 撤銷 `public.rls_auto_enable` 對 `PUBLIC`／`anon`／`authenticated` 的 `EXECUTE`（雲端既有函式） |

本機：`supabase db reset`（會依序套用以上檔案）。

**若 Supabase 雲端曾套用過舊的多檔 migration**：版本紀錄與現在 repo 不一致，請與團隊決定是要建新專案／手動對齊 `schema_migrations`，不要直接混用以免重複建表或版本錯亂。
