"""Packages each plugin folder into a WordPress-uploadable zip.

Built with Python's zipfile rather than PowerShell's Compress-Archive so the
archive has what WordPress's unzip_file() expects on every host:

  * forward-slash separators
  * an explicit entry for every directory (PclZip, the fallback WordPress uses
    when PHP's ZipArchive is missing, relies on these)
  * a single top-level folder whose name matches the plugin folder

Run from the repo root:  python wordpress-plugin/build-zips.py
"""
import os
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
PLUGINS = ('minikki-home', 'minikki-gst', 'minikki-images')
SKIP_EXT = ('.zip',)
SKIP_NAMES = {'.DS_Store', 'Thumbs.db', '__MACOSX'}


def build(plugin):
    src = os.path.join(HERE, plugin)
    dest = os.path.join(HERE, plugin + '.zip')

    if os.path.exists(dest):
        os.remove(dest)

    written = []

    with zipfile.ZipFile(dest, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Top-level folder entry first — this is the name WordPress installs to.
        zf.writestr(zipfile.ZipInfo(plugin + '/'), '')

        for root, dirs, files in os.walk(src):
            dirs[:] = sorted(d for d in dirs if d not in SKIP_NAMES)
            rel_dir = os.path.relpath(root, src).replace('\\', '/')

            if rel_dir != '.':
                zf.writestr(zipfile.ZipInfo(plugin + '/' + rel_dir + '/'), '')

            for name in sorted(files):
                if name in SKIP_NAMES or name.lower().endswith(SKIP_EXT):
                    continue

                full = os.path.join(root, name)
                arc = plugin + '/' + ('' if rel_dir == '.' else rel_dir + '/') + name
                zf.write(full, arc)
                written.append(arc)

    return dest, written


for plugin in PLUGINS:
    dest, written = build(plugin)
    print('%s  (%d files)' % (os.path.basename(dest), len(written)))
    for arc in written:
        print('    ' + arc)
