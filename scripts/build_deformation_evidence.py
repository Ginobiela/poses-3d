"""Build faithful contact sheets from the Playwright deformation audit, outside production."""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def build(source: Path, output: Path):
    audit = json.loads((source / 'audit-metrics.json').read_text(encoding='utf-8'))
    entries, samples = audit['entries'], audit['samples']
    if len(entries) != 20 or len(samples) != 80 or len({entry['id'] for entry in entries}) != 20:
        raise ValueError('Expected 20 poses and 80 pose/preset samples')
    if audit['modelRequests'] != 1 or audit['poseRequests'] != 20 or audit['errors']:
        raise ValueError('Audit requests or console checks failed')
    for entry in entries:
        records = [sample for sample in samples if sample['id'] == entry['id']]
        if {record['preset'] for record in records} != {'neutral', 'lean', 'athletic', 'muscular'}:
            raise ValueError(f'Missing body variant for {entry["id"]}')
    if any(not s['finite'] or not s['validBones'] or s['vertices'] != 15066 or s['bones'] != 52 for s in samples):
        raise ValueError('Invalid skinning sample')
    if audit['modelSha256'] != hashlib.sha256(Path('public/models/human/human.glb').read_bytes()).hexdigest():
        raise ValueError('Model changed after capture; rerun Playwright')
    for entry in entries:
        pose_bytes = (Path('public/poses') / entry['file']).read_bytes().replace(b'\r\n', b'\n')
        actual = hashlib.sha256(pose_bytes).hexdigest()
        if audit['poseSha256'][entry['id']] != actual:
            raise ValueError(f'Pose {entry["id"]} changed after capture; rerun Playwright')
    output.mkdir(parents=True, exist_ok=True)
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 18)
    small = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 15)
    views = [('front', 'Frente'), ('left', 'Perfil izquierdo'), ('right', 'Perfil derecho'), ('back', 'Espalda')]
    presets = [('neutral', 'Neutral'), ('lean', 'Delgado'), ('athletic', 'Atlético'), ('muscular', 'Musculoso')]
    for group in range(4):
        subset = entries[group * 5:group * 5 + 5]
        for kind in ['views', 'bodies']:
            sheet = Image.new('RGB', (1320, 1830), '#f7f5f0')
            draw = ImageDraw.Draw(sheet)
            for row, entry in enumerate(subset):
                for col, (variant, label) in enumerate(views if kind == 'views' else presets):
                    filename = f'{entry["id"]}-neutral-{variant}.png' if kind == 'views' else f'{entry["id"]}-{variant}-front.png'
                    with Image.open(source / filename) as image:
                        image = image.convert('RGB').resize((330, 330), Image.Resampling.LANCZOS)
                        sheet.paste(image, (col * 330, row * 366 + 36))
                    draw.text((col * 330 + 7, row * 366 + 2), f'{entry["id"]} — {entry["name"]}', font=font, fill='#202020')
                    draw.text((col * 330 + 7, row * 366 + 21), label, font=small, fill='#555555')
            sheet.save(output / f'{kind}-{group + 1}.webp', quality=85, method=6)
    mobile = Image.new('RGB', (1170, 1758), '#f7f5f0')
    draw = ImageDraw.Draw(mobile)
    for index, pose_id in enumerate(['02', '07', '12', '15', '20']):
        row, col = divmod(index, 3)
        with Image.open(source / f'{pose_id}-mobile.png') as image:
            mobile.paste(image.convert('RGB'), (col * 390, row * 879 + 35))
        name = next(entry['name'] for entry in entries if entry['id'] == pose_id)
        draw.text((col * 390 + 8, row * 879 + 8), f'{pose_id} — {name} / Atlético', font=font, fill='#202020')
    mobile.save(output / 'mobile.webp', quality=85, method=6)
    details = ['02-neutral-left', '07-neutral-front', '12-neutral-no-prop-left',
               '13-neutral-no-prop-left', '18-neutral-front', '19-neutral-back', '20-neutral-right']
    for detail in details:
        with Image.open(source / f'{detail}.png') as image:
            image.convert('RGB').save(output / f'detail-{detail}.webp', quality=90, method=6)
    metrics = {
        'modelSha256': audit['modelSha256'], 'poseSha256': audit['poseSha256'],
        'modelRequests': audit['modelRequests'], 'poseRequests': audit['poseRequests'], 'errors': audit['errors'],
        'entries': entries,
        'samples': [{key: value for key, value in sample.items() if key not in ['root', 'meshes']} for sample in samples],
        'angles': 'Degrees of bend from world-space segment endpoints; straight = 0. Not local Euler rotations or volume measurements.',
    }
    (output / 'metrics.json').write_text(json.dumps(metrics, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Built 8 desktop sheets, 1 mobile sheet, 7 details and 80 measurements in {output}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path, nargs='?', default=Path('docs/audit/deformation'))
    args = parser.parse_args()
    build(args.source, args.output)
