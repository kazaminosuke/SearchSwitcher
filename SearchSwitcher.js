// SearchSwitcher.js (Final Optimized Version)

(function() {
    if (window.hasRunSearchSwitcher) return;
    window.hasRunSearchSwitcher = true;

    let config = {
        engines: [],
        buttonPosition: { bottom: 20, right: 20 }
    };
    let currentEngine = null;

    // --- 1. 設定読み込みから6. UI生成までの関数群 (変更なし) ---
    function loadConfig() {
        return new Promise(resolve => {
            chrome.storage.sync.get(['engines', 'buttonPosition'], (items) => {
                if (items.engines && items.engines.length > 0) config.engines = items.engines;
                if (items.buttonPosition) config.buttonPosition = items.buttonPosition;
                resolve();
            });
        });
    }
    function findCurrentEngine() {
        const hostname = location.hostname;
        if (!config.engines) return null;
        return config.engines.find(engine => hostname.includes(engine.host_pattern));
    }
    function getParameterByName(name, urlString) {
        if (!urlString) urlString = window.location.href;
        try {
            const url = new URL(urlString);
            let params = url.searchParams;
            if (url.hash) {
                const hashParams = new URLSearchParams(url.hash.substring(1));
                if (hashParams.has(name)) return hashParams.get(name);
            }
            return params.get(name);
        } catch (e) { return null; }
    }
    function getCurrentSearchType(engine) {
        const urlString = window.location.href;
        const path = window.location.pathname;
        for (const type of ['image', 'video', 'news']) {
            const settings = engine.search_types?.[type];
            if (!settings || !settings.identifier) continue;
            const identifiers = settings.identifier.split(',').map(s => s.trim());
            for (const identifier of identifiers) {
                const [id_type, id_value] = identifier.split(':');
                if (id_type === 'host' && location.hostname.includes(id_value)) return type;
                if (id_type === 'path' && path.includes(id_value)) return type;
                if (id_type === 'param') {
                    const [param_name, param_value] = id_value.split('=');
                    if (getParameterByName(param_name, urlString) === param_value) return type;
                }
            }
        }
        return 'web';
    }
    function generateTargetLinks(currentEngine, currentSearchType, query) {
        if (!query || !currentEngine.allowed_targets || !Array.isArray(currentEngine.allowed_targets)) return [];
        const links = [];
        currentEngine.allowed_targets.forEach(targetInfo => {
            if (!targetInfo || !targetInfo.is_floating) return;
            const targetEngine = config.engines.find(e => e.id === targetInfo.id);
            if (!targetEngine) return;
            const targetTypeSettings = targetEngine.search_types?.[currentSearchType];
            if (targetTypeSettings && targetTypeSettings.url && targetTypeSettings.url.trim() !== '') {
                 const url = targetTypeSettings.url.replace('{q}', encodeURIComponent(query));
                 links.push({ name: `${targetEngine.name}`, url: url, icon: targetEngine.icon });
            } else if (targetEngine.search_types?.web?.url && targetEngine.search_types.web.url.trim() !== '') {
                const url = targetEngine.search_types.web.url.replace('{q}', encodeURIComponent(query));
                links.push({ name: `${targetEngine.name}`, url: url, icon: targetEngine.icon });
            }
        });
        return links;
    }
    function createOrUpdateUI(links) {
        // ボタンが既に存在する場合は、再生成しない（パフォーマンス向上）
        if ($('#search-switcher-container').length > 0) return;
        
        if (links.length === 0) return;
        const container = $('<div id="search-switcher-container"></div>');
        links.forEach(link => {
            const button = $('<a></a>').addClass('switcher-fab').attr({
                'href': link.url,
                'title': `Switch to ${link.name}`
            }).css('background-image', `url("${link.icon}")`);
            container.append(button);
        });
        container.draggable({
            containment: "window", handle: container,
            stop: (event, ui) => {
                const pos = { bottom: $(window).height() - ui.position.top - container.height(), right: $(window).width() - ui.position.left - container.width() };
                chrome.storage.sync.set({ buttonPosition: pos });
            }
        });
        container.css({
            'right': config.buttonPosition.right + 'px',
            'bottom': config.buttonPosition.bottom + 'px',
        });
        $('body').append(container);
    }
    
    // --- メインの実行関数 ---
    const run = () => {
        if (!currentEngine) return;
        let query;
        switch (currentEngine.id) {
            case 'startpage':
                query = $('#q').val() || $('#query').val();
                break;
            case 'wikipedia_ja':
            case 'uncyclopedia_ja':
                const path = window.location.pathname;
                if (path.startsWith('/wiki/')) {
                    query = decodeURIComponent(path.substring(6).replace(/_/g, ' '));
                } else {
                    query = getParameterByName(currentEngine.query_param);
                }
                if (!query) query = $('h1#firstHeading, h1.page-title-main').text();
                if (!query) query = $('#searchInput').val();
                break;
            default:
                query = getParameterByName(currentEngine.query_param);
                break;
        }
        if (!query || query.trim() === '') {
            $('#search-switcher-container').remove();
            return;
        }
        const currentSearchType = getCurrentSearchType(currentEngine);
        const links = generateTargetLinks(currentEngine, currentSearchType, query);
        createOrUpdateUI(links);
    };

    // --- 初期化と監視のロジック (最適化版) ---
    async function initialize() {
        await loadConfig();
        currentEngine = findCurrentEngine();
        if (!currentEngine) return;

        // 1. まず即座に実行を試みる
        run();

        // 2. DOMの変更を監視して、ボタンが消されたら再生成する
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.removedNodes.length) {
                    // bodyから直接削除されたか、または他の要素の子として削除されたか
                    let containerRemoved = Array.from(mutation.removedNodes).some(node => 
                        node.id === 'search-switcher-container' || (node.querySelector && node.querySelector('#search-switcher-container'))
                    );
                    if (containerRemoved && $('#search-switcher-container').length === 0) {
                        run();
                        return; // 一度の変更で複数回実行されるのを防ぐ
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // 3. URL自体が変わった場合（SPAでの画面遷移）も考慮
        let lastUrl = location.href;
        new MutationObserver(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                currentEngine = findCurrentEngine();
                // ページ遷移直後はDOMが不安定なことがあるので少し待つ
                setTimeout(run, 100);
            }
        }).observe(document.head, { childList: true, subtree: true }); // headの変更（titleなど）を監視
    }

    // DOMの準備ができ次第、初期化処理を開始
    $(document).ready(function() {
        // body要素が確実に存在してから監視を開始するために少し待つ
        if (document.body) {
            initialize();
        } else {
            const readyObserver = new MutationObserver(() => {
                if (document.body) {
                    initialize();
                    readyObserver.disconnect();
                }
            });
            readyObserver.observe(document.documentElement, { childList: true });
        }
    });

})();
