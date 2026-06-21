// defaults.js
// 既定の検索エンジンと「標準」リンク設定を一元管理する共有モジュール。
// service worker(background.js) からは importScripts() 経由で、
// 拡張ページ(engine_editor.html / options.html) からは <script> 経由で読み込まれる。
(function (root) {
    function icon(name) { return chrome.runtime.getURL('icons/' + name); }

    // --- 既定エンジン定義 ---
    var DEFAULT_ENGINES = [
        { id: 'google', name: 'Google', host_pattern: '.google.', query_param: 'q', icon: icon('g.png'), search_types: { web: { url: 'https://www.google.com/search?q={q}', identifier: 'param:tbm=' }, image: { url: 'https://www.google.com/search?q={q}&tbm=isch', identifier: 'param:tbm=isch' }, video: { url: 'https://www.google.com/search?q={q}&tbm=vid', identifier: 'param:tbm=vid' }, news: { url: 'https://www.google.com/search?q={q}&tbm=nws', identifier: 'param:tbm=nws' } } },
        { id: 'bing', name: 'Bing', host_pattern: '.bing.com', query_param: 'q', icon: icon('b.png'), search_types: { web: { url: 'https://www.bing.com/search?q={q}', identifier: 'path:/search' }, image: { url: 'https://www.bing.com/images/search?q={q}', identifier: 'path:/images/search' }, video: { url: 'https://www.bing.com/videos/search?q={q}', identifier: 'path:/videos/search' }, news: { url: 'https://www.bing.com/news/search?q={q}', identifier: 'path:/news/search' } } },
        { id: 'duckduckgo', name: 'DuckDuckGo', host_pattern: 'duckduckgo.com', query_param: 'q', icon: icon('ddg.png'), search_types: { web: { url: 'https://duckduckgo.com/?q={q}', identifier: 'param:ia=' }, image: { url: 'https://duckduckgo.com/?q={q}&iax=images&ia=images', identifier: 'param:ia=images' }, video: { url: 'https://duckduckgo.com/?q={q}&iax=videos&ia=videos', identifier: 'param:ia=videos' }, news: { url: 'https://duckduckgo.com/?q={q}&iar=news&ia=news', identifier: 'param:ia=news' } } },
        { id: 'ecosia', name: 'Ecosia', host_pattern: 'ecosia.org', query_param: 'q', icon: icon('ecosia.png'), search_types: { web: { url: 'https://www.ecosia.org/search?q={q}', identifier: 'path:/search' }, image: { url: 'https://www.ecosia.org/images?q={q}', identifier: 'path:/images' }, video: { url: 'https://www.ecosia.org/videos?q={q}', identifier: 'path:/videos' }, news: { url: 'https://www.ecosia.org/news?q={q}', identifier: 'path:/news' } } },
        { id: 'startpage', name: 'Startpage', host_pattern: 'startpage.com', query_param: 'query', icon: icon('startpage.png'), search_types: { web: { url: 'https://www.startpage.com/search?query={q}', identifier: 'path:/search' }, image: { url: 'https://www.startpage.com/search/images?query={q}', identifier: 'path:/images' }, video: { url: 'https://www.startpage.com/search/videos?query={q}', identifier: 'path:/videos' } } },
        { id: 'wikipedia_ja', name: 'Wikipedia (ja)', host_pattern: 'ja.wikipedia.org', query_param: 'search', icon: icon('wikipedia.png'), search_types: { web: { url: 'https://ja.wikipedia.org/w/index.php?search={q}', identifier: 'path:/wiki/,path:/w/index.php' } } },
        { id: 'uncyclopedia_ja', name: 'アンサイクロペディア', host_pattern: 'ansaikuropedia.org', query_param: 'search', icon: icon('uncyclopedia.png'), search_types: { web: { url: 'https://ansaikuropedia.org/index.php?search={q}', identifier: 'path:/wiki/,path:/index.php' } } }
    ];

    // --- 「標準」リンク設定: どのエンジンで、どのエンジンへの切替ボタンを出すか ---
    var DEFAULT_LINKS = {
        google: ['ecosia', 'wikipedia_ja', 'startpage', 'bing'],
        bing: ['startpage', 'google'],
        duckduckgo: ['startpage', 'bing', 'google'],
        ecosia: ['startpage', 'google'],
        startpage: ['ecosia', 'bing', 'google'],
        wikipedia_ja: ['google', 'startpage', 'uncyclopedia_ja'],
        uncyclopedia_ja: ['google', 'startpage', 'wikipedia_ja']
    };

    // 既定エンジンに「標準」リンク設定を適用した、すぐ使える状態のエンジン配列を生成する。
    function buildDefaultEngines() {
        return DEFAULT_ENGINES.map(function (e) {
            return Object.assign({}, e, {
                allowed_targets: (DEFAULT_LINKS[e.id] || []).map(function (id) {
                    return { id: id, is_floating: true };
                })
            });
        });
    }

    root.SearchSwitcherDefaults = {
        DEFAULT_ENGINES: DEFAULT_ENGINES,
        DEFAULT_LINKS: DEFAULT_LINKS,
        buildDefaultEngines: buildDefaultEngines
    };
})(typeof self !== 'undefined' ? self : this);
