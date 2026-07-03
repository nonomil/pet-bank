# -*- coding: utf-8 -*-
"""
R2 清洗脚本：data/hanzi-hsk.json (HSK3.0 Level1, 594 题)

规则（保守，纯规则无 LLM）：
  规则1（自动修）—— 例句 **标记**错位：example 内 **x** 的 x != answer。
                      去旧标记 → 在 answer 首次出现处重标 **answer**；answer 不在 example 则进 needs_manual。
  规则2（自动修/或转人工）—— 词组填空挖空重复/异常（？？、??、第第？这类）。
                      先尝试从 word 干净重建（word 含 answer 且 word 自身无重复字 artifact）；
                      重建失败 → needs_manual。
                      重建格式遵循 fill-blank 文件约定（？占位），避免引入新不一致。
  规则3（自动修）—— answer 不在 opts → 补入 opts（追加；若已满 4 则替换末位）。
  规则4（只记录不改）—— 启发式可疑样本入 needs_manual：
                      方位常识错（太阳...南/西边...升）、长度异常（<6 或 >40）、
                      **未闭合（奇数个）、连续标点、含可疑非中文/乱码、
                      单字 pinyin 为空或疑似词级多音节占位。

输入  : data/hanzi-hsk.json
备份  : data/hanzi-hsk.json.bak
输出  : 覆盖写回 data/hanzi-hsk.json
        data/hanzi-hsk.json.clean-report.json
"""
import json
import io
import os
import re
import shutil
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'data', 'hanzi-hsk.json')
BAK = SRC + '.bak'
REPORT = os.path.join(ROOT, 'data', 'hanzi-hsk.json.clean-report.json')

# ---- Rule 4 regexes ----------------------------------------------------------
RE_SUN_WRONG_DIR = re.compile(r'(太阳|日).*(南|西)(边|面).*升')
RE_SUN_RISE_SET_CONFLICT = re.compile(r'(太阳|日).*升.*(太阳|日).*落|落.*升')
RE_CONSEC_PUNCT = re.compile(r'[，。！？、,\.!?:：;；]{3,}')
RE_CONSEC_PLACEHOLDER = re.compile(r'(？？|\?\?)')
# CJK doubled char immediately followed by full/half-width '?' → 第第？ style artifact
RE_DUP_THEN_PLACEHOLDER = re.compile(r'([一-鿿])\1(？|\?)')
RE_DUP_CJK = re.compile(r'([一-鿿])\1')
# Allowed chars in example: CJK + CJK punct + fullwidth punct + ASCII printable + space + *
ALLOWED_EXAMPLE = re.compile(
    r'^[一-鿿'        # CJK unified
    r'　-〿'          # CJK symbols and punctuation
    r'＀-￯'          # fullwidth forms
    r'‐-‧'          # general punctuation (–—‥…)
    r'‰-⁞'          # per mille, etc.
    r'a-zA-Z0-9'              # ASCII letters/digits
    r' ，。！？、：；""''（）【】《》\-…\*\.\,\!\?\(\)\[\]/\s]*$'
)


def find_marker_mismatch(example, answer):
    """Return (all_markers, bad_markers)."""
    ms = re.findall(r'\*\*(.+?)\*\*', example)
    bad = [m for m in ms if m != answer]
    return ms, bad


def fix_marker(example, answer):
    """Strip all **...**, then re-mark first occurrence of `answer`.
    Return new string, or None if answer not present in stripped text."""
    stripped = re.sub(r'\*\*(.+?)\*\*', r'\1', example)
    idx = stripped.find(answer)
    if idx == -1:
        return None
    return stripped[:idx] + '**' + answer + '**' + stripped[idx + len(answer):]


