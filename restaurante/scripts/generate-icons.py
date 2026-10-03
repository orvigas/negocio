#!/usr/bin/env python3
"""
Genera los favicons e iconos de pantalla de inicio de cada negocio (REQ-F-002).

Herramienta de desarrollo, no de ejecución: el servidor solo sirve los archivos que este
script deja en public/img/<negocio>/icons/, que se versionan en el repositorio.

Requisitos: Python 3 y Pillow (pip install Pillow).

Uso (desde restaurante/):
    python3 scripts/generate-icons.py [--preview-dir DIR]

Tras regenerar los iconos de un negocio, incrementa `icons.version` en
src/content/<negocio>/index.js para que los navegadores no usen los de la caché HTTP.
"""

import argparse
import tempfile
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT.parent / "_stich_source_"

# Fuente de alta resolución, recorte de la mascota (x0, y0, x1, y1 en píxeles de la fuente)
# y color de fondo de la landing (debe coincidir con `icons.themeColor` del contenido).
BUSINESSES = {
    "molotes": {
        "source": SOURCE_DIR / "logo_molotes.png" / "screen.png",
        "mascot": (480, 300, 900, 720),  # molote con pañoleta
        "background": "#03132b",
    },
    "birria": {
        "source": SOURCE_DIR / "logo_birria.png" / "screen.png",
        "mascot": (390, 340, 820, 770),  # cabeza del toro
        "background": "#290808",
    },
}

SMALL_SIZES = (16, 32, 48)
APPLE_SIZE = 180
APPLE_LOGO_HEIGHT = 162  # margen del 5 % por lado para el redondeo de iOS
MASKABLE_SIZE = 512
SAFE_ZONE_RATIO = 0.8  # círculo central del 80 % (diámetro)
SUPERSAMPLE = 4


def hex_rgb(value):
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def trim(image):
    """Recorta el logo a su contorno no transparente (alfa > 0)."""
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise SystemExit("El logo fuente es completamente transparente")
    return image.crop(bbox)


def fit(image, width, height):
    """Escala sin deformar para caber en width x height."""
    ratio = min(width / image.width, height / image.height)
    size = (max(1, round(image.width * ratio)), max(1, round(image.height * ratio)))
    return image.resize(size, Image.LANCZOS)


def centered(canvas, image):
    canvas.alpha_composite(image, ((canvas.width - image.width) // 2, (canvas.height - image.height) // 2))
    return canvas


def mascot_icon(source, box, background):
    """Mascota recortada en círculo sobre el color del negocio, a resolución de trabajo."""
    work = SMALL_SIZES[-1] * SUPERSAMPLE * 2
    crop = source.crop(box).resize((work, work), Image.LANCZOS)
    mask = Image.new("L", (work, work), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, work - 1, work - 1), fill=255)
    canvas = Image.new("RGBA", (work, work), hex_rgb(background) + (255,))
    canvas.paste(crop, (0, 0), ImageChops.multiply(mask, crop.getchannel("A")))
    return canvas


def opaque(image):
    """Devuelve RGB (sin canal alfa) tras comprobar que no quedan píxeles transparentes."""
    if image.mode == "RGBA" and image.getchannel("A").getextrema()[0] < 255:
        raise SystemExit("Un icono opaco tiene píxeles transparentes")
    return image.convert("RGB")


def outside_safe_zone(alpha, size):
    """True si algún píxel con alfa > 0 queda fuera del círculo central del 80 %."""
    radius = size * SAFE_ZONE_RATIO / 2
    center = size / 2
    circle = Image.new("L", (size, size), 0)
    ImageDraw.Draw(circle).ellipse(
        (center - radius, center - radius, center + radius, center + radius), fill=255
    )
    outside = ImageChops.multiply(alpha, ImageChops.invert(circle))
    return outside.getbbox() is not None


def maskable_icon(logo, background):
    """Logo lo más grande posible con todos sus píxeles visibles dentro de la zona segura."""
    size = MASKABLE_SIZE
    low, high = 0.0, size / max(logo.width, logo.height)
    best = None
    for _ in range(20):
        scale = (low + high) / 2
        scaled = logo.resize((max(1, round(logo.width * scale)), max(1, round(logo.height * scale))), Image.LANCZOS)
        layer = centered(Image.new("RGBA", (size, size), (0, 0, 0, 0)), scaled)
        if outside_safe_zone(layer.getchannel("A"), size):
            high = scale
        else:
            low, best = scale, layer
    if best is None:
        raise SystemExit("No se encontró una escala que quepa en la zona segura")
    if outside_safe_zone(best.getchannel("A"), size):
        raise SystemExit("El logo maskable sale de la zona segura")
    canvas = Image.new("RGBA", (size, size), hex_rgb(background) + (255,))
    canvas.alpha_composite(best)
    return opaque(canvas)


def save_large(image, path):
    """PNG con paleta de 256 colores (con difuminado): unas 4 veces más ligero y sin pérdida visible.
    Si la imagen es opaca (RGB) la paleta no lleva transparencia."""
    image.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG).save(path, optimize=True)


