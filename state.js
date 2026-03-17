export const appState = {
    MAX_PAGE: 999,
    currentPage: 1,
    currentCategory: 'order=mr',
    isFetching: false,
    historyCache: {},
    currentStateId: 'init',
    mediaCache: {},
    videoDataMap: {},
    windowCurrentPlayingId: null,
    currentVideoUrl: null
};

// 初始化读取 SessionStorage
try { 
    let stored = sessionStorage.getItem('cos_history_cache'); 
    if (stored) appState.historyCache = JSON.parse(stored); 
    let storedMedia = sessionStorage.getItem('cos_media_cache');
    if (storedMedia) appState.mediaCache = JSON.parse(storedMedia);
} catch(e) {}

export function saveCacheToStorage() {
    try {
        let keys = Object.keys(appState.historyCache);
        if (keys.length > 10) { 
            let sortedKeys = keys.sort((a, b) => (parseInt(a.replace('state_', '')) || 0) - (parseInt(b.replace('state_', '')) || 0));
            while(sortedKeys.length > 10) { delete appState.historyCache[sortedKeys.shift()]; }
        }
        sessionStorage.setItem('cos_history_cache', JSON.stringify(appState.historyCache));
    } catch(e) {}
}

export function saveMediaCache() {
    try {
        let keys = Object.keys(appState.mediaCache);
        while (keys.length > 15) { 
            let k = keys.shift();
            if (appState.windowCurrentPlayingId && k === appState.windowCurrentPlayingId) {
                keys.push(k);
                continue;
            }
            delete appState.mediaCache[k];
        }
        sessionStorage.setItem('cos_media_cache', JSON.stringify(appState.mediaCache));
    } catch(e) {}
}
