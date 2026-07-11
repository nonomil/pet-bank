(function (root) {
    'use strict';

    const NODE_IDS = ['see', 'choose', 'return'];

    function build(events = []) {
        const list = Array.isArray(events) ? events : [];
        const indexes = {
            see: [],
            choose: [],
            return: []
        };
        const optional = { challenge: [], battle: [] };
        list.forEach((event, index) => {
            if (event?.type === 'choice') indexes.choose.push(index);
            else if (event?.type === 'math') optional.challenge.push(index);
            else if (event?.type === 'encounter') {
                indexes.return.push(index);
                optional.battle.push(index);
            } else indexes.see.push(index);
        });
        const nodes = NODE_IDS.map(id => ({ id, eventIndexes: indexes[id] }));
        return { schemaVersion: 1, nodes, optional };
    }

    function getNodeForEvent(model, eventIndex) {
        const index = Number(eventIndex);
        if (model?.optional?.challenge?.includes(index)) return { id: 'challenge', eventIndexes: [index] };
        for (const node of model?.nodes || []) {
            if (node.eventIndexes.includes(index)) return node;
        }
        return { id: 'see', eventIndexes: [] };
    }

    root.ExplorationChapter = { build, getNodeForEvent, NODE_IDS };
})(typeof window !== 'undefined' ? window : globalThis);
