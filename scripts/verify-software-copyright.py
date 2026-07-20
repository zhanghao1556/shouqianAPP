from __future__ import annotations

import json
import re
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageStat
from docx import Document
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "software-copyright"
QA = OUT / "qa"

FORBIDDEN = [
    "音翼",
    "音曼",
    "翼欧",
    "张灏",
    "周大",
    "Yinyi",
    "Yinman",
    "Yiou",
    "zhanghao",
    "yinkman",
]

PDF_FILES = {
    "basic": OUT / "01-软著基本信息与提交清单.pdf",
    "manual": OUT / "02-智能音频售前工程方案设计软件V2.0-软件说明书.pdf",
    "code_front": OUT / "03-源代码文档-前60页.pdf",
    "code_back": OUT / "04-源代码文档-后60页.pdf",
}

DOCX_FILES = {
    "basic": OUT / "01-软著基本信息与提交清单.docx",
    "manual": OUT / "02-智能音频售前工程方案设计软件V2.0-软件说明书.docx",
    "code_front": OUT / "03-源代码文档-前60页.docx",
    "code_back": OUT / "04-源代码文档-后60页.docx",
}

PNG_DIRS = {
    "basic": QA / "pdf-basic-v2",
    "manual": QA / "pdf-manual-v2",
    "code_front": QA / "pdf-code-front",
    "code_back": QA / "pdf-code-back",
}


def numeric_page(path: Path) -> int:
    match = re.search(r"(\d+)$", path.stem)
    return int(match.group(1)) if match else 0


def rendered_pages(directory: Path) -> list[Path]:
    return sorted(directory.glob("page-*.png"), key=numeric_page)


def scan_forbidden(text: str, label: str):
    hits = [marker for marker in FORBIDDEN if marker.lower() in text.lower()]
    if hits:
        raise RuntimeError(f"Forbidden visible markers in {label}: {hits}")


def verify_pdf(name: str, path: Path) -> dict:
    if not path.exists() or path.stat().st_size < 1000:
        raise RuntimeError(f"Missing or empty PDF: {path}")
    reader = PdfReader(path)
    page_texts = [(page.extract_text() or "") for page in reader.pages]
    scan_forbidden("\n".join(page_texts), path.name)

    result = {
        "pages": len(reader.pages),
        "bytes": path.stat().st_size,
        "textCharacters": sum(len(text) for text in page_texts),
    }

    if name in {"code_front", "code_back"}:
        if len(reader.pages) != 60:
            raise RuntimeError(f"{path.name} has {len(reader.pages)} pages, expected 60")
        counts = []
        for page_number, text in enumerate(page_texts, 1):
            code_lines = [line for line in text.splitlines() if re.match(r"^\d{6}\s*\|", line.strip())]
            counts.append(len(code_lines))
            if len(code_lines) != 50:
                raise RuntimeError(f"{path.name} page {page_number} has {len(code_lines)} code lines")
        result["codeLinesPerPage"] = counts
        result["totalCodeLines"] = sum(counts)
        if name == "code_back" and "源程序代码结束" not in page_texts[-1]:
            raise RuntimeError("Back source PDF is missing the final ending phrase")
    return result


def verify_docx_code(path: Path) -> dict:
    document = Document(path)
    pages = []
    for paragraph in document.paragraphs:
        if " | " not in paragraph.text:
            continue
        lines = paragraph.text.splitlines()
        pages.append(lines)
    if len(pages) != 60:
        raise RuntimeError(f"{path.name} contains {len(pages)} code blocks instead of 60")
    bad = [index for index, lines in enumerate(pages, 1) if len(lines) != 50]
    if bad:
        raise RuntimeError(f"{path.name} has non-50-line pages: {bad}")
    if "后60页" in path.name and not pages[-1][-1].endswith("源程序代码结束"):
        raise RuntimeError("Back source DOCX is missing the final ending phrase")
    text = "\n".join("\n".join(page) for page in pages)
    scan_forbidden(text, path.name)
    return {"pages": len(pages), "linesPerPage": 50, "totalCodeLines": 3000}