def contact_sheet(name, files, background, preview_dir):
    """Todos los tamaños a 1x y ampliados 4x sin suavizado (solo para revisión visual)."""
    images = [(label, Image.open(path).convert("RGBA")) for label, path in files]
    gap = 24
    small = [(label, img) for label, img in images if img.width <= 48]
    large = [(label, img) for label, img in images if img.width > 48]
    width = gap + sum(img.width * 5 + gap for _, img in small)
    width = max(width, gap + sum(img.width + gap for _, img in large))
    height = gap * 3 + 48 * 4 + 512
    sheet = Image.new("RGBA", (width, height), (230, 230, 230, 255))
    x = gap
    for _, img in small:
        sheet.alpha_composite(img, (x, gap))
        zoom = img.resize((img.width * 4, img.height * 4), Image.NEAREST)
        sheet.alpha_composite(zoom, (x + img.width + 4, gap))
        x += img.width * 5 + gap
    x = gap
    for _, img in large:
        sheet.alpha_composite(img, (x, gap * 2 + 48 * 4))
        x += img.width + gap
    path = preview_dir / f"icons-preview-{name}.png"
    sheet.save(path)
    return path


def generate(name, spec, preview_dir):
    out_dir = ROOT / "public" / "img" / name / "icons"
    out_dir.mkdir(parents=True, exist_ok=True)
    background = spec["background"]
    source = Image.open(spec["source"]).convert("RGBA")
    logo = trim(source)

    # Tamaños pequeños: mascota en círculo sobre el color del negocio (opacos).
    mascot = mascot_icon(source, spec["mascot"], background)
    small = {size: opaque(mascot.resize((size, size), Image.LANCZOS)) for size in SMALL_SIZES}
    small[48].save(out_dir / "favicon.ico", format="ICO", sizes=[(s, s) for s in SMALL_SIZES],
                   append_images=[small[16], small[32]])
    small[16].save(out_dir / "icon-16.png", optimize=True)
    small[32].save(out_dir / "icon-32.png", optimize=True)

    # apple-touch-icon: logo completo, opaco, sobre el color del negocio.
    apple = Image.new("RGBA", (APPLE_SIZE, APPLE_SIZE), hex_rgb(background) + (255,))
    save_large(opaque(centered(apple, fit(logo, APPLE_LOGO_HEIGHT, APPLE_LOGO_HEIGHT))), out_dir / "apple-touch-icon.png")

    # 192 y 512 ("any"): logo completo sobre fondo transparente.
    for size in (192, 512):
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        save_large(centered(canvas, fit(logo, size, size)), out_dir / f"icon-{size}.png")

    # Maskable: opaco, logo dentro del círculo central del 80 %.
    save_large(maskable_icon(logo, background), out_dir / "icon-maskable-512.png")

    files = [
        ("16", out_dir / "icon-16.png"),
        ("32", out_dir / "icon-32.png"),
        ("48", None),
        ("180", out_dir / "apple-touch-icon.png"),
        ("192", out_dir / "icon-192.png"),
        ("512", out_dir / "icon-512.png"),
        ("maskable", out_dir / "icon-maskable-512.png"),
    ]
    preview_48 = preview_dir / f"icon-48-{name}.png"
    small[48].save(preview_48)
    files[2] = ("48", preview_48)
    return contact_sheet(name, files, background, preview_dir)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--preview-dir", type=Path, default=Path(tempfile.gettempdir()),
                        help="Carpeta (fuera del repo) para las hojas de contacto de revisión visual")
    args = parser.parse_args()
    args.preview_dir.mkdir(parents=True, exist_ok=True)
    for name, spec in BUSINESSES.items():
        sheet = generate(name, spec, args.preview_dir)
        print(f"{name}: iconos en public/img/{name}/icons/ · hoja de contacto: {sheet}")


if __name__ == "__main__":
    main()
