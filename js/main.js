// js/main.js 完整最终版
import { appState, saveCacheToStorage } from './state.js';
import { expandKeyword, getPureText, formatDuration, formatTime, escapeHtml, createJumpTags, decryptData } from './utils.js';
import { errImg } from './config.js';
import './player.js'; // ⚠️ 核心：导入播放器模块，使其挂载到 window

// 初始化从偏好加载网格
if(localStorage.getItem('cos_layout')) window.setColumns(localStorage.getItem('cos_layout'), false);

const bottomObserver = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) { if(appState.isFetching || appState.currentPage >= appState.MAX_PAGE) return; appState.currentPage++; fetchVideos(appState.currentPage, true); } }, { rootMargin: "600px", threshold: 0.1 });
window.addEventListener('DOMContentLoaded', () => { bottomObserver.observe(document.getElementById('bottom-loading')); });

function pushHistoryState(stateObj) { history.pushState(stateObj, "", ""); }

window.addEventListener('popstate', function(e) {
    if (!e.state) return; const s = e.state;
    if (s.type === 'modal') {
        if (s.parentStateId && appState.historyCache[s.parentStateId]) {
            appState.currentStateId = s.parentStateId; document.getElementById('result').innerHTML = appState.historyCache[s.parentStateId].html;
            appState.videoDataMap = appState.historyCache[s.parentStateId].videoMap; appState.MAX_PAGE = appState.historyCache[s.parentStateId].maxPage; appState.currentPage = appState.historyCache[s.parentStateId].currentPage;
            document.getElementById('current-page-display').innerText = `${appState.currentPage} / ${appState.MAX_PAGE > 999 ? '?' : appState.MAX_PAGE}`;
            requestAnimationFrame(() => { setTimeout(() => { window.scrollTo(0, appState.historyCache[s.parentStateId].scrollY || 0); }, 50); });
        }
        appState.currentCategory = s.category; appState.currentPage = s.page; document.getElementById('search-input').value = s.searchInput || ''; window.renderAndOpenPlayer(s.videoData, true); 
    } else if (s.type === 'list') {
        if (document.getElementById('player-modal').classList.contains('active')) window.closePlayer(true, false);
        appState.currentCategory = s.category; appState.currentPage = s.page; document.getElementById('search-input').value = s.searchInput || '';
        document.querySelectorAll('.nav-bar button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.nav-bar button').forEach(btn => { let onclickAttr = btn.getAttribute('onclick') || ''; if (onclickAttr.includes(`'${appState.currentCategory}'`) || onclickAttr.includes(`"${appState.currentCategory}"`)) btn.classList.add('active'); });
        document.getElementById('current-page-display').innerText = `${appState.currentPage} / ${appState.MAX_PAGE > 999 ? '?' : appState.MAX_PAGE}`;
        appState.currentStateId = s.stateId;
        if (appState.historyCache[appState.currentStateId]) {
            document.getElementById('result').innerHTML = appState.historyCache[appState.currentStateId].html;
            appState.videoDataMap = appState.historyCache[appState.currentStateId].videoMap; appState.MAX_PAGE = appState.historyCache[appState.currentStateId].maxPage; appState.currentPage = appState.historyCache[appState.currentStateId].currentPage;
            requestAnimationFrame(() => { setTimeout(() => { window.scrollTo(0, appState.historyCache[appState.currentStateId].scrollY || 0); }, 50); });
        } else { window.scrollTo({ top: 0, behavior: 'smooth' }); fetchVideos(appState.currentPage, false); }
    }
});

let scrollTimer = null;
window.addEventListener('scroll', () => {
    if(!scrollTimer) {
        scrollTimer = setTimeout(() => {
            if (document.getElementById('player-modal').classList.contains('active')) { scrollTimer = null; return; }
            if (appState.historyCache[appState.currentStateId]) { appState.historyCache[appState.currentStateId].scrollY = window.scrollY; saveCacheToStorage(); }
            scrollTimer = null;
        }, 150);
    }
}, {passive: true});

function executeActionWithClose(actionFn) { if (document.getElementById('player-modal').classList.contains('active')) window.closePlayer(true, true); actionFn(); }

