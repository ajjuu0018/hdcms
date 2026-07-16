from pathlib import Path
import zipfile

p = Path('tmp-pip-metadata/grpcio_status-1.75.1-py3-none-any.whl')
print('wheel exists:', p.exists())
if not p.exists():
    raise FileNotFoundError(p)
with zipfile.ZipFile(p) as z:
    metadata_files = [n for n in z.namelist() if n.endswith('METADATA')]
    print('metadata files:', metadata_files)
    if not metadata_files:
        raise RuntimeError('no METADATA file found')
    data = z.read(metadata_files[0]).decode('utf-8')
    for line in data.splitlines():
        if line.startswith('Requires-Dist: grpcio') or line.startswith('Requires-Dist: protobuf'):
            print(line)
    print('--- full metadata ---')
    print(data)
