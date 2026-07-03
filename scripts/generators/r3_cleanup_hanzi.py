# -*- coding: utf-8 -*-
"""
R3 清理脚本：data/hanzi-hsk.json

任务：
  1. 删除 R2 clean-report.json 中 needs_manual 的 10 条（按 itemId 精确定位）。
  2. 修 R2 漏的「太阳从南边升起来」常识错（保留「南」字题，仅替换 example）。
  3. 复扫更宽启发式，找 R2 可能遗漏的脏数据：
       - 自动修：marker 错位、answer 不在 opts、ASCII ... 截断且可从 word 重建
       - 删除：新的常识错 / 严重脏数据（与"全删脏数据"决策一致）
       - 列清单：不确定的（写入 rescan-report.json）
  4. 验证、备份 .bak2、写回。

输入  : data/hanzi-hsk.json (+ data/hanzi-hsk.json.clean-report.json)
备份  : data/hanzi-hsk.json.bak2
输出  : 覆盖写回 data/hanzi-hsk.json
        data/hanzi-hsk.json.rescan-report.json
"""
import json
import io
import os
import re
import shutil

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'data', 'hanzi-hsk.json')
BAK2 = SRC + '.bak2'
CLEAN_REPORT = os.path.join(ROOT, 'data', 'hanzi-hsk.json.clean-report.json')
RESCAN_REPORT = os.path.join(ROOT, 'data', 'hanzi-hsk.json.rescan-report.json')

# ---- 删除清单（R2 needs_manual itemId）-----------------------------------
DELETE_ITEM_IDS = [
    'hsk1[1]', 'hsk1[37]', 'hsk1[38]', 'hsk1[63]', 'hsk1[95]',
    'hsk1[119]', 'hsk1[126]',
    'hsk1[330]', 'hsk1[359]', 'hsk1[434]',
]

# ---- 6312 修正：南 字题 example ------------------------------------------
# 原：「太阳从**南**边升起来。」(常识错：太阳东升西落)
# 新：「指南针的一端指着**南**。」(常识对，保留 **南** 标记)
NAN_NEW_EXAMPLE = '指南针的一端指着**南**。'
NAN_OLD_SUBSTR = '南边升'  # 用子串定位，避免编码/全串差异

# ---- 复扫启发式 ----------------------------------------------------------
# 常识错（方位/自然现象矛盾）——命中即删
RE_SUN_WRONG_DIR = re.compile(r'(太阳|日).*(南|西)(边|面).*升')
RE_MOON_DAYTIME = re.compile(r'(月亮|月球).*(白天|早上|早晨|中午|日间)')
RE_SNOW_SUMMER = re.compile(r'雪.{0,6}(夏天|盛夏|酷暑|伏天)')
RE_SUN_NIGHT = re.compile(r'(太阳|日).*(晚上|夜晚|半夜|夜间|黑天|黄昏).{0,4}(出|升)')

# example 截断/乱码
RE_ASCII_ELLIPSIS = re.compile(r'\.\.\.')          # ASCII 三点（占位片段）
ALLOWED_EXAMPLE = re.compile(
    r'^[一-鿿　-〿＀-￯‐-‧‰-⁞a-zA-Z0-9 ，。！？、：；""''（）【】《》\-…\*\.\,\!\?\(\)\[\]/\s]*$'
)

# word 损坏
RE_DUP_CJK = re.compile(r'([一-鿿])\1')            # 叠字（爸爸爸/好好好）
NON_CJK_IN_WORD = re.compile(r'[^一-鿿]')

CJK_RE = re.compile(r'[一-鿿]')


def find_markers(example):
    return re.findall(r'\*\*(.+?)\*\*', example)


def fix_marker(example, answer):
    """Strip **...**, re-mark first occurrence of answer. None if answer absent."""
    stripped = re.sub(r'\*\*(.+?)\*\*', r'\1', example)
    idx = stripped.find(answer)
    if idx == -1:
        return None
    return stripped[:idx] + '**' + answer + '**' + stripped[idx + len(answer):]


def is_commonsense_error(example):
    """返回 (bool, reason)。命中即视为常识错，应删除。
    先剥离 ** 标记再匹配，避免标记拆散关键词邻接（R2 漏南字题的原因）。"""
    if not example:
        return False, ''
    plain = re.sub(r'\*\*(.+?)\*\*', r'\1', example)
    if RE_SUN_WRONG_DIR.search(plain):
        return True, 'sun_wrong_direction: 太阳从南/西边升起'
    if RE_MOON_DAYTIME.search(plain):
        return True, 'moon_daytime: 月亮出现在白天'
    if RE_SNOW_SUMMER.search(plain):
        return True, 'snow_summer: 夏天出现雪'
    if RE_SUN_NIGHT.search(plain):
        return True, 'sun_night: 太阳夜晚升起'
    return False, ''


