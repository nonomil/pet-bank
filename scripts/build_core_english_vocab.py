import argparse
import json
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CANDIDATES = ROOT / 'prj' / 'vocab-governance' / 'reports' / 'core-800-candidates.json'
DEFAULT_DB = ROOT / 'data' / 'vocab' / 'core-english' / 'core-english.db'
DEFAULT_VIEW = ROOT / 'data' / 'vocab' / 'core-english' / 'views' / 'core.json'
DEFAULT_MANIFEST = ROOT / 'data' / 'vocab' / 'core-english' / 'manifest.json'
TRANSLATION_OVERRIDES = {
    'rectangle': '长方形', 'speak': '说话', 'square': '正方形', 'stand': '站立',
    'stem': '茎', 'teleport': '瞬间传送', 'an': '一个（用于元音音素开头的词前）',
    'on': '在……上；在……时', 'of': '……的', 'her': '她；她的', 'monster': '怪物',
}
CONTENT_OVERRIDES = {
    'calm': ('The calm lake reflects the blue sky.', '平静的湖面映照着蓝天。'),
    'cap': ('I put on my red cap.', '我戴上红色的帽子。'),
    'cup': ('I drink water from a cup.', '我用杯子喝水。'),
    'easy': ('This puzzle is easy for me.', '这个谜题对我来说很容易。'),
    'few': ('A few birds sit on the tree.', '几只鸟停在树上。'),
    'game': ('We play a fun game together.', '我们一起玩一个有趣的游戏。'),
    'girl': ('The girl reads a storybook.', '这个女孩在读故事书。'),
    'hat': ('The blue hat is on the chair.', '蓝色的帽子在椅子上。'),
    'mom': ('My mom helps me plant flowers.', '妈妈帮我种花。'),
    'new': ('I have a new schoolbag.', '我有一个新书包。'),
    'pet': ('My pet sleeps beside me.', '我的宠物睡在我身边。'),
}


def fallback_image_for(category):
    assets = '../../prj/单词记忆射击场原型/assets/generated/topdown-farm-assets'
    mapping = {
        'animals': 'enemy_chicken.png',
        'animal': 'enemy_chicken.png',
        'food': 'crate_wood.png',
        'nature': 'flower_patch_mixed.png',
        'plants': 'flower_patch_sun.png',
        'body': 'enemy_chick.png',
        'body_parts': 'enemy_chick.png',
        'actions': 'signpost_wood.png',
        'action': 'signpost_wood.png',
        'school': 'signpost_wood.png',
        'school_supplies': 'crate_wood.png',
        'toys': 'crate_wood.png',
    }
    return f"{assets}/{mapping.get(str(category or '').lower(), 'enemy_mouse.png')}"


def should_use_source_image(image_url):
    normalized = str(image_url or '').strip().lower()
    return normalized.startswith('https://twemoji.maxcdn.com/v/latest/svg/') and not normalized.endswith('/3d.svg')


def manifest_path_value(value):
    try:
        return str(value.relative_to(ROOT)).replace('\\', '/')
    except ValueError:
        return str(value)


def sentence_text(value, punctuation):
    text = str(value or '').strip()
    if text and text[-1:] not in '.!?。！？':
        text += punctuation
    return text


def replace_database(database_path, replacement_path):
    last_error = None
    for _ in range(8):
        try:
            replacement_path.replace(database_path)
            return
        except PermissionError as error:
            last_error = error
            time.sleep(0.25)
    raise RuntimeError(f'Could not replace locked database: {database_path}') from last_error


