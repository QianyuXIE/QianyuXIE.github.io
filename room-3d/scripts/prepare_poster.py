"""Prepare the official poster as a bounded WebGL texture, without cropping.

blender --background --python room-3d/scripts/prepare_poster.py -- <source.jpg>
"""
import sys
from pathlib import Path
import bpy

source = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
target = Path(__file__).resolve().parents[2] / 'assets/room3d/textures/chungking-express.jpg'
image = bpy.data.images.load(str(source))
ratio = min(1, 1200 / max(image.size))
image.scale(round(image.size[0] * ratio), round(image.size[1] * ratio))
image.filepath_raw = str(target)
image.file_format = 'JPEG'
image.save()
print('Poster texture:', tuple(image.size), target)
