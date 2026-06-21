// SearchSwitcher.js — vanilla JS (jQuery / jQuery UI への依存を撤廃)
(function () {
    if (window.hasRunSearchSwitcher) return;
    window.hasRunSearchSwitcher = true;

    const config = {
        engines: [],
        buttonPosition: { bottom: 20, right: 20 }
    };
    let currentEngine = null;
    let runTimeout = null;
    let dragState = null;

    // --- 1. 設定読み込み ---
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
        return config.engines.find(engine => hostname.includes(engine.host_pattern)) || null;
    }

    function getParameterByName(name, urlString) {
        if (!urlString) urlString = window.location.href;
        try {
            const url = new URL(urlString);
            if (url.hash) {
                const hashParams = new URLSearchParams(url.hash.substring(1));
                if (hashParams.has(name)) return hashParams.get(name);
            }
            return url.searchParams.get(name);
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

    function generateTargetLinks(sourceEngine, currentSearchType, query) {
        if (!query || !Array.isArray(sourceEngine.allowed_targets)) return [];
        const links = [];
        sourceEngine.allowed_targets.forEach(targetInfo => {
            if (!targetInfo || !targetInfo.is_floating) return;
            const targetEngine = config.engines.find(e => e.id === targetInfo.id);
            if (!targetEngine) return;
            const typeSettings = targetEngine.search_types?.[currentSearchType];
            const webSettings = targetEngine.search_types?.web;
            const chosen = (typeSettings && typeSettings.url && typeSettings.url.trim() !== '')
                ? typeSettings
                : (webSettings && webSettings.url && webSettings.url.trim() !== '' ? webSettings : null);
            if (!chosen) return;
            links.push({
                name: targetEngine.name,
                url: chosen.url.replace('{q}', encodeURIComponent(query)),
                icon: targetEngine.icon
            });
        });
        return links;
    }

    // --- 2. ドラッグ処理（クリックとドラッグを区別する） ---
    function onPointerMove(e) {
        if (!dragState) return;
        const { container, sx, sy, oR, oB } = dragState;
        const dx = e.clientX - sx;
        const dy = e.clientY - sy;
        if (!dragState.dragging && Math.hypot(dx, dy) > 5) dragState.dragging = true;
        if (dragState.dragging) {
            const right = Math.max(0, Math.min(oR - dx, window.innerWidth - container.offsetWidth));
            const bottom = Math.max(0, Math.min(oB - dy, window.innerHeight - container.offsetHeight));
            container.style.right = right + 'px';
            container.style.bottom = bottom + 'px';
        }
    }

    function onPointerUp() {
        if (!dragState) return;
        const c = dragState.container;
        if (dragState.dragging) {
            c._dragged = true;
            config.buttonPosition = { right: parseInt(c.style.right, 10), bottom: parseInt(c.style.bottom, 10) };
            chrome.storage.sync.set({ buttonPosition: config.buttonPosition });
        }
        dragState = null;
    }

    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', onPointerUp, true);

    // --- 3. UI生成 ---
    function createOrUpdateUI(links) {
        const old = document.getElementById('search-switcher-container');
        if (old) old.remove();
        if (links.length === 0) return;

        const container = document.createElement('div');
        container.id = 'search-switcher-container';
        container.style.right = config.buttonPosition.right + 'px';
        container.style.bottom = config.buttonPosition.bottom + 'px';

        links.forEach(link => {
            const a = document.createElement('a');
            a.className = 'switcher-fab';
            a.href = link.url;
            a.title = `Switch to ${link.name}`;
            a.style.backgroundImage = `url("${link.icon}")`;
            a.addEventListener('click', (event) => {
                event.preventDefault();
                if (container._dragged) return; // 直前にドラッグした場合は遷移しない
                window.location.href = a.href;
            });
            container.appendChild(a);
        });

        container.addEventListener('pointerdown', (e) => {
            container._dragged = false;
            dragState = {
                container,
                sx: e.clientX,
                sy: e.clientY,
                oR: parseInt(container.style.right, 10) || config.buttonPosition.right,
                oB: parseInt(container.style.bottom, 10) || config.buttonPosition.bottom,
                dragging: false
            };
        });

        document.body.appendChild(container);
    }

    // --- 4. メインの実行関数 ---
    function run() {
        if (!currentEngine) return;
        let query;
        switch (currentEngine.id) {
            case 'startpage':
                query = document.querySelector('#q')?.value || document.querySelector('#query')?.value;
                break;
            case 'wikipedia_ja':
            case 'uncyclopedia_ja': {
                const path = window.location.pathname;
                if (path.startsWith('/wiki/')) {
                    query = decodeURIComponent(path.substring(6).replace(/_/g, ' '));
                } else {
                    query = getParameterByName(currentEngine.query_param);
                }
                if (!query) query = document.querySelector('h1#firstHeading, h1.page-title-main')?.textContent;
                if (!query) query = document.querySelector('#searchInput')?.value;
                break;
            }
            default:
                query = getParameterByName(currentEngine.query_param);
                break;
        }
        if (!query || query.trim() === '') {
            const el = document.getElementById('search-switcher-container');
            if (el) el.remove();
            return;
        }
        const currentSearchType = getCurrentSearchType(currentEngine);
        const links = generateTargetLinks(currentEngine, currentSearchType, query);
        createOrUpdateUI(links);
    }

    // --- 5. 初期化とSPA向けURL監視 ---
    async function initialize() {
        await loadConfig();
        currentEngine = findCurrentEngine();
        if (!currentEngine) return;
        run();

        let lastUrl = location.href;
        new MutationObserver(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                currentEngine = findCurrentEngine();
                if (runTimeout) clearTimeout(runTimeout);
                runTimeout = setTimeout(run, 300);
            }
        }).observe(document.documentElement, { childList: true, subtree: true });
    }

    if (document.body) {
        initialize();
    } else {
        const readyObserver = new MutationObserver(() => {
            if (document.body) {
                readyObserver.disconnect();
                initialize();
            }
        });
        readyObserver.observe(document.documentElement, { childList: true });
    }
})();