def build(candidates_path, database_path, view_path, manifest_path, pack_id='core-english', title='核心英语学习路径', level='core'):
    candidates = json.loads(candidates_path.read_text(encoding='utf-8')).get('candidates', [])
    database_path.parent.mkdir(parents=True, exist_ok=True)
    view_path.parent.mkdir(parents=True, exist_ok=True)
    previous_enrichment = {}
    if database_path.exists():
        with sqlite3.connect(database_path) as previous_connection:
            try:
                previous_enrichment = {
                    word: {'phonetic': phonetic or '', 'example': example or '', 'example_zh': example_zh or ''}
                    for word, phonetic, example, example_zh in previous_connection.execute(
                        'SELECT word, phonetic, example, example_zh FROM core_words'
                    )
                }
            except sqlite3.OperationalError:
                pass
    work_database = database_path if database_path.exists() else database_path.with_suffix(f'{database_path.suffix}.next')
    if work_database != database_path and work_database.exists():
        work_database.unlink()
    connection = sqlite3.connect(work_database)
    connection.executescript('''
        PRAGMA foreign_keys = ON;
        DROP TABLE IF EXISTS core_words;
        CREATE TABLE core_words (
            id INTEGER PRIMARY KEY,
            word TEXT NOT NULL UNIQUE,
            translation TEXT NOT NULL,
            phonetic TEXT,
            example TEXT,
            example_zh TEXT,
            category TEXT NOT NULL,
            stage TEXT,
            difficulty TEXT,
            image_url TEXT,
            image_status TEXT NOT NULL CHECK (image_status IN ('source', 'fallback')),
            source_path TEXT NOT NULL,
            selection_score INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );
        CREATE INDEX idx_core_words_category ON core_words(category);
    ''')
    cards = []
    now = datetime.now(timezone.utc).isoformat()
    for index, candidate in enumerate(candidates):
        word = str(candidate.get('standardized') or candidate.get('word') or '').strip().lower()
        translation = str(candidate.get('chinese') or '').strip()
        if pack_id == 'extension-english':
            translation = TRANSLATION_OVERRIDES.get(word, translation)
        if not word or not translation:
            continue
        category = str(candidate.get('currentCategory') or 'general').strip() or 'general'
        enrichment = previous_enrichment.get(word, {})
        phonetic = str(enrichment.get('phonetic') or candidate.get('phonetic') or '').strip()
        example = sentence_text(enrichment.get('example') or candidate.get('example'), '.')
        example_zh = sentence_text(enrichment.get('example_zh') or candidate.get('exampleZh') or candidate.get('example_zh'), '。')
        if pack_id == 'extension-english' and word in CONTENT_OVERRIDES:
            example, example_zh = CONTENT_OVERRIDES[word]
        source_image = str(candidate.get('imageUrl') or '').strip()
        image = source_image if should_use_source_image(source_image) else fallback_image_for(category)
        image_status = 'source' if should_use_source_image(source_image) else 'fallback'
        connection.execute('''
            INSERT INTO core_words (word, translation, phonetic, example, example_zh, category, stage, difficulty, image_url, image_status, source_path, selection_score, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            word, translation, phonetic or None, example or None, example_zh or None,
            category,
            candidate.get('currentStage'), candidate.get('currentDifficulty'), image, image_status,
            str(candidate.get('sourcePath') or ''), int(candidate.get('selectionScore') or 0), now,
        ))
        cards.append({
            'id': f'{pack_id}-{index + 1}-{word.replace(" ", "-")}',
            'word': word,
            'translation': translation,
            'phonetic': phonetic,
            'example': example,
            'example_zh': example_zh,
            'level': level,
            'difficulty': 1,
            'tags': [pack_id, category],
            'image': image,
            'imageStatus': image_status,
            'sourceImage': source_image,
            'sourcePath': str(candidate.get('sourcePath') or ''),
            'viewCategory': category,
        })
    connection.commit()
    connection.close()
    if work_database != database_path:
        replace_database(database_path, work_database)
    view = {
        'id': pack_id,
        'type': 'vocab-view',
        'sourceModuleId': pack_id,
        'viewId': level,
        'generatedAt': now,
        'description': 'Review-derived core English candidate pack. It does not replace the source graded vocabulary.',
        'cards': cards,
    }
    view_path.write_text(json.dumps(view, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    manifest = {
        'id': pack_id,
        'version': '2026-07-11',
        'type': 'game-vocab-pack',
        'title': title,
        'generatedAt': now,
        'cardCount': len(cards),
        'sourceCandidates': manifest_path_value(candidates_path),
        'database': manifest_path_value(database_path),
        'views': [{'id': level, 'file': manifest_path_value(view_path), 'cardCount': len(cards)}],
        'imageCoverage': {
            'source': sum(card['imageStatus'] == 'source' for card in cards),
            'fallback': sum(card['imageStatus'] == 'fallback' for card in cards),
        },
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return {'cardCount': len(cards), 'database': str(database_path), 'view': str(view_path), 'manifest': str(manifest_path)}


def main():
    parser = argparse.ArgumentParser(description='Build the publishable core English SQLite database and runtime view.')
    parser.add_argument('--candidates', type=Path, default=DEFAULT_CANDIDATES)
    parser.add_argument('--db', type=Path, default=DEFAULT_DB)
    parser.add_argument('--view', type=Path, default=DEFAULT_VIEW)
    parser.add_argument('--manifest', type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument('--pack-id', default='core-english')
    parser.add_argument('--title', default='核心英语学习路径')
    parser.add_argument('--level', default='core')
    args = parser.parse_args()
    print(json.dumps(build(args.candidates, args.db, args.view, args.manifest, args.pack_id, args.title, args.level), ensure_ascii=False))


if __name__ == '__main__':
    main()