window.switchCategory = function(queryStr, btnElement) { executeActionWithClose(() => { document.querySelectorAll('.nav-bar button').forEach(btn => btn.classList.remove('active')); if(btnElement) btnElement.classList.add('active'); appState.currentCategory = queryStr; appState.currentPage = 1; appState.currentStateId = 'state_' + Date.now(); pushHistoryState({ type: 'list', category: appState.currentCategory, page: appState.currentPage, searchInput: '', stateId: appState.currentStateId }); window.scrollTo({ top: 0, behavior: 'smooth' }); fetchVideos(appState.currentPage, false); }); };
window.executeSearch = function(forcedKeyword) { executeActionWithClose(() => { const keyword = forcedKeyword || document.getElementById('search-input').value.trim(); if (!keyword) return alert('请输入搜索内容！'); document.querySelectorAll('.nav-bar button').forEach(btn => btn.classList.remove('active')); document.getElementById('search-input').value = keyword; appState.currentCategory = `custom_search=${encodeURIComponent(keyword)}`; appState.currentPage = 1; appState.currentStateId = 'state_' + Date.now(); pushHistoryState({ type: 'list', category: appState.currentCategory, page: appState.currentPage, searchInput: keyword, stateId: appState.currentStateId }); window.scrollTo({ top: 0, behavior: 'smooth' }); fetchVideos(appState.currentPage, false); }); };
window.searchByTag = function(tag) { executeActionWithClose(() => { document.querySelectorAll('.nav-bar button').forEach(btn => btn.classList.remove('active')); document.getElementById('search-input').value = tag; appState.currentCategory = `tags=${encodeURIComponent(tag)}`; appState.currentPage = 1; appState.currentStateId = 'state_' + Date.now(); pushHistoryState({ type: 'list', category: appState.currentCategory, page: appState.currentPage, searchInput: tag, stateId: appState.currentStateId }); window.scrollTo({ top: 0, behavior: 'smooth' }); fetchVideos(appState.currentPage, false); }); };
window.setColumns = function(num, save = true) { const grid = document.getElementById('result'); grid.className = 'grid-container'; grid.classList.add(`col-${num}`); document.querySelectorAll('.layout-bar button').forEach(btn => btn.classList.remove('active')); document.getElementById(`btn-col-${num}`).classList.add('active'); if(save) localStorage.setItem('cos_layout', num); };
window.promptJump = function() { let target = prompt(`当前总数 ${appState.MAX_PAGE===999 ? '未知' : appState.MAX_PAGE} 页，请输入跳转页码：`, appState.currentPage); if(target !== null && target.trim() !== '') { let p = parseInt(target); if(p >= 1 && (p <= appState.MAX_PAGE || appState.MAX_PAGE === 999)) { appState.currentPage = p; appState.currentStateId = 'state_' + Date.now(); pushHistoryState({ type: 'list', category: appState.currentCategory, page: appState.currentPage, searchInput: document.getElementById('search-input').value, stateId: appState.currentStateId }); window.scrollTo({ top: 0, behavior: 'smooth' }); fetchVideos(appState.currentPage, false); } else alert("输入非法！"); } };
window.changePage = function(delta) { let newPage = appState.currentPage + delta; if (newPage < 1) return alert("已是第一页！"); if (newPage > appState.MAX_PAGE && appState.MAX_PAGE !== 999) return alert(`⚠️ 到底啦！`); appState.currentPage = newPage; appState.currentStateId = 'state_' + Date.now(); pushHistoryState({ type: 'list', category: appState.currentCategory, page: appState.currentPage, searchInput: document.getElementById('search-input').value, stateId: appState.currentStateId }); window.scrollTo({ top: 0, behavior: 'smooth' }); fetchVideos(appState.currentPage, false); };

