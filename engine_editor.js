// engine_editor.js — vanilla JS
document.addEventListener('DOMContentLoaded', function () {
    let engines = [];
    let iconDataUrl = null;
    const defaultPresets = self.SearchSwitcherDefaults.DEFAULT_ENGINES;

    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

    function restoreEngines() {
        chrome.storage.sync.get({ engines: [] }, (items) => {
            engines = items.engines;
            renderTable();
            renderPresets();
        });
    }

    function renderTable() {
        const tbody = $('#engine-list tbody');
        tbody.innerHTML = '';
        engines.forEach((engine, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML =
                `<td></td><td></td><td></td><td><img alt=""></td>` +
                `<td><button class="edit-btn" data-index="${index}">編集</button>` +
                `<button class="delete-btn" data-index="${index}">削除</button></td>`;
            const tds = tr.children;
            tds[0].textContent = engine.name;
            tds[1].textContent = engine.id;
            tds[2].textContent = engine.host_pattern;
            tds[3].firstChild.src = engine.icon;
            tds[3].firstChild.alt = engine.name + ' icon';
            tbody.appendChild(tr);
        });
    }

    function renderPresets() {
        const container = $('#preset-container');
        container.innerHTML = '';
        const registeredIds = new Set(engines.map(e => e.id));
        defaultPresets.forEach(preset => {
            const added = registeredIds.has(preset.id);
            const card = document.createElement('div');
            card.className = 'preset-card';
            card.innerHTML =
                `<img alt=""><div></div>` +
                `<button class="add-preset-btn" data-preset-id="${preset.id}" ${added ? 'disabled' : ''}>` +
                `${added ? '追加済み' : '追加'}</button>`;
            card.querySelector('img').src = preset.icon;
            card.querySelector('img').alt = preset.name;
            card.querySelector('div').textContent = preset.name;
            container.appendChild(card);
        });
    }

    $('#preset-container').addEventListener('click', function (e) {
        const btn = e.target.closest('.add-preset-btn');
        if (!btn || btn.disabled) return;
        const presetId = btn.dataset.presetId;
        const presetToAdd = defaultPresets.find(p => p.id === presetId);
        if (presetToAdd && !engines.some(e2 => e2.id === presetId)) {
            engines.push(Object.assign({}, presetToAdd, { allowed_targets: [] }));
            saveAndRerender();
        }
    });

    function clearForm() {
        $('#engine-form').reset();
        $('#engine-id-hidden').value = '';
        const idInput = $('#id');
        idInput.value = '';
        idInput.disabled = false;
        iconDataUrl = null;
    }

    $('#icon').addEventListener('change', function (event) {
        const file = event.target.files[0];
        if (!file) { iconDataUrl = null; return; }
        const reader = new FileReader();
        reader.onload = (e) => { iconDataUrl = e.target.result; };
        reader.readAsDataURL(file);
    });

    $('#engine-form').addEventListener('submit', function (e) {
        e.preventDefault();
        const engineId = $('#id').value.trim();
        const hiddenId = $('#engine-id-hidden').value;
        if (!engineId) { alert('ユニークIDは必須です。'); return; }
        if (!hiddenId && engines.some(en => en.id === engineId)) {
            alert('このユニークIDは既に使用されています。別のIDを入力してください。');
            return;
        }

        const engineData = {
            id: engineId,
            name: $('#name').value,
            host_pattern: $('#host_pattern').value,
            query_param: $('#query_param').value,
            search_types: {
                web: { url: $('#web_search_url').value, identifier: $('#web_identifier').value },
                image: { url: $('#image_search_url').value, identifier: $('#image_identifier').value },
                video: { url: $('#video_search_url').value, identifier: $('#video_identifier').value },
                news: { url: $('#news_search_url').value, identifier: $('#news_identifier').value }
            }
        };

        const existingIndex = engines.findIndex(eng => eng.id === hiddenId);
        if (existingIndex > -1) {
            engines[existingIndex] = Object.assign({}, engines[existingIndex], engineData);
            if (iconDataUrl) engines[existingIndex].icon = iconDataUrl;
        } else {
            engineData.icon = iconDataUrl || chrome.runtime.getURL('icons/default.png');
            engineData.allowed_targets = [];
            engines.push(engineData);
        }
        saveAndRerender('設定が正常に保存されました。');
    });

    $('#engine-list').addEventListener('click', function (e) {
        const editBtn = e.target.closest('.edit-btn');
        const delBtn = e.target.closest('.delete-btn');

        if (editBtn) {
            const engine = engines[editBtn.dataset.index];
            clearForm();
            $('#engine-id-hidden').value = engine.id;
            const idInput = $('#id');
            idInput.value = engine.id;
            idInput.disabled = true;
            $('#name').value = engine.name;
            $('#host_pattern').value = engine.host_pattern;
            $('#query_param').value = engine.query_param;
            const st = engine.search_types || {};
            $('#web_search_url').value = st.web?.url || ''; $('#web_identifier').value = st.web?.identifier || '';
            $('#image_search_url').value = st.image?.url || ''; $('#image_identifier').value = st.image?.identifier || '';
            $('#video_search_url').value = st.video?.url || ''; $('#video_identifier').value = st.video?.identifier || '';
            $('#news_search_url').value = st.news?.url || ''; $('#news_identifier').value = st.news?.identifier || '';
            iconDataUrl = null;
            $('.form-section-wrapper').scrollIntoView({ behavior: 'smooth' });
            return;
        }

        if (delBtn) {
            if (!confirm('このエンジンを削除します。リンク設定からも削除されます。よろしいですか？')) return;
            const index = delBtn.dataset.index;
            const deletedEngineId = engines[index].id;
            engines.splice(index, 1);
            engines.forEach(engine => {
                if (engine.allowed_targets) {
                    engine.allowed_targets = engine.allowed_targets.filter(t => t.id !== deletedEngineId);
                }
            });
            saveAndRerender('エンジンが削除されました。');
        }
    });

    function saveAndRerender(message) {
        chrome.storage.sync.set({ engines: engines }, () => {
            if (message) {
                const status = $('#status');
                status.textContent = message;
                status.style.display = 'block';
                setTimeout(() => { status.style.display = 'none'; }, 2000);
            }
            clearForm();
            restoreEngines();
        });
    }

    $('#clear-form').addEventListener('click', clearForm);
    restoreEngines();
});
