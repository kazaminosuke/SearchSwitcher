// engine_editor.js (Redesigned Preset Logic)
$(function() {
    let engines = [];
    let iconDataUrl = null;

    const defaultPresets = [
        { key: 'google', name: 'Google', host_pattern: '.google.', query_param: 'q', icon: chrome.runtime.getURL('icons/g.png'), search_types: { web: { url: 'https://www.google.com/search?q={q}', identifier: 'param:tbm=' }, image: { url: 'https://www.google.com/search?q={q}&tbm=isch', identifier: 'param:tbm=isch' }, video: { url: 'https://www.google.com/search?q={q}&tbm=vid', identifier: 'param:tbm=vid' }, news: { url: 'https://www.google.com/search?q={q}&tbm=nws', identifier: 'param:tbm=nws' }}},
        { key: 'bing', name: 'Bing', host_pattern: '.bing.com', query_param: 'q', icon: chrome.runtime.getURL('icons/b.png'), search_types: { web: { url: 'https://www.bing.com/search?q={q}', identifier: 'path:/search' }, image: { url: 'https://www.bing.com/images/search?q={q}', identifier: 'path:/images/search' }, video: { url: 'https://www.bing.com/videos/search?q={q}', identifier: 'path:/videos/search' }, news: { url: 'https://www.bing.com/news/search?q={q}', identifier: 'path:/news/search' }}},
        { key: 'duckduckgo', name: 'DuckDuckGo', host_pattern: 'duckduckgo.com', query_param: 'q', icon: chrome.runtime.getURL('icons/ddg.png'), search_types: { web: { url: 'https://duckduckgo.com/?q={q}', identifier: 'param:ia=' }, image: { url: 'https://duckduckgo.com/?q={q}&iax=images&ia=images', identifier: 'param:ia=images' }, video: { url: 'https://duckduckgo.com/?q={q}&iax=videos&ia=videos', identifier: 'param:ia=videos' }, news: { url: 'https://duckduckgo.com/?q={q}&iar=news&ia=news', identifier: 'param:ia=news' }}},
        { key: 'ecosia', name: 'Ecosia', host_pattern: 'ecosia.org', query_param: 'q', icon: chrome.runtime.getURL('icons/ecosia.png'), search_types: { web: { url: 'https://www.ecosia.org/search?q={q}', identifier: 'path:/search' }, image: { url: 'https://www.ecosia.org/images?q={q}', identifier: 'path:/images' }, video: { url: 'https://www.ecosia.org/videos?q={q}', identifier: 'path:/videos' }, news: { url: 'https://www.ecosia.org/news?q={q}', identifier: 'path:/news' }}},
        { key: 'startpage', name: 'Startpage', host_pattern: 'startpage.com', query_param: 'query', icon: chrome.runtime.getURL('icons/startpage.png'), search_types: { web: { url: 'https://www.startpage.com/search?query={q}', identifier: 'path:/search' }, image: { url: 'https://www.startpage.com/search/images?query={q}', identifier: 'path:/images' }, video: { url: 'https://www.startpage.com/search/videos?query={q}', identifier: 'path:/videos' }}},
        { key: 'wikipedia_ja', name: 'Wikipedia (ja)', host_pattern: 'ja.wikipedia.org', query_param: 'search', icon: chrome.runtime.getURL('icons/wikipedia.png'), search_types: { web: { url: 'https://ja.wikipedia.org/w/index.php?search={q}', identifier: 'path:/wiki/,path:/w/index.php' }}},
        { key: 'uncyclopedia_ja', name: 'アンサイクロペディア', host_pattern: 'ansaikuropedia.org', query_param: 'search', icon: chrome.runtime.getURL('icons/uncyclopedia.png'), search_types: { web: { url: 'https://ansaikuropedia.org/index.php?search={q}', identifier: 'path:/wiki/,path:/index.php' }}}
    ];

    function restoreEngines() {
        chrome.storage.sync.get({ engines: [] }, (items) => {
            engines = items.engines;
            renderTable();
            renderPresets();
        });
    }

    function renderTable() {
        const tbody = $('#engine-list tbody');
        tbody.empty();
        engines.forEach((engine, index) => {
            const row = $(`<tr><td>${engine.name}</td><td>${engine.id}</td><td>${engine.host_pattern}</td><td><img src="${engine.icon}" alt="${engine.name} icon"></td><td><button class="edit-btn" data-index="${index}">編集</button><button class="delete-btn" data-index="${index}">削除</button></td></tr>`);
            tbody.append(row);
        });
    }
    
    function renderPresets() {
        const container = $('#preset-container');
        container.empty();
        const registeredIds = new Set(engines.map(e => e.id));
        defaultPresets.forEach(preset => {
            const card = $(`<div class="preset-card"><img src="${preset.icon}" alt="${preset.name}"><div>${preset.name}</div><button class="add-preset-btn" data-preset-key="${preset.key}" ${registeredIds.has(preset.key) ? 'disabled' : ''}>${registeredIds.has(preset.key) ? '追加済み' : '追加'}</button></div>`);
            container.append(card);
        });
    }

    $('#preset-container').on('click', '.add-preset-btn:not(:disabled)', function() {
        const presetKey = $(this).data('preset-key');
        const presetToAdd = defaultPresets.find(p => p.key === presetKey);
        if (presetToAdd && !engines.some(e => e.id === presetKey)) {
             const newEngine = { ...presetToAdd, id: presetKey, key: undefined, allowed_targets: [] };
            engines.push(newEngine);
            saveAndRerender();
        }
    });

    function clearForm() {
        $('#engine-form')[0].reset();
        $('#engine-id-hidden').val('');
        $('#id').val('').prop('disabled', false);
        iconDataUrl = null;
    }

    $('#icon').on('change', function(event) {
        const file = event.target.files[0];
        if (!file) { iconDataUrl = null; return; }
        const reader = new FileReader();
        reader.onload = (e) => { iconDataUrl = e.target.result; };
        reader.readAsDataURL(file);
    });

    $('#engine-form').on('submit', function(e) {
        e.preventDefault();
        const engineId = $('#id').val().trim();
        const hiddenId = $('#engine-id-hidden').val();
        if (!engineId) { alert('ユニークIDは必須です。'); return; }

        if (!hiddenId && engines.some(e => e.id === engineId)) {
            alert('このユニークIDは既に使用されています。別のIDを入力してください。');
            return;
        }

        const engineData = {
            id: engineId, name: $('#name').val(), host_pattern: $('#host_pattern').val(), query_param: $('#query_param').val(),
            search_types: {
                web: { url: $('#web_search_url').val(), identifier: $('#web_identifier').val() },
                image: { url: $('#image_search_url').val(), identifier: $('#image_identifier').val() },
                video: { url: $('#video_search_url').val(), identifier: $('#video_identifier').val() },
                news: { url: $('#news_search_url').val(), identifier: $('#news_identifier').val() }
            }
        };

        const existingIndex = engines.findIndex(eng => eng.id === hiddenId);

        if (existingIndex > -1) {
            const oldEngine = engines[existingIndex];
            engines[existingIndex] = { ...oldEngine, ...engineData };
            if (iconDataUrl) engines[existingIndex].icon = iconDataUrl;
        } else {
            engineData.icon = iconDataUrl || chrome.runtime.getURL('icons/default.png');
            engineData.allowed_targets = [];
            engines.push(engineData);
        }
        saveAndRerender('設定が正常に保存されました。');
    });

    $('#engine-list').on('click', '.edit-btn', function() {
        const index = $(this).data('index');
        const engine = engines[index];
        clearForm();
        $('#engine-id-hidden').val(engine.id);
        $('#id').val(engine.id).prop('disabled', true);
        $('#name').val(engine.name);
        $('#host_pattern').val(engine.host_pattern);
        $('#query_param').val(engine.query_param);
        if (engine.search_types) {
            $('#web_search_url').val(engine.search_types.web?.url || ''); $('#web_identifier').val(engine.search_types.web?.identifier || '');
            $('#image_search_url').val(engine.search_types.image?.url || ''); $('#image_identifier').val(engine.search_types.image?.identifier || '');
            $('#video_search_url').val(engine.search_types.video?.url || ''); $('#video_identifier').val(engine.search_types.video?.identifier || '');
            $('#news_search_url').val(engine.search_types.news?.url || ''); $('#news_identifier').val(engine.search_types.news?.identifier || '');
        }
        iconDataUrl = null;
        $('html, body').animate({ scrollTop: $('.form-section-wrapper').first().offset().top }, 'fast');
    });

    $('#engine-list').on('click', '.delete-btn', function() {
        if (!confirm('このエンジンを削除します。リンク設定からも削除されます。よろしいですか？')) return;
        const index = $(this).data('index');
        const deletedEngineId = engines[index].id;
        engines.splice(index, 1);
        engines.forEach(engine => {
            if (engine.allowed_targets) {
                engine.allowed_targets = engine.allowed_targets.filter(target => target.id !== deletedEngineId);
            }
        });
        saveAndRerender('エンジンが削除されました。');
    });
    
    function saveAndRerender(message = null) {
        chrome.storage.sync.set({ engines: engines }, () => {
            if (message) {
                $('#status').text(message).fadeIn().delay(2000).fadeOut();
            }
            clearForm();
            restoreEngines(); // 変更を保存した後に、テーブルとプリセットの状態を再描画
        });
    }

    $('#clear-form').on('click', clearForm);
    restoreEngines();
});