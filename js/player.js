import { appState, saveMediaCache, saveCacheToStorage } from './state.js';
import { formatDuration, formatTime, createJumpTags, escapeHtml, decryptData } from './utils.js';

let hlsInstance = null;
let previewHlsInstance = null;
let currentFixedSpeed = 1.0;
let seekSensitivity = 1.0; 

const videoElement = document.getElementById('main-video');
const videoContainer = document.getElementById('video-container'); 
const previewVideo = document.getElementById('preview-video');
const previewToast = document.getElementById('preview-toast');
const previewTimeText = document.getElementById('preview-time-text');
const bMask = document.getElementById('brightness-mask');
const aToast = document.getElementById('action-toast');

let tState = 'idle', startX = 0, startY = 0, lastX = 0, lastTime = 0;
let startVol = 1, startBri = 1, curBri = 1, targetTime = -1, lastPreviewUpdate = 0;
let pressTimer = null, lastTapTime = 0;

function showAction(msg) { aToast.innerText = msg; aToast.style.display = 'block'; }
function hideAction() { aToast.style.display = 'none'; }
function hidePreview() { previewToast.style.display = 'none'; }

// ======= 手势绑定 =======
videoContainer.addEventListener('touchstart', (e) => {
    if(e.touches.length !== 1) return;
    let now = Date.now();
    if (now - lastTapTime < 300) { window.toggleFullScreen(); lastTapTime = 0; e.preventDefault(); return; }
    lastTapTime = now; tState = 'touching'; 
    startX = e.touches[0].clientX; startY = e.touches[0].clientY; lastX = startX; lastTime = now;
    startVol = videoElement.volume; startBri = curBri; targetTime = videoElement.currentTime;
    pressTimer = setTimeout(() => { if(tState === 'touching' && !videoElement.paused) { tState = 'speed'; videoElement.playbackRate = 2.0; showAction(`⏩ 2.0x 快进`); } }, 450); 
}, {passive: false});

videoContainer.addEventListener('touchmove', (e) => {
    if(tState === 'idle') return;
    let curX = e.touches[0].clientX, curY = e.touches[0].clientY;
    let dX_start = curX - startX, dY_start = startY - curY; 
    if(tState === 'touching') { 
        if(Math.abs(dX_start) > 10 || Math.abs(dY_start) > 10) { clearTimeout(pressTimer); if (Math.abs(dX_start) > Math.abs(dY_start)) tState = 'progress'; else tState = 'vol_bright'; } 
    }
    let now = Date.now();
    if(tState === 'vol_bright') {
        if(e.cancelable) e.preventDefault(); 
        let percent = dY_start / (window.innerHeight / 2.5); 
        if(startX > window.innerWidth / 2) { let v = Math.max(0, Math.min(1, startVol + percent)); videoElement.volume = v; showAction(`🔊 音量: ${Math.round(v*100)}%`); } 
        else { let b = Math.max(0.1, Math.min(1, startBri + percent)); curBri = b; bMask.style.background = `rgba(0,0,0,${1 - b})`; showAction(`☀️ 亮度: ${Math.round(b*100)}%`); }
    } else if (tState === 'progress') {
        if(e.cancelable) e.preventDefault();
        let duration = videoElement.duration || 0;
        if (duration > 0) {
            let dt = Math.max(now - lastTime, 1); let dx_frame = curX - lastX; let velocity = Math.abs(dx_frame / dt); 
            let accel = 1.0; if (velocity > 1.2) accel = 1.5; if (velocity > 2.5) accel = 2.5; 
            targetTime += (dx_frame / window.innerWidth) * 90 * seekSensitivity * accel; targetTime = Math.max(0, Math.min(duration, targetTime));
            previewToast.style.display = 'flex'; previewTimeText.innerText = `${formatDuration(targetTime)} / ${formatDuration(duration)}`;
            if (now - lastPreviewUpdate > 200) { previewVideo.currentTime = targetTime; lastPreviewUpdate = now; }
        }
    } else if(tState === 'speed') {
        if(e.cancelable) e.preventDefault();
        let spd = 2.0; if(dY_start > 60) spd = 3.0; else if(dY_start < -60) spd = 1.25; else if(dY_start < -20) spd = 1.5;
        videoElement.playbackRate = spd; showAction(`⏩ ${spd}x 快进`);
    }
    lastX = curX; lastTime = now;
}, {passive: false});