async function fetchAndParseAPI(url) {
    const token = "CosAppMakeBigMoney," + Math.floor(Date.now() / 1000);
    try {
        const response = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json", "Tokenparam": token }});
        const json = await response.json();
        
        if (json.code === 200 || json.code === 0) {
            const decryptedStr = decryptData(json.data);
            if (decryptedStr) {
                const parsedData = JSON.parse(decryptedStr); 
                let extractedTotalPages = 0;
                const searchTargets = [parsedData, parsedData.data, parsedData.info, parsedData.list, parsedData.page, json, json.data];
                
                for (let obj of searchTargets) {
                    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) continue;
                    for (let field of ['last_page', 'total_page', 'totalPage', 'pages', 'pagecount', 'max_page']) { 
                        if (obj[field] !== undefined) { extractedTotalPages = Number(obj[field]); break; } 
                    }
                    if (extractedTotalPages > 0) break;
                    for (let field of ['total', 'count', 'totalCount', 'total_num', 'totalcnt', 'totalCnt']) {
                        if (obj[field] !== undefined) {
                            let totalVal = Number(obj[field]); let limit = Number(obj.limit || 30);
                            if (totalVal > 0) { 
                                extractedTotalPages = (Math.ceil(totalVal/limit) < appState.currentPage && totalVal >= appState.currentPage) ? totalVal : Math.ceil(totalVal / limit); 
                                break; 
                            }
                        }
                    }
                    if (extractedTotalPages > 0) break;
                }

                let videoList = Array.isArray(parsedData) ? parsedData : (parsedData.list || (parsedData.data && parsedData.data.list) || parsedData.data || parsedData.info || []);
                return { 
                    list: videoList, 
                    maxPage: extractedTotalPages > 0 ? extractedTotalPages : (videoList.length === 30 ? 999 : appState.currentPage) 
                };
            }
        }
    } catch (error) { /* 容错忽略单个网络波动 */ }
    return { list: [], maxPage: 0 };
}

async function fetchVideos(pageNumber, isAppend = false) {
    if(appState.isFetching) return; appState.isFetching = true;
    let fetchStateId = appState.currentStateId;
    const resultDiv = document.getElementById("result"), statusMsg = document.getElementById("status-msg"), pageDisplay = document.getElementById('current-page-display'), bottomLoading = document.getElementById('bottom-loading');
    
    if(!isAppend) { resultDiv.innerHTML = ""; statusMsg.innerHTML = `<div class="spinner"></div>全网检索中...`; bottomLoading.style.display = "none"; appState.videoDataMap = {};} 
    else { bottomLoading.style.display = "block"; }
    pageDisplay.innerText = `${pageNumber} / 加载中`;

    let apiPage = pageNumber - 1; if(apiPage < 0) apiPage = 0;
    let finalVideoList = []; let maxCalculatedPage = 0;

    if (appState.currentCategory.startsWith('custom_search=')) {
        let rawKeyword = decodeURIComponent(appState.currentCategory.split('=')[1]);
        let pureTarget = getPureText(rawKeyword); 
        let expansion = expandKeyword(rawKeyword);
        let fetchPromises = [];
        expansion.words.forEach(kw => { let limitFetch = expansion.needStrictFilter ? 60 : 30; let encodedKw = encodeURIComponent(kw); fetchPromises.push(fetchAndParseAPI(`https://api.cos-dkop.net/api/app/v1/video/lists?kw=${encodedKw}&page=${apiPage}&limit=${limitFetch}`)); fetchPromises.push(fetchAndParseAPI(`https://api.cos-dkop.net/api/app/v1/video/lists?tags=${encodedKw}&page=${apiPage}&limit=${limitFetch}`)); });
        
        let results = await Promise.all(fetchPromises);
        let combinedRawList = []; results.forEach(res => { combinedRawList.push(...res.list); maxCalculatedPage = Math.max(maxCalculatedPage, res.maxPage); });
        
        let uniqueSet = new Set();
        combinedRawList.forEach(video => {
            let vId = String(video.id || video.vod_id || video.vod_url_id || video.url_id || video.sn || video.number || '');
            if (!vId || uniqueSet.has(vId)) return;
            if (expansion.needStrictFilter) { let videoAllText = getPureText(video.title) + getPureText(video.tags) + getPureText(video.cos_works) + getPureText(video.cos_role); if (!videoAllText.includes(pureTarget) && !pureTarget.includes(videoAllText)) return; }
            uniqueSet.add(vId); finalVideoList.push(video);
        });
        maxCalculatedPage = finalVideoList.length > 0 ? appState.currentPage + 1 : appState.currentPage;
    } else {
        const apiUrl = `https://api.cos-dkop.net/api/app/v1/video/lists?${appState.currentCategory}&page=${apiPage}&limit=30`;
        let res = await fetchAndParseAPI(apiUrl); finalVideoList = res.list; maxCalculatedPage = res.maxPage;
    }

    appState.MAX_PAGE = maxCalculatedPage;
    if (appState.MAX_PAGE < appState.currentPage && finalVideoList.length > 0) appState.MAX_PAGE = appState.currentPage + 1;
    pageDisplay.innerText = `${appState.currentPage} / ${appState.MAX_PAGE === 999 ? '?' : appState.MAX_PAGE}`;

    if(finalVideoList.length === 0) { if(!isAppend) statusMsg.innerHTML = "📭 全库未命中"; bottomLoading.style.display = "none"; appState.isFetching = false; return; }
    
    statusMsg.innerHTML = ""; bottomLoading.style.display = (appState.currentPage < appState.MAX_PAGE) ? "block" : "none";
    let html = '';
    finalVideoList.forEach(video => {
        let internalId = video.id || video.vod_id || video.vod_url_id || video.url_id || video.v_id || video.sn || video.number || ('vid_' + Math.random().toString(36).substr(2, 9));
        appState.videoDataMap[internalId] = video; 
        
        let badgeHtml = "";
        if (video.duration) badgeHtml += `<div class="badge duration">${formatDuration(video.duration)}</div>`;
        if (video.is_vip === "1" || video.is_vip === true || (video.tags && video.tags.includes('独家'))) badgeHtml += `<div class="badge vip">VIP独家</div>`;
        badgeHtml += `<div class="badge channel">${video.channel_name || "同人"}</div>`;

        // ⚠️ 终极修复：绝对指向 window.preparePlayer
        html += `<div class="video-card" onclick="window.preparePlayer('${internalId}')"><div class="thumb-wrapper"><img class="thumb-bg" src="${video.photo || ''}" onerror="this.src='${errImg}'"><img class="thumb-img" src="${video.photo || ''}" onerror="this.src='${errImg}'">${badgeHtml}</div><div class="card-content"><h4 class="video-title" title="${escapeHtml(video.title)}">${escapeHtml(video.title)}</h4><div class="time-row"><span>📅 ${video.adddate || formatTime(video.created_at || video.time || video.vod_time)}</span>${video.addtime ? `<span>🕒 ${video.addtime}</span>` : ""}</div><div class="tag-row">${createJumpTags(video.cos_works, 'kw') + createJumpTags(video.cos_role || video.actor, 'kw')}</div></div></div>`;
    });
    
    if(isAppend) resultDiv.insertAdjacentHTML('beforeend', html); else resultDiv.innerHTML = html;
    appState.historyCache[fetchStateId] = { html: resultDiv.innerHTML, videoMap: Object.assign({}, appState.videoDataMap), maxPage: appState.MAX_PAGE, currentPage: appState.currentPage, scrollY: window.scrollY };
    saveCacheToStorage(); appState.isFetching = false;
}