def verify_rendered_images(name: str, expected_pages: int) -> dict:
    paths = rendered_pages(PNG_DIRS[name])
    if len(paths) != expected_pages:
        raise RuntimeError(f"{name} has {len(paths)} rendered images, expected {expected_pages}")
    sizes = []
    mean_values = []
    edge_ink_pages = []
    for index, path in enumerate(paths, 1):
        with Image.open(path) as image:
            rgb = image.convert("RGB")
            sizes.append(rgb.size)
            mean = sum(ImageStat.Stat(rgb).mean) / 3
            mean_values.append(round(mean, 2))
            if mean > 254.8:
                raise RuntimeError(f"Rendered page appears blank: {path}")
            gray = rgb.convert("L")
            width, height = gray.size
            edge = Image.new("L", (width, 10 + 10 + height + height), color=255)
            edge.paste(gray.crop((0, 0, width, 5)), (0, 0))
            edge.paste(gray.crop((0, height - 5, width, height)), (0, 5))
            edge.paste(gray.crop((0, 0, 5, height)).resize((height, 5)), (0, 10))
            edge.paste(gray.crop((width - 5, 0, width, height)).resize((height, 5)), (0, 15))
            if ImageStat.Stat(edge).extrema[0][0] < 80:
                edge_ink_pages.append(index)
    if edge_ink_pages:
        raise RuntimeError(f"Possible clipped content at page edges for {name}: {edge_ink_pages}")
    return {
        "pages": len(paths),
        "uniqueSizes": sorted({f"{w}x{h}" for w, h in sizes}),
        "meanRange": [min(mean_values), max(mean_values)],
    }


def contact_font(size: int):
    for candidate in [
        Path(r"C:\Windows\Fonts\msyh.ttc"),
        Path(r"C:\Windows\Fonts\simhei.ttf"),
    ]:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def make_contact_sheet(name: str, columns: int, thumb_width: int):
    paths = rendered_pages(PNG_DIRS[name])
    font = contact_font(18)
    label_height = 28
    thumbs = []
    for page_number, path in enumerate(paths, 1):
        with Image.open(path) as image:
            rgb = image.convert("RGB")
            ratio = thumb_width / rgb.width
            thumb_height = max(1, int(rgb.height * ratio))
            thumb = rgb.resize((thumb_width, thumb_height), Image.Resampling.LANCZOS)
            tile = Image.new("RGB", (thumb_width + 2, thumb_height + label_height + 2), "white")
            tile.paste(thumb, (1, label_height + 1))
            draw = ImageDraw.Draw(tile)
            draw.rectangle((0, 0, tile.width - 1, tile.height - 1), outline=(185, 195, 205))
            draw.text((7, 4), f"第 {page_number} 页", fill=(42, 55, 72), font=font)
            thumbs.append(tile)

    tile_width = max(tile.width for tile in thumbs)
    tile_height = max(tile.height for tile in thumbs)
    rows = (len(thumbs) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * tile_width, rows * tile_height), (235, 239, 244))
    for index, tile in enumerate(thumbs):
        x = (index % columns) * tile_width
        y = (index // columns) * tile_height
        sheet.paste(tile, (x, y))
    target = QA / f"contact-{name}.png"
    sheet.save(target, "PNG", optimize=True)
    return target


def create_delivery_zip():
    files = [
        DOCX_FILES["basic"],
        PDF_FILES["basic"],
        DOCX_FILES["manual"],
        PDF_FILES["manual"],
        DOCX_FILES["code_front"],
        PDF_FILES["code_front"],
        DOCX_FILES["code_back"],
        PDF_FILES["code_back"],
        OUT / "README-提交前补充信息.txt",
    ]
    for path in files:
        if not path.exists():
            raise FileNotFoundError(path)
    zip_path = OUT / "智能音频售前工程方案设计软件V2.0-软著材料-20260720.zip"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in files:
            archive.write(path, arcname=path.name)
    with zipfile.ZipFile(zip_path) as archive:
        archive.testzip()
        if sorted(archive.namelist()) != sorted(path.name for path in files):
            raise RuntimeError("Delivery ZIP contents do not match the expected file list")
    return zip_path


def main():
    QA.mkdir(parents=True, exist_ok=True)
    report = {"pdf": {}, "docxCode": {}, "rendered": {}, "contacts": {}}
    for name, path in PDF_FILES.items():
        report["pdf"][name] = verify_pdf(name, path)
    report["docxCode"]["front"] = verify_docx_code(DOCX_FILES["code_front"])
    report["docxCode"]["back"] = verify_docx_code(DOCX_FILES["code_back"])
    for name in PDF_FILES:
        report["rendered"][name] = verify_rendered_images(name, report["pdf"][name]["pages"])

    report["contacts"]["basic"] = str(make_contact_sheet("basic", columns=2, thumb_width=360))
    report["contacts"]["manual"] = str(make_contact_sheet("manual", columns=4, thumb_width=220))
    report["contacts"]["code_front"] = str(make_contact_sheet("code_front", columns=6, thumb_width=220))
    report["contacts"]["code_back"] = str(make_contact_sheet("code_back", columns=6, thumb_width=220))

    zip_path = create_delivery_zip()
    report["deliveryZip"] = {"path": str(zip_path), "bytes": zip_path.stat().st_size}
    report_path = QA / "verification-report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
