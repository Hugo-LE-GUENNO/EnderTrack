# server/ome_metadata.py — Parse TIFF metadata (ImageJ, OME-TIFF)
"""
Reads dimension info from multi-page TIFF files.
Supports ImageJ format (tag 270) and OME-TIFF XML.
Compatible with Fiji, Napari, and EnderTrack.
"""

import os
import re
from flask import request, jsonify


def parse_imagej_description(desc):
    """Parse ImageJ-style ImageDescription string."""
    info = {}
    for line in desc.split('\n'):
        line = line.strip()
        if '=' in line:
            key, val = line.split('=', 1)
            info[key.strip()] = val.strip()
    return info


def get_tiff_dimensions(filepath):
    """Extract dimension info from a TIFF file."""
    from PIL import Image
    img = Image.open(filepath)

    # Count pages
    n_pages = 0
    try:
        while True:
            n_pages += 1
            img.seek(n_pages)
    except EOFError:
        pass
    img.seek(0)

    width, height = img.size
    mode = img.mode

    # Parse ImageDescription
    desc = ''
    if hasattr(img, 'tag_v2') and 270 in img.tag_v2:
        desc = img.tag_v2[270]
    elif hasattr(img, 'tag') and 270 in img.tag:
        desc = img.tag[270]
        if isinstance(desc, tuple):
            desc = desc[0]

    dims = {
        'width': width,
        'height': height,
        'pages': n_pages,
        'sizeX': width,
        'sizeY': height,
        'sizeZ': 1,
        'sizeC': 1,
        'sizeT': 1,
        'channels': [],
        'pixelSize': None,
        'unit': 'pixel',
        'bitDepth': 8,
        'dimensionOrder': 'XYCZT',
        'source': 'unknown'
    }

    # Detect bit depth
    if mode in ('I;16', 'I;16B', 'I;16L'):
        dims['bitDepth'] = 16
    elif hasattr(img, 'tag_v2') and 258 in img.tag_v2:
        bps = img.tag_v2[258]
        if isinstance(bps, tuple):
            dims['bitDepth'] = bps[0]
        else:
            dims['bitDepth'] = bps

    # Parse pixel size from resolution tags
    if hasattr(img, 'tag_v2'):
        if 282 in img.tag_v2 and 283 in img.tag_v2:
            xres = img.tag_v2[282]
            yres = img.tag_v2[283]
            if xres and xres > 0:
                dims['pixelSize'] = 1.0 / xres  # in unit specified by tag 296

    # Try ImageJ format
    if desc and 'ImageJ' in desc:
        dims['source'] = 'imagej'
        ij = parse_imagej_description(desc)

        if 'channels' in ij:
            dims['sizeC'] = int(ij['channels'])
        if 'slices' in ij:
            dims['sizeZ'] = int(ij['slices'])
        if 'frames' in ij:
            dims['sizeT'] = int(ij['frames'])
        if 'unit' in ij:
            dims['unit'] = ij['unit']
        if 'min' in ij:
            dims['dataMin'] = float(ij['min'])
        if 'max' in ij:
            dims['dataMax'] = float(ij['max'])
        if 'mode' in ij:
            dims['mode'] = ij['mode']
        if 'finterval' in ij:
            dims['frameInterval'] = float(ij['finterval'])
        if 'spacing' in ij:
            dims['voxelDepth'] = float(ij['spacing'])

        # Deduce dimension order
        c, z, t = dims['sizeC'], dims['sizeZ'], dims['sizeT']
        if c * z * t == n_pages:
            dims['dimensionOrder'] = 'XYCZT'
        elif c > 1 and z == 1 and t == 1:
            dims['dimensionOrder'] = 'XYC'

    # Try OME-TIFF (XML in ImageDescription)
    elif desc and '<?xml' in desc and 'OME' in desc:
        dims['source'] = 'ome'
        # Parse basic OME dimensions
        size_x = re.search(r'SizeX="(\d+)"', desc)
        size_y = re.search(r'SizeY="(\d+)"', desc)
        size_z = re.search(r'SizeZ="(\d+)"', desc)
        size_c = re.search(r'SizeC="(\d+)"', desc)
        size_t = re.search(r'SizeT="(\d+)"', desc)
        order = re.search(r'DimensionOrder="(\w+)"', desc)

        if size_x: dims['sizeX'] = int(size_x.group(1))
        if size_y: dims['sizeY'] = int(size_y.group(1))
        if size_z: dims['sizeZ'] = int(size_z.group(1))
        if size_c: dims['sizeC'] = int(size_c.group(1))
        if size_t: dims['sizeT'] = int(size_t.group(1))
        if order: dims['dimensionOrder'] = order.group(1)

        # Parse channel names
        for m in re.finditer(r'<Channel[^>]*Name="([^"]*)"', desc):
            dims['channels'].append({'name': m.group(1)})

    # Fallback: if no metadata, assume pages = channels or Z
    else:
        if n_pages <= 4:
            dims['sizeC'] = n_pages
            dims['dimensionOrder'] = 'XYC'
        else:
            dims['sizeZ'] = n_pages
            dims['dimensionOrder'] = 'XYZ'

    return dims


def register_routes(app):
    """Register metadata API routes."""

    @app.route('/api/stack/dimensions', methods=['GET'])
    def _stack_dimensions():
        """Get full dimension info for a TIFF file."""
        filepath = request.args.get('file', '')
        if not filepath:
            return jsonify({'error': 'No file specified'}), 400

        full = os.path.join(os.getcwd(), filepath)
        if not os.path.isfile(full):
            return jsonify({'error': 'File not found'}), 404

        try:
            dims = get_tiff_dimensions(full)
            return jsonify(dims)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
