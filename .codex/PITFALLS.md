# Factory Console Pitfalls

## 2026-09-05 — 修复与实连验收补充（旧条目是历史记录）

- 已修复原 Review 的 R01–R14；R13/R14 现已进入默认测试集。默认状态读不调用上游 `next`，因为它会执行 `collect --apply`；改用显式 `SOURCE=console-readonly` 的证据推导。
- 私有 GitHub contents API 返回带 token 参数的 download_url。对整段 JSON 直接用文本正则脱敏会吞掉闭合引号，导致 JSON.parse 失败并误报候选证据不可用。先解析 JSON、逐字符串脱敏、重新序列化，并加入合成 token 回归测试。
- GitHub Label 大小写不敏感：默认 `bug` 与 `Bug` 冲突会返回 422。隔离验收脚本按大小写不敏感查找后显式重命名；不能盲目重复创建。
- 网络曾使 gh 登录检查失败，但随后 `gh api user` 和 doctor 21 项检查成功。不要将一次连接失败认定为永久凭证失效，也不要读取/打印 token。
- 实测 review collect 在 60 秒时已回填部分标签但尚未完成批改清单；退出 124 不代表回滚。改为修改动作 180 秒有界超时并明确风险；检查远程已发生效果后手工重试，成功退出 0。批次开始也实连成功；所有写入仅发生于独立验收仓库。
- 较新的人工批准/撤销必须优先于陈旧标签；P0/P1 中 NOT PASSED/尚未通过不得按包含 PASS/通过判成功；跨批次已关闭依赖不得继续显示阻塞。新增状态机回归覆盖。
- 删除项目清理日报和命令记录，但保留最小 CRUD 审计；SQLite 外键须显式启用。配置保存不等待慢 GitHub 读取结束；保存后异步刷新仍按项目和请求版本隔离。
- UI audit 发现数字角标 background 与前景共用 currentColor 使数字不可见；主按钮文字对比度仅 3.84。改独立角标背景并降低主按钮亮度。手机离屏菜单必须 inert，不能仅 transform 藏到屏外。
- 新测试第一次使用全页“关闭”查询，因 JSDOM 不处理 CSS/inert 而匹配隐藏菜单和弹窗两项。改为 within(dialog)，实际浏览器确认 Tab/Escape/焦点恢复正常。
- 两次新增脚本/Effect 引发 lint 失败（fetch global 声明、cleanup 读取可变 ref），已修复并重跑。验证命令要分别确认退出码，不能因最后一个 build 成功掩盖之前测试失败。
- Chrome 审计工具拒绝工作区报告路径时，使用其默认临时报告位置；不绕过访问限制。audit 引用的 frontend-design 技能在当前技能表中缺失，界面依据本项目 PRODUCT/DESIGN 和用户视觉稿检查。

## 2026-09-05 — Review: green baseline tests are not MVP acceptance

- Full findings and reproduction steps: [REVIEW-2026-09-05.md](REVIEW-2026-09-05.md).
- Confirmed: optional secret references serialized as empty strings cause project-create HTTP 400; inherited action keys bypass confirmation; plaintext webhook targets round-trip; Factory status does not pass configured secrets to redaction; task counts misclassify review/testing/rework/release states.
- The real Factory `next` implementation can call `collect --apply` in clean batch mode. Do not invoke this in a default read-only status/preview/scheduler path. This was checked statically; no real mutation was triggered during review.
- Two additional regression tests currently fail: stale project A responses replace selected project B status; saving the current project clears status without reloading. They remain in `.codex/review/state.test.tsx` and are run through the dedicated config, not the existing default test glob.
- Browser confirms create failure, post-save loading, untranslated generated reports, clipped mobile pipeline legend, and incomplete dialog keyboard behavior.
- Product fixes have not been implemented in this review turn. Do not claim safe production readiness from the existing 18 passing tests.
- Review fixture scripts initially needed explicit Node imports to meet the repository ESLint configuration; corrected within review-only files and lint re-run successfully.

## 2026-09-05 — Express 5 catch-all route syntax

- Symptom: the production server crashed at startup with `Missing parameter name at index 1: *`.
- Cause: Express 5's route parser no longer accepts the Express 4 style `app.get('*', ...)` SPA fallback.
- Resolution: use a regular-expression fallback that explicitly excludes `/api` routes.
- Prevention: production-start smoke testing is required after `npm run build`; API-only tests do not load the static client branch.

## 2026-09-05 — CLI child-process trees can outlive direct timeouts

- Symptom: a Factory status read stayed in the loading state while an internal GitHub request was unreachable.
- Cause: terminating the direct Bash process does not guarantee that inherited child-process pipes close immediately on Windows.
- Resolution: each external adapter now has an overall response deadline, and concurrent status requests for one project share a single in-flight promise with a short cache.
- Prevention: unavailable external tools must degrade within a bounded first-paint budget even when their process tree is slow to release.
