# 本地 OCR 与图像改字 使用规范

> 适用：需要读取/识别图片、截图、扫描件中的文字，或改图中文字并导回 PNG/JSON/PPTX、批量 OCR 的任务。
> 基础：本机已部署本地 OCR（PaddleOCR 3.7.0）与图像改字流水线，载体为 `gavin-sparkols/photo-editing`，不依赖独立 `light-ocr` 包。

## 0. 触发条件

出现以下任一情况时，直接调用本机 OCR，不再引入额外浏览器驱动：

- 需要从图片 / 截图 / 扫描件中读出文字（OCR）。
- 需要**改图中文字**（识别→去字 inpaint→重排→导出）。
- 需要批量 OCR 多个图片文件。
- 需要将结果导回 PNG / JSON / PPTX。

## 1. 调用方式

```bash
cd D:\研究\gavin-sparkols\photo-editing
pip install -r requirements.txt
python editor_server.py
```

启动后服务监听 `http://127.0.0.1:7777`。

- 端点：`POST /api/ocr`（OCR 识别）；`POST /api/export_pptx`（导出 PPTX）。
- 流水线：OCR → 去字（inpaint）→ 重排 → 导出 PNG/JSON/PPTX。
- 依赖：`paddleocr, flask, opencv-python, pillow, python-pptx`。
- 离线可用；首次运行需下载 PaddleOCR 模型（离线要预置模型目录）。

## 2. 本机 OCR 替代 Playwright

**涉及图片/截图/扫描件文字读取与图像改字时，不再用 Playwright 驱动浏览器。**

Playwright 仅保留给真正需要浏览器交互 / 渲染 / 点击的场合（如页面抓取、前端操作）。

> 教训（2026-11-12）：本机 OCR 载体是 `gavin-sparkols/photo-editing`，不是独立 `light-ocr` 包——查找时不要按 `light-ocr` 路径找。

## 3. 部署状态

- 本机已装：`paddleocr` 3.7.0（`pip show paddleocr` 验证）。
- 载体目录：`D:/研究/gavin-sparkols/photo-editing/`（含 `ocr_for_web.py`、`text_inpaint.py`、`pptx_export.py`、`editor_server.py`）。
- `import light_ocr` → `ModuleNotFoundError`，确认无独立包。
