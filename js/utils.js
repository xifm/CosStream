import { RAW_KEY, miHoYoAliasMap } from './config.js';

export function getPureText(str) {
    if (!str) return "";
    return String(str).toLowerCase().replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
}

export function getCoreKeyword(rawStr) {
    let pure = getPureText(rawStr);
    let chMatch = pure.match(/[\u4e00-\u9fa5]{2}/);
    if (chMatch && pure.length >= 4) return chMatch[0]; 
    if (pure.length >= 5) return pure.substring(0, 4);
    return rawStr;
}

export function expandKeyword(rawKeyword) {
    let kw = rawKeyword.toLowerCase().trim().replace(/：/g, ':');
    let pureKw = getPureText(kw);
    let variants = new Set();
    variants.add(kw);
    let dictHit = false;

    for (let key in miHoYoAliasMap) {
        if (pureKw === key || pureKw.includes(key)) {
            miHoYoAliasMap[key].forEach(v => variants.add(v));
            dictHit = true;
        }
    }
    if (!dictHit) {
        let coreKw = getCoreKeyword(kw);
        if (coreKw !== kw) variants.add(coreKw);
        if (/[:,\.\-_|!]/.test(kw)) variants.add(kw.replace(/[:,\.\-_|!]/g, ' '));
    }
    return { words: Array.from(variants).slice(0, 5), needStrictFilter: !dictHit && pureKw.length >= 4 };
}

export function decryptData(encryptedText) { 
    if (!window.CryptoJS) return null;
    const keyMd5 = window.CryptoJS.MD5(RAW_KEY); 
    const keyMd5HexWord = window.CryptoJS.enc.Utf8.parse(keyMd5.toString()); 
    const strategies = [
        { key: keyMd5, mode: window.CryptoJS.mode.ECB, iv: null }, 
        { key: keyMd5, mode: window.CryptoJS.mode.CBC, iv: window.CryptoJS.enc.Hex.parse("00000000000000000000000000000000") }, 
        { key: keyMd5, mode: window.CryptoJS.mode.CBC, iv: keyMd5 }, 
        { key: keyMd5HexWord, mode: window.CryptoJS.mode.ECB, iv: null }
    ]; 
    for (let strat of strategies) { 
        try { 
            let cfg = { mode: strat.mode, padding: window.CryptoJS.pad.Pkcs7 }; 
            if (strat.iv) cfg.iv = strat.iv; 
            let dec1 = window.CryptoJS.AES.decrypt(encryptedText, strat.key, cfg); 
            let str1 = dec1.toString(window.CryptoJS.enc.Utf8); 
            if (str1 && (str1.startsWith("{") || str1.startsWith("["))) return str1; 
            let base64Cipher = window.CryptoJS.enc.Base64.stringify(window.CryptoJS.enc.Hex.parse(encryptedText)); 
            let dec2 = window.CryptoJS.AES.decrypt(base64Cipher, strat.key, cfg); 
            let str2 = dec2.toString(window.CryptoJS.enc.Utf8); 
            if (str2 && (str2.startsWith("{") || str2.startsWith("["))) return str2; 
        } catch (e) {} 
    } 
    return null; 
}

export function formatDuration(sec) { 
    if (sec === undefined || sec === null) return "00:00"; let num = parseFloat(sec); if (isNaN(num)) return "00:00"; 
    let h = Math.floor(num / 3600), m = Math.floor((num % 3600) / 60), s = Math.floor(num % 60); 
    return h > 0 ? `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}` : `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`; 
}

export function formatTime(val) { 
    if (!val) return ""; if (typeof val === 'string') { let match = val.match(/\d{4}-\d{2}-\d{2}/); if (match) return match[0]; } 
    let num = Number(val); if (!isNaN(num)) { if (num < 100000000000) num *= 1000; let d = new Date(num); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; } 
    return String(val).split(' ')[0]; 
}

export function createJumpTags(valStrOrArr, searchType = 'kw', isPink = false) { 
    if (!valStrOrArr || valStrOrArr === "") return ""; let arr = Array.isArray(valStrOrArr) ? valStrOrArr : String(valStrOrArr).split(','); arr = arr.filter(v => v.trim() !== ""); if (arr.length === 0) return ""; 
    return arr.map(v => { 
        let val = v.trim(); 
        let action = searchType === 'tag' ? `event.stopPropagation(); searchByTag('${val}')` : `event.stopPropagation(); executeSearch('${val}')`; 
        if(isPink) return `<a class="jump-link" onclick="${action}">${val}</a>`;
        return `<span class="jump-link-mini" onclick="${action}">${val}</span>`; 
    }).join(isPink ? " " : ""); 
}

export function escapeHtml(str) { return str ? String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;') : "未命名"; }