def try_rebuild_fillblank(word, answer):
    """Rebuild a clean fill-blank example from `word`.
    Convention of the file: example = word with answer replaced by '？'.
    Refuse (return None) if word is empty, lacks answer, or has a duplicated
    CJK artifact char (e.g. 第第二), or is too short."""
    if not word or not answer:
        return None
    if answer not in word:
        return None
    if RE_DUP_CJK.search(word):           # word itself dirty (第第二, 爸爸爸, ...)
        return None
    if len(word) < 2:
        return None
    # only rebuild if result still contains the placeholder exactly once
    rebuilt = word.replace(answer, '？', 1)
    if rebuilt.count('？') != 1:
        return None
    return rebuilt


def is_garbage(example):
    """True if example contains chars outside the allowed set."""
    return bool(example) and not ALLOWED_EXAMPLE.match(example)


def suspicious_single_pinyin(pinyin):
    """Single-char pinyin should be one syllable. Flag empties or clear
    multi-syllable placeholders (whitespace/pipe, or alpha run >= 7)."""
    if not pinyin or not pinyin.strip():
        return True
    if re.search(r'[\s|/]', pinyin):
        return True
    alpha = re.sub(r'[^a-zA-Z]', '', pinyin)
    if len(alpha) >= 7:        # single syllable max ~6 (e.g. zhuàng=6)
        return True
    return False


