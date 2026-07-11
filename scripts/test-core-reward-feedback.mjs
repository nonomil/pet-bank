import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/core-reward-feedback.js', 'utf8');
const context = { console, globalThis: null, CoreRewardService: { toPresentation: () => ({ title: '获得新奖励', lines: ['成长分 +1'], nextAction: { label: '玩耍', reason: '陪伴宠物' } }) } };
context.globalThis = context;
vm.runInNewContext(source, context, { filename: 'js/core-reward-feedback.js' });

function node(tag) {
  return { tag, children: [], className: '', hidden: false, ownerDocument: documentStub, appendChild(child) { this.children.push(child); }, set textContent(value) { this.children = []; this.text = value; }, get textContent() { return this.text || ''; } };
}
const documentStub = { createElement: (tag) => node(tag) };
const container = node('div');
assert.equal(context.CoreRewardFeedback.render(container, { title: '安全', lines: ['<script>'], nextAction: { label: '玩耍', reason: '陪伴' } }), true);
assert.equal(container.children[0].children[0].text, '安全');
assert.equal(container.children[1].children[0].children[0].text, '<script>');
assert.equal(container.children[2].children[0].text, '下一步：玩耍 · 陪伴');
console.log('core reward feedback tests passed');