const endTouch = () => { 
    clearTimeout(pressTimer); 
    if(tState === 'speed') { videoElement.playbackRate = currentFixedSpeed; } else if (tState === 'progress' && targetTime >= 0) { videoElement.currentTime = targetTime; }
    tState = 'idle'; hideAction(); hidePreview();
};
videoContainer.addEventListener('touchend', endTouch); videoContainer.addEventListener('touchcancel', endTouch);
videoContainer.addEventListener('dblclick', () => window.toggleFullScreen());

videoElement.onplaying = () => {
    const p = document.getElementById('video-poster'); p.style.opacity = '0';
    setTimeout(() => { if(videoElement.currentTime > 0) p.style.display = 'none'; }, 300);
};

document.addEventListener('click', (e) => { if (!e.target.closest('.dropdown-wrapper')) document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('active')); });

// ======= 全局播放器方法挂载 =======
window.toggleFullScreen = function() { const container = document.getElementById('video-container'); if (!document.fullscreenElement && !document.webkitFullscreenElement) { if (container.requestFullscreen) { container.requestFullscreen(); } else if (container.webkitRequestFullscreen) { container.webkitRequestFullscreen(); } } else { if (document.exitFullscreen) { document.exitFullscreen(); } else if (document.webkitExitFullscreen) { document.webkitExitFullscreen(); } } };
window.toggleSpeedMenu = function() { document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('active')); const m = document.getElementById('speed-menu'); if(m) m.classList.toggle('active'); };
window.setSpeed = function(speed) { currentFixedSpeed = speed; videoElement.playbackRate = speed; const sel = document.getElementById('speed-selector'); if(sel) sel.innerText = `倍速: ${speed.toFixed(1)}x`; document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('active')); };
window.toggleSensMenu = function() { document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('active')); const m = document.getElementById('sens-menu'); if(m) m.classList.toggle('active'); };
window.setSens = function(val, label) { seekSensitivity = val; const sel = document.getElementById('sens-selector'); if(sel) sel.innerText = `滑动: ${label}`; document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('active')); };

window.preparePlayer = function(internalId) {
    let video = appState.videoDataMap[internalId];
    if(!video) { alert("数据加载异常，请刷新网页重试。"); return; }
    if (appState.historyCache[appState.currentStateId]) { appState.historyCache[appState.currentStateId].scrollY = window.scrollY; saveCacheToStorage(); }
    let videoDataStr = encodeURIComponent(JSON.stringify(video));
    history.pushState({ type: 'modal', category: appState.currentCategory, page: appState.currentPage, searchInput: document.getElementById('search-input').value, videoData: videoDataStr, parentStateId: appState.currentStateId }, "", "");
    window.renderAndOpenPlayer(videoDataStr, false);
};

window.renderAndOpenPlayer = function(videoDataStr, fromHistory = false) {
    const modal = document.getElementById('player-modal');
    let video = JSON.parse(decodeURIComponent(videoDataStr));
    let vId = String(video.id || video.vod_id || video.vod_url_id || video.url_id || video.v_id || video.sn || video.number || video.code || '');

    const posterEl = document.getElementById('video-poster');
    posterEl.style.backgroundImage = `url('${video.photo || ''}')`; posterEl.style.display = 'block'; posterEl.style.opacity = '1';

    let domVid = videoElement.getAttribute('data-vid');
    if (fromHistory && domVid === vId && videoElement.src) { modal.classList.add('active'); if (videoElement.currentTime > 0) posterEl.style.display = 'none'; return; }

    videoElement.setAttribute('data-vid', vId); appState.windowCurrentPlayingId = vId; modal.classList.add('active');
    
    document.getElementById('player-title').innerText = escapeHtml(video.title);
    document.getElementById('full-video-title').innerText = escapeHtml(video.title); 
    window.setSpeed(1.0); window.setSens(1.0, '中');

    let rowHtml = ""; const makeRow = (label, val) => { if(val) rowHtml += `<div class="d-label">${label}：</div><div class="d-val">${val}</div>`; };
    makeRow("上架日期", video.adddate || formatTime(video.created_at || video.time || video.vod_time));
    makeRow("番号", createJumpTags(video.code || video.barcode || video.sn || video.number, 'kw', true));
    makeRow("登场人物", createJumpTags(video.actor || video.cos_role || video.stars || video.model, 'kw', true));
    makeRow("作品", createJumpTags(video.work || video.cos_works || video.movie, 'kw', true));
    makeRow("片商", createJumpTags(video.studio || video.maker || video.channel_name || video.author, 'kw', true));
    makeRow("系列", createJumpTags(video.series || video.vod_series, 'kw', true));
    makeRow("标签", createJumpTags(video.tags, 'tag', true));
    document.getElementById('modal-details-grid').innerHTML = rowHtml;

    const routesArea = document.getElementById('route-buttons-area');
    if (appState.mediaCache[vId] && appState.mediaCache[vId].urls && appState.mediaCache[vId].urls.length > 0) {
        routesArea.innerHTML = appState.mediaCache[vId].routesHtml || '';
        window.playVideoRoute(appState.mediaCache[vId].urls[0], false, appState.mediaCache[vId].currentTime || 0);
    } else {
        routesArea.innerHTML = `<div class="spinner" style="width:14px;height:14px;margin-right:4px;"></div><span style="color:var(--text-muted); font-size:13px;">寻址中...</span>`;
        fetchVideoRoutes(vId);
    }
};