def main():
    # ---- backup ----
    shutil.copy2(SRC, BAK)

    with io.open(SRC, encoding='utf-8') as f:
        d = json.load(f)
    items = d['levels']['hsk1']

    auto_fixed = []
    fix_counts = {'marker_misalign': 0, 'blank_rebuild': 0, 'opts_complete': 0}

    manual_by_item = {}        # item_id -> {rules:[], reasons:[], fields:{}}
    manual_counts = {
        'marker_no_answer': 0,
        'blank_duplicate': 0,
        'sun_commonsense': 0,
        'length_anomaly': 0,
        'unclosed_marker': 0,
        'consec_punct': 0,
        'garbage': 0,
        'pinyin_anomaly': 0,
        'placeholder_fragment': 0,
    }

    def add_manual(item_id, rule, reason, fields):
        if item_id not in manual_by_item:
            manual_by_item[item_id] = {'itemId': item_id, 'rules': [], 'reasons': [], 'fields': {}}
        manual_by_item[item_id]['rules'].append(rule)
        manual_by_item[item_id]['reasons'].append(reason)
        manual_by_item[item_id]['fields'].update(fields)
        manual_counts[rule] = manual_counts.get(rule, 0) + 1

    for i, it in enumerate(items):
        ex = it.get('example', '') or ''
        ans = it.get('answer', '') or ''
        opts = it.get('opts', []) or []
        word = it.get('word', '') or ''
        py = it.get('pinyin', '') or ''
        typ = it.get('type', 'single')
        item_id = 'hsk1[%d]' % i

        # ---------------- Rule 1: marker misalign ----------------
        ms, bad = find_marker_mismatch(ex, ans)
        if bad:
            new_ex = fix_marker(ex, ans)
            if new_ex is not None:
                auto_fixed.append({
                    'itemId': item_id, 'rule': 'marker_misalign',
                    'answer': ans,
                    'before': ex, 'after': new_ex,
                    'bad_markers': bad,
                })
                it['example'] = new_ex
                ex = new_ex
                fix_counts['marker_misalign'] += 1
            else:
                add_manual(item_id, 'marker_no_answer',
                           '**标记错位且example不含answer字符，无法自动重标',
                           {'example': ex, 'answer': ans, 'bad_markers': bad})

        # ---------------- Rule 2: fill-blank duplicate/anomaly ----------------
        if typ == 'fill-blank':
            dup_hit = (RE_CONSEC_PLACEHOLDER.search(ex)
                       or RE_DUP_THEN_PLACEHOLDER.search(ex))
            if dup_hit:
                rebuilt = try_rebuild_fillblank(word, ans)
                if rebuilt is not None and rebuilt != ex:
                    auto_fixed.append({
                        'itemId': item_id, 'rule': 'blank_rebuild',
                        'answer': ans, 'word': word,
                        'before': ex, 'after': rebuilt,
                    })
                    it['example'] = rebuilt
                    ex = rebuilt
                    fix_counts['blank_rebuild'] += 1
                else:
                    add_manual(item_id, 'blank_duplicate',
                               '词组填空挖空重复/异常且无法从word干净重建',
                               {'example': ex, 'word': word, 'answer': ans})

        # ---------------- Rule 3: answer not in opts ----------------
        if ans and opts and (ans not in opts):
            if len(opts) < 4:
                opts.append(ans)
            else:
                # replace last distractor (keep answer unique)
                opts = [o for o in opts if o != ans]
                while len(opts) >= 4:
                    opts.pop()
                opts.append(ans)
            it['opts'] = opts
            auto_fixed.append({
                'itemId': item_id, 'rule': 'opts_complete',
                'answer': ans, 'after_opts': list(opts),
            })
            fix_counts['opts_complete'] += 1

        # ---------------- Rule 4: heuristic, flag-only ----------------
        # length anomaly — only for single-char items (full sentences).
        # fill-blank examples are deliberately short word fragments (e.g. "爱？").
        if typ != 'fill-blank' and ex and (len(ex) < 6 or len(ex) > 40):
            add_manual(item_id, 'length_anomaly',
                       'example长度异常(%d字)' % len(ex), {'example': ex})
        # unclosed ** (odd count)
        if ex.count('**') % 2 == 1:
            add_manual(item_id, 'unclosed_marker',
                       '**标记未闭合(奇数个)', {'example': ex})
        # sun commonsense
        if RE_SUN_WRONG_DIR.search(ex) or RE_SUN_RISE_SET_CONFLICT.search(ex):
            add_manual(item_id, 'sun_commonsense',
                       '疑似方位常识错例句', {'example': ex})
        # consecutive punctuation
        if RE_CONSEC_PUNCT.search(ex):
            add_manual(item_id, 'consec_punct',
                       '连续标点异常', {'example': ex})
        # garbage / non-CJK suspicious chars
        if is_garbage(ex):
            bad_chars = [c for c in ex if not ALLOWED_EXAMPLE.match(c)]
            add_manual(item_id, 'garbage',
                       '含可疑非中文/乱码字符: %s' % repr(''.join(bad_chars[:10])),
                       {'example': ex})
        # placeholder / meta-text fragment in example (generator artifact):
        # leading/trailing ASCII "..." or Chinese "……", or meta words like 例句/字符/填空/占位
        if ex and (ex.startswith('...') or ex.endswith('...')
                   or '……' in ex
                   or re.search(r'(例句|字符|填空|占位|带有.*的例)', ex)):
            add_manual(item_id, 'placeholder_fragment',
                       'example疑似截断片段或生成器meta文本', {'example': ex})
        # single-char pinyin anomaly (word-level placeholder residue)
        if typ != 'fill-blank':
            if suspicious_single_pinyin(py):
                add_manual(item_id, 'pinyin_anomaly',
                           '单字pinyin为空或疑似词级多音节占位',
                           {'char': it.get('char', ''), 'pinyin': py})

    # ---- write back ----
    with io.open(SRC, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, indent=2)

    manual_items = sorted(manual_by_item.values(),
                          key=lambda x: (x['rules'][0], x['itemId']))
    report = {
        'source': 'clean_hanzi_hsk.py',
        'total_items': len(items),
        'auto_fixed': len(auto_fixed),
        'fix_counts': fix_counts,
        'items': auto_fixed,
        'needs_manual': len(manual_items),
        'manual_counts': manual_counts,
        'manual_items': manual_items,
    }
    with io.open(REPORT, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    # ASCII-safe stdout (Windows GBK console safe)
    out = sys.stdout
    out.write('auto_fixed=%d needs_manual=%d\n' % (len(auto_fixed), len(manual_items)))
    out.write('fix_counts=%s\n' % json.dumps(fix_counts, ensure_ascii=True))
    out.write('manual_counts=%s\n' % json.dumps(manual_counts, ensure_ascii=True))


if __name__ == '__main__':
    main()
