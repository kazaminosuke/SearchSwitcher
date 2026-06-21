// options.js — vanilla JS (エクスポート/インポート・プリセット・デフォルト復元)
document.addEventListener('DOMContentLoaded', function () {
    let engines = [];
    let linkPresets = {};
    const MAX_TARGETS = 5;

    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

    function restoreOptions() {
        chrome.storage.sync.get({ engines: [], linkPresets: {} }, (items) => {
            if (!items.engines || items.engines.length === 0) {
                $('#link-config-container').innerHTML =
                    '<p>エンジンが登録されていません。「デフォルト設定に戻す」を押すか、「エンジンリストを管理する」から追加してください。</p>';
                engines = [];
            } else {
                engines = items.engines;
                renderLinkConfigUI();
            }
            linkPresets = items.linkPresets || {};
            renderCustomPresets();
        });
    }

    function renderLinkConfigUI() {
        const container = $('#link-config-container');
        container.innerHTML = '';
        engines.forEach(sourceEngine => {
            const row = document.createElement('div');
            row.className = 'engine-row';

            const label = document.createElement('div');
            label.className = 'engine-label';
            const img = document.createElement('img');
            img.src = sourceEngine.icon;
            const span = document.createElement('span');
            span.textContent = sourceEngine.name;
            label.append(img, span);

            const arrow = document.createElement('div');
            arrow.className = 'arrow-separator';
            arrow.textContent = '→';

            const targets = document.createElement('div');
            targets.className = 'targets-container';
            for (let i = 0; i < MAX_TARGETS; i++) {
                targets.appendChild(createTargetSelector(sourceEngine, i));
            }

            row.append(label, arrow, targets);
            container.appendChild(row);
        });
    }

    function createTargetSelector(sourceEngine, index) {
        const wrap = document.createElement('div');
        wrap.className = 'target-selector';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'is-floating-btn';
        checkbox.dataset.sourceId = sourceEngine.id;
        checkbox.dataset.targetIndex = index;

        const select = document.createElement('select');
        select.className = 'target-select';
        select.dataset.sourceId = sourceEngine.id;
        select.dataset.targetIndex = index;
        select.appendChild(new Option('なし', ''));
        engines.forEach(targetEngine => {
            if (sourceEngine.id === targetEngine.id) return;
            select.appendChild(new Option(targetEngine.name, targetEngine.id));
        });

        const targetInfo = (sourceEngine.allowed_targets && sourceEngine.allowed_targets[index]) || {};
        const targetId = targetInfo.id || '';
        select.value = targetId;
        checkbox.checked = !!(targetInfo.is_floating && targetId);
        checkbox.disabled = !targetId;

        wrap.append(checkbox, select);
        return wrap;
    }

    // --- 代表的なリンク設定パターン ---
    $$('.apply-preset-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            if (engines.length === 0) { alert('先にエンジンを追加してください。'); return; }
            const type = btn.dataset.presetType;
            if (!confirm(`現在のリンク設定が「${btn.textContent}」で上書きされます。よろしいですか？`)) return;
            if (type === 'hub-spoke') applyHubSpokePreset('google');
            else if (type === 'ring') applyRingPreset();
            else if (type === 'full-mesh') applyFullMeshPreset();
            saveEngines();
            renderLinkConfigUI();
        });
    });

    function applyHubSpokePreset(hubId) {
        if (!engines.some(e => e.id === hubId)) hubId = engines[0]?.id;
        if (!hubId) return;
        engines.forEach(engine => {
            if (engine.id === hubId) {
                engine.allowed_targets = engines.filter(e => e.id !== hubId).slice(0, MAX_TARGETS)
                    .map(t => ({ id: t.id, is_floating: true }));
            } else {
                engine.allowed_targets = [{ id: hubId, is_floating: true }];
            }
        });
    }

    function applyRingPreset() {
        const ids = engines.map(e => e.id);
        if (ids.length < 2) return;
        engines.forEach((engine, index) => {
            engine.allowed_targets = [{ id: ids[(index + 1) % ids.length], is_floating: true }];
        });
    }

    function applyFullMeshPreset() {
        engines.forEach(engine => {
            engine.allowed_targets = engines.filter(e => e.id !== engine.id).slice(0, MAX_TARGETS)
                .map(t => ({ id: t.id, is_floating: true }));
        });
    }

    // --- デフォルト設定に戻す（既定エンジン＋「標準」リンク設定） ---
    $('#reset-default-btn').addEventListener('click', function () {
        if (!confirm('エンジンリストとリンク設定を、すべて初期状態（標準）に戻します。よろしいですか？')) return;
        engines = self.SearchSwitcherDefaults.buildDefaultEngines();
        chrome.storage.sync.set({ engines: engines }, () => {
            renderLinkConfigUI();
            alert('デフォルト設定（標準）に戻しました。');
        });
    });

    // --- カスタムプリセット ---
    function renderCustomPresets() {
        const select = $('#custom-preset-select');
        select.innerHTML = '';
        select.appendChild(new Option('-- 保存したプリセット --', ''));
        Object.keys(linkPresets).forEach(name => select.appendChild(new Option(name, name)));
    }

    $('#save-custom-preset-btn').addEventListener('click', function () {
        const name = $('#custom-preset-name').value.trim();
        if (!name) { alert('プリセット名を入力してください。'); return; }
        linkPresets[name] = engines.map(e => ({ id: e.id, allowed_targets: e.allowed_targets || [] }));
        chrome.storage.sync.set({ linkPresets }, () => {
            alert(`リンク設定「${name}」が保存されました。`);
            $('#custom-preset-name').value = '';
            renderCustomPresets();
        });
    });

    $('#load-custom-preset-btn').addEventListener('click', function () {
        const name = $('#custom-preset-select').value;
        if (!name) { alert('読み込むプリセットを選択してください。'); return; }
        if (!confirm(`リンク設定が「${name}」の内容で上書きされます。よろしいですか？`)) return;
        const loaded = linkPresets[name];
        engines.forEach(engine => {
            const saved = loaded.find(s => s.id === engine.id);
            engine.allowed_targets = saved ? saved.allowed_targets : [];
        });
        saveEngines();
        renderLinkConfigUI();
    });

    $('#delete-custom-preset-btn').addEventListener('click', function () {
        const name = $('#custom-preset-select').value;
        if (!name) { alert('削除するプリセットを選択してください。'); return; }
        if (!confirm(`リンク設定プリセット「${name}」を完全に削除します。よろしいですか？`)) return;
        delete linkPresets[name];
        chrome.storage.sync.set({ linkPresets }, () => {
            alert(`プリセット「${name}」が削除されました。`);
            renderCustomPresets();
        });
    });

    // --- エクスポート / インポート ---
    $('#export-presets-btn').addEventListener('click', function () {
        if (Object.keys(linkPresets).length === 0) {
            alert('エクスポートするカスタムプリセットがありません。');
            return;
        }
        const blob = new Blob([JSON.stringify(linkPresets, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'search-switcher-link-presets.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    $('#import-presets-btn').addEventListener('click', () => $('#import-file-input').click());

    $('#import-file-input').addEventListener('change', function (event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const imported = JSON.parse(e.target.result);
                if (typeof imported !== 'object' || imported === null) throw new Error('無効なファイル形式です。');
                if (!confirm('現在のカスタムプリセットに、インポートした設定をマージ（追加・上書き）します。よろしいですか？')) {
                    $('#import-file-input').value = '';
                    return;
                }
                linkPresets = Object.assign({}, linkPresets, imported);
                chrome.storage.sync.set({ linkPresets }, () => {
                    alert('プリセットが正常にインポートされました。');
                    renderCustomPresets();
                });
            } catch (error) {
                alert('ファイルの読み込みに失敗しました。有効なJSONファイルを選択してください。\nエラー: ' + error.message);
            } finally {
                $('#import-file-input').value = '';
            }
        };
        reader.readAsText(file);
    });

    // --- リンク設定の変更を保存 ---
    $('#link-config-container').addEventListener('change', function (e) {
        if (!e.target.matches('.target-select, .is-floating-btn')) return;
        const sourceId = e.target.dataset.sourceId;
        const sourceEngine = engines.find(en => en.id === sourceId);
        if (!sourceEngine) return;

        const newTargets = [];
        $$(`.target-select[data-source-id="${sourceId}"]`).forEach((sel, index) => {
            const targetId = sel.value;
            const checkbox = $(`.is-floating-btn[data-source-id="${sourceId}"][data-target-index="${index}"]`);
            if (targetId) {
                newTargets[index] = { id: targetId, is_floating: checkbox.checked };
                checkbox.disabled = false;
            } else {
                newTargets[index] = null;
                checkbox.checked = false;
                checkbox.disabled = true;
            }
        });
        sourceEngine.allowed_targets = newTargets.filter(t => t !== null);
        saveEngines();
    });

    function saveEngines() {
        chrome.storage.sync.set({ engines: engines });
    }

    $('#edit-engines-btn').addEventListener('click', function () {
        chrome.tabs.create({ url: 'engine_editor.html' });
    });

    restoreOptions();
});
