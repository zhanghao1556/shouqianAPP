# 产品知识库

本目录只保存可审阅、可提交的精简产品事实和源文件哈希。全文、图片、转换文件及每次增量提取结果继续保存在 Git 忽略的 `work/product-doc-audit`。

## 使用顺序

1. 先读本目录的确认事实、冲突和用户决策。
2. 运行 `npm run audit:product-docs` 对比 `docx_2` 与 `source-manifest.json`。
3. 只处理 `work/product-doc-audit/incremental/changed-files.json` 中的新增、哈希变化或待提取文件。
4. 完成单个文件提取后，用 `node scripts/audit-product-docs.mjs --mark-extracted "相对路径"` 更新提取哈希。
5. 将稳定事实写回本目录；不要把全文或大图提交到 Git。

## 来源优先级

`用户确认口径 > 正式规格书与安装手册 > 产品白皮书 > 解决方案 > 营销文案`。

客户可见软件只使用通用产品名称。具体型号只允许出现在内部知识库、资料审计、代码内部 ID、日志和验证黑名单中。

## 专项审计

- `interface-wiring-audit.md`：音曼接口接线证据、用户确认覆盖、冲突记录及待用户手工补充字段。
