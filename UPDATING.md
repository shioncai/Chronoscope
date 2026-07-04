# Chronoscope 便携桌面版 · 更新手册

本应用打包为 **Windows 绿色便携文件夹**：`Chronoscope-<版本>-win.zip` 解压后得到一个 `Chronoscope\` 文件夹，`Chronoscope.exe` 旁的 `data\` 保存**全部数据**（IndexedDB 等），首次运行时自动生成。更新的核心原则只有一句：

> **`data\` 是你的数据，更新时永远不要覆盖它。**

---

## 0. 构建环境准备（开发机 / WSL2 Debian，一次性）

1. `npm install`（会拉入 `electron`、`electron-builder`，以及图标/打包用的 `sharp`、`png-to-ico`）。
2. 确保系统有 `7z`（打包脚本用它把应用压成便携 zip）：
   ```bash
   7z --help >/dev/null 2>&1 || sudo apt install -y p7zip-full
   ```
3.（仅当 `public/favicon.svg` 改动时才需）重新生成应用图标：
   ```bash
   node scripts/make-icon.mjs
   ```

> 说明：**不需要 wine**。electron-builder 会以原生方式把图标嵌入 `Chronoscope.exe`。

---

## A. 发布一个新版本（改完代码之后）

1. **过质量门**：
   ```bash
   npm run build   # tsc 类型检查 + 构建
   npm test
   npm run lint
   ```
   `build`、`test` 须全绿。（`lint` 目前有 2 个与打包无关的既有告警，见文末「已知事项」。）
2. **功能自查**：`npm run dev`（浏览器）或 `npm run electron:preview`（真实桌面外壳）验证本次改动。
3. **升版本号**：编辑 `package.json` 的 `version`（如 `0.1.0` → `0.2.0`）。该号决定产物文件名。
4. **出便携包**：
   ```bash
   npm run electron:build
   ```
   （内部依次：`ELECTRON=1 vite build` → `electron-builder --win`（dir）→ `scripts/pack-portable.mjs` 压成 zip。）
5. **取产物**：`release/Chronoscope-<新版本>-win.zip`（解压即得 `Chronoscope\` 文件夹）。

---

## B. 更新你正在使用的便携应用（数据无损）

### 方式一 · 全新文件夹（推荐，最稳、天然可回滚）

1. 关闭正在运行的 Chronoscope。
2. 把新的 `Chronoscope-<新版本>-win.zip` 解压到一个**新位置**，得到新的 `Chronoscope\` 文件夹。
3. 把**旧 `Chronoscope\` 里的 `data\` 整个复制**进新文件夹（覆盖新包里可能自带的空 `data\`）。
4. 双击新文件夹里的 `Chronoscope.exe` → 数据原样还在。
5. 确认无误后再删除旧文件夹（旧文件夹即回滚点）。

### 方式二 · 原地替换

1. 关闭应用。
2. 先把当前 `Chronoscope\` 里的 `data\` 复制一份到别处备份。
3. 解压新包，用新 `Chronoscope\` 里**除 `data\` 以外**的所有文件覆盖旧文件夹（**切勿覆盖/删除 `data\`**）。
4. 启动应用。

### 额外保险（与打包无关）

应用内置 JSON 导出功能。重大更新前，先在应用里导出一份 JSON 存好；万一异常，用导入功能恢复。

---

## C. 回滚

保留上一版 zip 与旧文件夹即可。出问题时：关闭新版 → 回到旧文件夹运行（其 `data\` 内即你的数据，或把 `data\` 拷回旧文件夹）→ 恢复正常。

---

## 注意事项

- 便携文件夹须放在**可写**位置（桌面 / 文档 / U 盘 / 任意用户目录）。放进 `C:\Program Files\` 等只读位置会导致写数据失败。
- 数据库结构升级（Dexie schema 变更）由应用自身在启动时迁移；便携更新只需保留 `data\`。
- **已知事项**：`npm run lint` 现有 2 处 `react-hooks/refs` 告警（`src/ui/shell/useFocusTrap.ts`、`src/ui/timeline/TimelineView.tsx`），属打包工作之前就存在的既有情况，与桌面打包无关。