async function fetchVideoRoutes(fetchId) {
    const routesArea = document.getElementById('route-buttons-area');
    if (!fetchId || fetchId === 'undefined' || fetchId === 'null' || fetchId.startsWith('vid_')) { routesArea.innerHTML = `<span style="color:#ef4444; font-size:13px;">⚠️ 该视频暂无有效资源源</span>`; return; }
    const token = "CosAppMakeBigMoney," + Math.floor(Date.now() / 1000);
    try {
        const response = await fetch(`https://api.cos-dkop.net/api/app/v1/video/videoinfo?id=${fetchId}`, { method: "GET", headers: { "Content-Type": "application/json", "Tokenparam": token } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const textData = await response.text();
        const json = JSON.parse(textData);
        if (json.code === 200 || json.code === 0) {
            const decryptedStr = decryptData(json.data);
            if (decryptedStr) {
                let parsedData = JSON.parse(decryptedStr);
                if (typeof parsedData.data === 'string' && parsedData.data.trim().startsWith('{')) { try { parsedData.data = JSON.parse(parsedData.data); } catch(e) {} }
                const target = parsedData.data || parsedData.info || parsedData;
                let urlArray = []; let rawUrl = target?.url || target?.video_url || target?.play_url || target?.m3u8 || target?.file || target?.play;
                if (rawUrl) { if (Array.isArray(rawUrl)) urlArray = rawUrl; else if (typeof rawUrl === 'string') urlArray = rawUrl.split(','); else urlArray = [rawUrl]; } 
                else if (Array.isArray(target)) urlArray = target; else if (Array.isArray(target?.list)) urlArray = target.list;

                if (urlArray && urlArray.length > 0) {
                    let btns = "", validCount = 0, firstUrl = ""; 
                    urlArray.forEach((link) => {
                        if (!link) return; 
                        let actualLink = typeof link === 'object' ? (link.url || link.play_url || link.m3u8 || link.file || link.play || (Object.values(link)[0])) : String(link);
                        actualLink = actualLink ? String(actualLink).trim() : '';
                        if(actualLink !== '' && actualLink.length > 5) {
                            let cls = validCount === 0 ? "route-btn" : "route-btn alt";
                            btns += `<button class="${cls}" onclick="playVideoRoute('${actualLink.replace(/'/g, "\\'")}', true, document.getElementById('main-video').currentTime)">▶ 路线 ${validCount + 1}</button>`;
                            if (validCount === 0) { firstUrl = actualLink; if (!appState.mediaCache[fetchId]) appState.mediaCache[fetchId] = {}; appState.mediaCache[fetchId].urls = [actualLink]; }
                            validCount++;
                        }
                    });
                    if (validCount > 0) {
                        btns += `<div class="dropdown-wrapper"><button id="speed-selector" class="route-btn outline" style="width:100%;" onclick="toggleSpeedMenu()">倍速: 1.0x</button><div id="speed-menu" class="dropdown-menu"><div onclick="setSpeed(3.0)">3.0x</div><div onclick="setSpeed(2.0)">2.0x</div><div onclick="setSpeed(1.5)">1.5x</div><div onclick="setSpeed(1.25)">1.25x</div><div onclick="setSpeed(1.0)">正常 1.0x</div></div></div><div class="dropdown-wrapper"><button id="sens-selector" class="route-btn outline" style="width:100%;" onclick="toggleSensMenu()">滑动: 中</button><div id="sens-menu" class="dropdown-menu"><div onclick="setSens(2.0, '快')">高灵敏 (快)</div><div onclick="setSens(1.0, '中')">中灵敏 (中)</div><div onclick="setSens(0.5, '慢')">低灵敏 (慢)</div></div></div><button class="route-btn outline" style="min-width:60px;" onclick="toggleFullScreen()">🔲 全屏</button><button class="route-btn outline" style="min-width:70px;" onclick="downloadVideoUrl()">📥 下载</button>`;
                        routesArea.innerHTML = btns;
                        if (!appState.mediaCache[fetchId]) appState.mediaCache[fetchId] = {};
                        appState.mediaCache[fetchId].routesHtml = btns; saveMediaCache();
                        window.playVideoRoute(firstUrl, false, appState.mediaCache[fetchId].currentTime || 0); return;
                    }
                }
            }
        }
        routesArea.innerHTML = `<span style="color:#ef4444; font-size:13px;">⚠️ 资源已失效或无有效线路</span>`;
    } catch (error) { routesArea.innerHTML = `<span style="color:#f87171; font-size:13px;">❌ 解析失败</span>`; }
}

window.playVideoRoute = function(videoUrl, autoPlay = false, seekTime = 0) {
    appState.currentVideoUrl = videoUrl; 
    if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
    if (previewHlsInstance) { previewHlsInstance.destroy(); previewHlsInstance = null; }
    videoElement.src = ''; previewVideo.src = '';
    
    const onReadyToPlay = () => { if (seekTime > 0) videoElement.currentTime = seekTime; videoElement.playbackRate = currentFixedSpeed; if (autoPlay) videoElement.play().catch(()=>{}); };

    if (videoUrl.includes('.m3u8') && window.Hls && window.Hls.isSupported()) {
        hlsInstance = new window.Hls(); hlsInstance.loadSource(videoUrl); hlsInstance.attachMedia(videoElement);
        hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, onReadyToPlay);
        previewHlsInstance = new window.Hls(); previewHlsInstance.loadSource(videoUrl); previewHlsInstance.attachMedia(previewVideo);
    } else {
        videoElement.src = videoUrl; previewVideo.src = videoUrl; videoElement.addEventListener('loadedmetadata', onReadyToPlay, {once: true});
    }
};

window.downloadVideoUrl = function() {
    if (appState.currentVideoUrl) {
        try { const a = document.createElement('a'); a.href = appState.currentVideoUrl; a.target = "_blank"; let filename = document.getElementById('full-video-title').innerText.replace(/[\\/:*?"<>|]/g, '_'); if(!appState.currentVideoUrl.includes('.m3u8')) filename += '.mp4'; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); } catch(e) { alert("⚠️ 失败，请长按保存。"); }
    } else { alert("⚠️ 视频尚未加载完"); }
};

window.closePlayer = function(fromHistory = false, keepMedia = false) {
    const modal = document.getElementById('player-modal');
    if (modal.classList.contains('active')) {
        modal.classList.remove('active');
        if (document.fullscreenElement || document.webkitFullscreenElement) { if (document.exitFullscreen) document.exitFullscreen(); else if (document.webkitExitFullscreen) document.webkitExitFullscreen(); }
        videoElement.pause(); 
        let currentDOMVid = videoElement.getAttribute('data-vid');
        if (currentDOMVid) { if (!appState.mediaCache[currentDOMVid]) appState.mediaCache[currentDOMVid] = {}; appState.mediaCache[currentDOMVid].currentTime = videoElement.currentTime; saveMediaCache(); }
        if (!keepMedia) { videoElement.src = ''; previewVideo.src = ''; if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; } if (previewHlsInstance) { previewHlsInstance.destroy(); previewHlsInstance = null; } videoElement.removeAttribute('data-vid'); appState.windowCurrentPlayingId = null; }
        if (!fromHistory) history.back(); 
    }
};