def word_is_dirty(word, answer):
    """word 损坏判定：三字及以上含叠字 artifact（爸爸爸/第第二/好好好）或非汉字。
    注意：2 字重叠词（爸爸/妈妈/常常/谢谢/爷爷/奶奶）是合法汉语词，不判脏。"""
    if not word:
        return False, ''
    # 仅当 word 长度 >= 3 且含 CJK 字符连续重复时视为 artifact
    # （2 字重叠词合法；3 字以上如 爸爸爸/第第二 才是生成器损坏）
    if len(word) >= 3 and RE_DUP_CJK.search(word):
        return True, 'word_dup_artifact: word>=3字含重复字 artifact (%s)' % word
    if NON_CJK_IN_WORD.search(word):
        return True, 'word_non_cjk: word 含非汉字字符 (%s)' % word
    return False, ''


def main():
    # ---- 备份 .bak2 ----
    shutil.copy2(SRC, BAK2)

    with io.open(SRC, encoding='utf-8') as f:
        d = json.load(f)
    with io.open(CLEAN_REPORT, encoding='utf-8') as f:
        clean_rep = json.load(f)

    items = d['levels']['hsk1']
    orig_total = len(items)

    # ========== Step 1: 删除 10 条 needs_manual ==========
    # itemId "hsk1[i]" -> 原始下标 i；收集后从大到小删，避免下标漂移
    delete_indices = []
    confirmed = []
    clean_manual_ids = {it['itemId'] for it in clean_rep.get('manual_items', [])}
    for iid in DELETE_ITEM_IDS:
        m = re.match(r'hsk1\[(\d+)\]', iid)
        if not m:
            continue
        idx = int(m.group(1))
        delete_indices.append(idx)
        # 记录被删条目的关键字段用于确认
        if 0 <= idx < len(items):
            it = items[idx]
            confirmed.append({
                'itemId': iid,
                'type': it.get('type', ''),
                'word': it.get('word', ''),
                'example': (it.get('example', '') or '')[:40],
                'answer': it.get('answer', ''),
                'in_clean_report': iid in clean_manual_ids,
            })

    delete_indices = sorted(set(delete_indices), reverse=True)
    for idx in delete_indices:
        del items[idx]

    # ========== Step 2: 修「南」字常识错（R2 漏的）==========
    # 用「char==南 + example 含"太阳" + example 含"升"」定位，避免 ** 标记拆散子串
    nan_fix = None
    for it in items:
        ex_now = it.get('example') or ''
        if (it.get('char') == '南' and '太阳' in ex_now and '升' in ex_now
                and ('南' in ex_now or '**南**' in ex_now)):
            before = it['example']
            it['example'] = NAN_NEW_EXAMPLE
            nan_fix = {
                'char': '南',
                'before': before,
                'after': NAN_NEW_EXAMPLE,
                'answer': it.get('answer'),
                'note': '保留南字题，仅替换 example 为正确常识（太阳东升非南）',
            }
            break

    # ========== Step 3: 复扫更宽启发式 ==========
    auto_fixed = []        # 自动修
    deleted_rescan = []    # 复扫发现后删除（常识错/严重脏）
    listed = []            # 列清单不确定（写入报告）
    counts = {
        'auto_marker_fix': 0,
        'auto_opts_fix': 0,
        'auto_ellipsis_rebuild': 0,
        'deleted_commonsense': 0,
        'deleted_dirty_word': 0,
        'listed_unclosed_marker': 0,
        'listed_length_anomaly': 0,
        'listed_garbage': 0,
        'listed_other': 0,
    }

    # 第一遍：收集要删的下标 + 原地自动修
    to_delete = set()
    for i, it in enumerate(items):
        ex = it.get('example', '') or ''
        ans = it.get('answer', '') or ''
        opts = it.get('opts', []) or []
        word = it.get('word', '') or ''
        typ = it.get('type', 'single')

        # --- 自动修：marker 错位 ---
        ms = find_markers(ex)
        bad_markers = [m for m in ms if m != ans]
        if bad_markers:
            new_ex = fix_marker(ex, ans)
            if new_ex is not None and new_ex != ex:
                auto_fixed.append({
                    'itemId': 'hsk1[%d]' % i, 'rule': 'marker_misalign',
                    'answer': ans, 'before': ex, 'after': new_ex,
                    'bad_markers': bad_markers,
                })
                it['example'] = new_ex
                ex = new_ex
                counts['auto_marker_fix'] += 1

        # --- 自动修：answer 不在 opts ---
        if ans and opts and (ans not in opts):
            if len(opts) < 4:
                opts.append(ans)
            else:
                opts = [o for o in opts if o != ans]
                while len(opts) >= 4:
                    opts.pop()
                opts.append(ans)
            it['opts'] = opts
            auto_fixed.append({
                'itemId': 'hsk1[%d]' % i, 'rule': 'opts_complete',
                'answer': ans, 'after_opts': list(opts),
            })
            counts['auto_opts_fix'] += 1

        # --- 常识错：删除 ---
        is_err, reason = is_commonsense_error(ex)
        if is_err:
            deleted_rescan.append({
                'rescan_index': i, 'rule': 'commonsense_error',
                'reason': reason, 'example': ex, 'answer': ans,
                'char': it.get('char', ''), 'word': word,
            })
            to_delete.add(i)
            counts['deleted_commonsense'] += 1
            continue

        # --- word 严重损坏（fill-blank）：删除 ---
        if typ == 'fill-blank':
            dirty, wreason = word_is_dirty(word, ans)
            if dirty:
                deleted_rescan.append({
                    'rescan_index': i, 'rule': 'dirty_word',
                    'reason': wreason, 'word': word, 'example': ex,
                    'answer': ans,
                })
                to_delete.add(i)
                counts['deleted_dirty_word'] += 1
                continue

        # --- 列清单：未闭合 ** ---
        if ex.count('**') % 2 == 1:
            listed.append({
                'rescan_index': i, 'rule': 'unclosed_marker',
                'reason': '**标记未闭合(奇数个)', 'example': ex, 'answer': ans,
            })
            counts['listed_unclosed_marker'] += 1

        # --- 列清单：长度异常（仅整句题，fill-blank 的「爱？」短占位是合法约定）---
        if typ != 'fill-blank' and ex and (len(ex) < 5 or len(ex) > 45):
            listed.append({
                'rescan_index': i, 'rule': 'length_anomaly',
                'reason': 'example长度异常(%d字)' % len(ex),
                'example': ex, 'type': typ,
            })
            counts['listed_length_anomaly'] += 1

        # --- 列清单：含可疑乱码 ---
        if ex and not ALLOWED_EXAMPLE.match(ex):
            listed.append({
                'rescan_index': i, 'rule': 'garbage',
                'reason': '含可疑非中文/乱码字符', 'example': ex,
            })
            counts['listed_garbage'] += 1

        # --- 列清单：ASCII ... 截断（无法从 word 重建的）---
        if ex and RE_ASCII_ELLIPSIS.search(ex):
            # 尝试从 word 重建（仅 fill-blank）
            rebuilt = None
            if typ == 'fill-blank' and word and ans and ans in word and not RE_DUP_CJK.search(word):
                cand = word.replace(ans, '？', 1)
                if cand.count('？') == 1:
                    rebuilt = cand
            if rebuilt is not None:
                auto_fixed.append({
                    'itemId': 'hsk1[%d]' % i, 'rule': 'ellipsis_rebuild',
                    'answer': ans, 'before': ex, 'after': rebuilt, 'word': word,
                })
                it['example'] = rebuilt
                counts['auto_ellipsis_rebuild'] += 1
            else:
                listed.append({
                    'rescan_index': i, 'rule': 'ascii_ellipsis_truncated',
                    'reason': 'example含ASCII...且无法从word重建',
                    'example': ex, 'type': typ,
                })
                counts['listed_other'] += 1

    # 执行删除（从大到小）
    for i in sorted(to_delete, reverse=True):
        del items[i]

    final_total = len(items)

    # ---- 写回 ----
    with io.open(SRC, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, indent=2)

    # ---- 复扫报告 ----
    report = {
        'source': 'r3_cleanup_hanzi.py',
        'original_total': orig_total,
        'step1_deleted_manual': len(confirmed),
        'step1_deleted_items': confirmed,
        'step2_nan_fix': nan_fix,
        'step3_auto_fixed': len(auto_fixed),
        'step3_auto_items': auto_fixed,
        'step3_deleted_rescan': len(deleted_rescan),
        'step3_deleted_items': deleted_rescan,
        'step3_listed': len(listed),
        'step3_listed_items': listed,
        'counts': counts,
        'final_total': final_total,
        'note': 'rescan_index 是删除10条后、复扫删除前的临时下标，仅供参考定位',
    }
    with io.open(RESCAN_REPORT, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    # ---- stdout (ASCII-safe) ----
    print('orig_total=%d' % orig_total)
    print('step1_deleted_manual=%d' % len(confirmed))
    print('step2_nan_fix_applied=%s' % ('yes' if nan_fix else 'NO'))
    print('step3_auto_fixed=%d' % len(auto_fixed))
    print('step3_deleted_rescan=%d' % len(deleted_rescan))
    print('step3_listed=%d' % len(listed))
    print('final_total=%d' % final_total)
    print('counts=%s' % json.dumps(counts, ensure_ascii=True))


if __name__ == '__main__':
    main()
