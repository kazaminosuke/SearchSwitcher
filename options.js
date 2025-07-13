// options.js (with Export/Import feature - Full Code)
$(function() {
    let engines = [];
    let linkPresets = {};
    const MAX_TARGETS = 5;

    function restoreOptions() {
        chrome.storage.sync.get({ engines: [], linkPresets: {} }, (items) => {
            if (!items.engines || items.engines.length === 0) {
                $('#link-config-container').html('<p>エンジンが登録されていません。「エンジンリストを管理する」ボタンから、まずはエンジンを追加してください。</p>');
            } else {
                engines = items.engines;
                renderLinkConfigUI();
            }
            linkPresets = items.linkPresets;
            renderCustomPresets();
        });
    }

    function renderLinkConfigUI() {
        const container = $('#link-config-container');
        container.empty();
        engines.forEach(sourceEngine => {
            const row = $('<div class="engine-row"></div>');
            const label = $(`<div class="engine-label"><img src="${sourceEngine.icon}"><span>${sourceEngine.name}</span></div>`);
            const arrow = $('<div class="arrow-separator">→</div>');
            const targetsContainer = $('<div class="targets-container"></div>');
            for (let i = 0; i < MAX_TARGETS; i++) {
                targetsContainer.append(createTargetSelector(sourceEngine, i));
            }
            row.append(label, arrow, targetsContainer);
            container.append(row);
        });
    }

    function createTargetSelector(sourceEngine, index) {
        const selectorContainer = $('<div class="target-selector"></div>');
        const checkbox = $('<input type="checkbox" class="is-floating-btn">').attr({'data-source-id': sourceEngine.id, 'data-target-index': index });
        const select = $('<select class="target-select"></select>').attr({'data-source-id': sourceEngine.id, 'data-target-index': index });
        select.append('<option value="">なし</option>');
        engines.forEach(targetEngine => {
            if (sourceEngine.id === targetEngine.id) return;
            select.append(`<option value="${targetEngine.id}">${targetEngine.name}</option>`);
        });
        const targetInfo = (sourceEngine.allowed_targets && sourceEngine.allowed_targets[index]) ? sourceEngine.allowed_targets[index] : {};
        const targetId = targetInfo.id || "";
        const isFloating = targetInfo.is_floating || false;
        select.val(targetId);
        checkbox.prop('checked', isFloating && !!targetId);
        checkbox.prop('disabled', !targetId);
        selectorContainer.append(checkbox, select);
        return selectorContainer;
    }

    $('.apply-preset-btn').on('click', function() {
        const type = $(this).data('preset-type');
        if (!confirm(`現在のリンク設定が「${$(this).text()}」で上書きされます。よろしいですか？`)) return;
        switch(type) {
            case 'hub-spoke': applyHubSpokePreset('google'); break;
            case 'ring': applyRingPreset(); break;
            case 'full-mesh': applyFullMeshPreset(); break;
        }
        saveEngines();
        renderLinkConfigUI();
    });

    function applyHubSpokePreset(hubId) {
        if (!engines.some(e => e.id === hubId)) hubId = engines[0]?.id;
        if (!hubId) return;
        engines.forEach(engine => {
            if (engine.id === hubId) {
                engine.allowed_targets = engines.filter(e => e.id !== hubId).slice(0, MAX_TARGETS).map(target => ({ id: target.id, is_floating: true }));
            } else {
                engine.allowed_targets = [{ id: hubId, is_floating: true }];
            }
        });
    }

    function applyRingPreset() {
        const engineIds = engines.map(e => e.id);
        if (engineIds.length < 2) return;
        engines.forEach((engine, index) => {
            const nextIndex = (index + 1) % engineIds.length;
            engine.allowed_targets = [{ id: engineIds[nextIndex], is_floating: true }];
        });
    }
    
    function applyFullMeshPreset() {
        engines.forEach(engine => {
            engine.allowed_targets = engines.filter(e => e.id !== engine.id).slice(0, MAX_TARGETS).map(target => ({ id: target.id, is_floating: true }));
        });
    }

    function renderCustomPresets() {
        const select = $('#custom-preset-select');
        select.empty().append('<option value="">-- 保存したプリセット --</option>');
        for (const name in linkPresets) {
            select.append($('<option></option>').val(name).text(name));
        }
    }

    $('#save-custom-preset-btn').on('click', function() {
        const name = $('#custom-preset-name').val().trim();
        if (!name) { alert('プリセット名を入力してください。'); return; }
        const currentLinkConfig = engines.map(e => ({ id: e.id, allowed_targets: e.allowed_targets || [] }));
        linkPresets[name] = currentLinkConfig;
        chrome.storage.sync.set({ linkPresets: linkPresets }, () => {
            alert(`リンク設定「${name}」が保存されました。`);
            $('#custom-preset-name').val('');
            renderCustomPresets();
        });
    });

    $('#load-custom-preset-btn').on('click', function() {
        const name = $('#custom-preset-select').val();
        if (!name) { alert('読み込むプリセットを選択してください。'); return; }
        if (!confirm(`リンク設定が「${name}」の内容で上書きされます。よろしいですか？`)) return;
        const loadedConfig = linkPresets[name];
        engines.forEach(engine => {
            const savedSetting = loadedConfig.find(s => s.id === engine.id);
            engine.allowed_targets = savedSetting ? savedSetting.allowed_targets : [];
        });
        saveEngines();
        renderLinkConfigUI();
    });
    
    $('#delete-custom-preset-btn').on('click', function() {
        const name = $('#custom-preset-select').val();
        if (!name) { alert('削除するプリセットを選択してください。'); return; }
        if (!confirm(`リンク設定プリセット「${name}」を完全に削除します。よろしいですか？`)) return;
        delete linkPresets[name];
        chrome.storage.sync.set({ linkPresets: linkPresets }, () => {
            alert(`プリセット「${name}」が削除されました。`);
            renderCustomPresets();
        });
    });
    
    $('#export-presets-btn').on('click', function() {
        if (Object.keys(linkPresets).length === 0) {
            alert('エクスポートするカスタムプリセットがありません。');
            return;
        }
        const dataStr = JSON.stringify(linkPresets, null, 2);
        const blob = new Blob([dataStr], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'search-switcher-link-presets.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    $('#import-presets-btn').on('click', function() {
        $('#import-file-input').click();
    });
    
    $('#import-file-input').on('change', function(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedPresets = JSON.parse(e.target.result);
                if (typeof importedPresets !== 'object' || importedPresets === null) {
                    throw new Error('無効なファイル形式です。');
                }
                if (!confirm('現在のカスタムプリセットに、インポートした設定をマージ（追加・上書き）します。よろしいですか？')) {
                    $('#import-file-input').val('');
                    return;
                }
                const newPresets = { ...linkPresets, ...importedPresets };
                linkPresets = newPresets;
                chrome.storage.sync.set({ linkPresets: linkPresets }, () => {
                    alert('プリセットが正常にインポートされました。');
                    renderCustomPresets();
                });
            } catch (error) {
                alert('ファイルの読み込みに失敗しました。有効なJSONファイルを選択してください。\nエラー: ' + error.message);
            } finally {
                $('#import-file-input').val('');
            }
        };
        reader.readAsText(file);
    });

    $('#link-config-container').on('change', '.target-select, .is-floating-btn', function() {
        const sourceId = $(this).data('source-id');
        const sourceEngine = engines.find(e => e.id === sourceId);
        if (!sourceEngine) return;
        const new_allowed_targets = [];
        $(`.target-select[data-source-id="${sourceId}"]`).each(function(index) {
            const targetId = $(this).val();
            const checkbox = $(`.is-floating-btn[data-source-id="${sourceId}"][data-target-index="${index}"]`);
            if (targetId) {
                const isFloating = checkbox.is(':checked');
                new_allowed_targets[index] = { id: targetId, is_floating: isFloating };
                checkbox.prop('disabled', false);
            } else {
                 new_allowed_targets[index] = null;
                 checkbox.prop('checked', false).prop('disabled', true);
            }
        });
        sourceEngine.allowed_targets = new_allowed_targets.filter(t => t !== null);
        saveEngines();
    });

    function saveEngines() {
        chrome.storage.sync.set({ engines: engines }, () => {
            console.log("Settings automatically saved:", engines);
        });
    }
    
    $('#edit-engines-btn').on('click', function() {
        chrome.tabs.create({ url: 'engine_editor.html' });
    });

    restoreOptions();
});