window.onload = function() {
    if (history.state && history.state.type === 'list' && history.state.stateId) {
        appState.currentStateId = history.state.stateId; appState.currentCategory = history.state.category || 'order=mr'; appState.currentPage = history.state.page || 1;
        if (appState.historyCache[appState.currentStateId]) {
            const cache = appState.historyCache[appState.currentStateId];
            document.getElementById('result').innerHTML = cache.html; appState.videoDataMap = cache.videoMap; appState.MAX_PAGE = cache.maxPage; appState.currentPage = cache.currentPage;
            document.getElementById('current-page-display').innerText = `${appState.currentPage} / ${appState.MAX_PAGE > 999 ? '?' : appState.MAX_PAGE}`;
            document.querySelectorAll('.nav-bar button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.nav-bar button').forEach(btn => { let onclickAttr = btn.getAttribute('onclick') || ''; if (onclickAttr.includes(`'${appState.currentCategory}'`) || onclickAttr.includes(`"${appState.currentCategory}"`)) btn.classList.add('active'); });
            requestAnimationFrame(() => { setTimeout(() => { window.scrollTo(0, cache.scrollY || 0); }, 50); }); return; 
        }
    }
    appState.currentStateId = 'state_' + Date.now();
    history.replaceState({ type: 'list', category: appState.currentCategory, page: appState.currentPage, searchInput: '', stateId: appState.currentStateId }, "", "");
    fetchVideos(1, false);
};
