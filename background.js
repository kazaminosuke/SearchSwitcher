// background.js
importScripts('defaults.js');

// 初回インストール時に、既定エンジン＋「標準」リンク設定をセットしておく。
// これでインストール直後から設定不要で動作する。
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason !== 'install') return;
    chrome.storage.sync.get({ engines: [] }, (items) => {
        if (!items.engines || items.engines.length === 0) {
            chrome.storage.sync.set({
                engines: self.SearchSwitcherDefaults.buildDefaultEngines(),
                buttonPosition: { bottom: 20, right: 20 }
            });
        }
    });
});

// ツールバーアイコンクリックでリンク設定ページを開く。
chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage();
});
