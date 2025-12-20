// ==UserScript==
// @name         B站播放列表随机播放
// @namespace    https://github.com/the-lazy-me/BiliBili-RandomVideo
// @version      2.0
// @description  支持获取列表所有视频，自动随机播放下一集，基于 sid 唯一标识，支持记忆播放统计，导出统计报表 (CSV)。作者：Lazy (https://space.bilibili.com/407410594)
// @author       Lazy
// @match        *://www.bilibili.com/video/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        listContainerSelector: '.video-pod',
        videoItemSelector: '.pod-item.video-pod__item',
        activeItemSelector: '.pod-item.video-pod__item.active',
        playlistTitleSelector: '.header-top .left .title',
        amtSelector: '.header-top .left .amt',
        upNameSelector: '.up-name',
        primaryColor: '#fb7299',
    };

    let State = {
        sid: '',
        upName: '未知UP主',
        playlistName: '未知列表',
        remoteTotal: 0,
        isMenuOpen: false,
        isLoading: false,
        isJumping: false,
        autoNext: localStorage.getItem('bili_rand_auto') === 'true',
        data: { videos: [], played: [], history: {}, lastUpdate: '' }
    };

    const ICONS = {
        // 更新为骰子图标
        shuffle: `<svg class="icon" viewBox="0 0 1024 1024" width="32" height="32" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M512 1020.928c-14.848 0-29.696-4.096-41.984-12.288l-392.192-244.224c-20.992-13.312-33.792-35.84-33.792-60.416V307.712c0-25.088 13.312-48.128 34.816-60.928L471.552 12.8c12.288-7.168 26.624-11.264 40.96-11.264s28.672 4.096 40.96 11.264l392.192 234.496c21.504 12.8 34.816 36.352 34.816 60.928v396.288c0 24.576-12.8 47.104-33.792 60.416L553.984 1008.64c-12.8 8.192-27.136 12.288-41.984 12.288z m-394.752-317.952l391.168 243.2c1.536 1.024 2.56 1.024 3.584 1.024 1.024 0 2.048 0 3.584-1.024l391.68-243.2V309.248l-391.168-233.984c-1.536-1.024-2.56-1.024-3.584-1.024-1.024 0-2.048 0-3.584 1.024L117.248 309.248v393.728z"></path><path fill="currentColor" d="M511.488 908.8c-20.48 0-36.864-16.896-36.864-37.376l0.512-258.56c0-20.48 16.384-36.864 36.864-36.864s36.864 16.896 36.864 37.376l-0.512 258.56c0 20.48-16.384 36.864-36.864 36.864zM424.448 544.256c-6.656 0-13.312-1.536-18.944-5.632L154.112 386.048c-17.408-10.752-23.04-33.28-12.288-50.688 10.752-17.408 33.28-23.04 50.688-12.288l251.392 152.576c17.408 10.752 23.04 33.28 12.288 50.688-6.656 11.264-18.944 17.92-31.744 17.92zM596.992 544.256c-12.288 0-24.576-6.144-31.744-17.92-10.752-17.408-5.12-40.448 12.288-50.688L829.44 322.56c17.408-10.752 40.448-5.12 50.688 12.288 10.752 17.408 5.12 40.448-12.288 50.688l-251.392 152.576c-6.144 4.096-12.8 6.144-19.456 6.144zM338.944 290.816c0 25.088 20.48 45.056 45.056 45.056 25.088 0 45.056-20.48 45.056-45.056S409.6 245.76 384.512 245.76c-25.088 0-45.568 19.968-45.568 45.056zM247.808 649.216c0 25.088 20.48 45.056 45.056 45.056s45.056-20.48 45.056-45.056c0-25.088-20.48-45.056-45.056-45.056s-45.056 19.968-45.056 45.056zM589.312 290.816c0 25.088 20.48 45.056 45.056 45.056 25.088 0 45.056-20.48 45.056-45.056s-20.48-45.056-45.056-45.056c-24.576 0-45.056 19.968-45.056 45.056zM603.136 769.024c0 25.088 20.48 45.056 45.056 45.056s45.056-20.48 45.056-45.056c0-25.088-20.48-45.056-45.056-45.056s-45.056 19.968-45.056 45.056zM697.856 649.216c0 25.088 20.48 45.056 45.056 45.056s45.056-20.48 45.056-45.056c0-25.088-20.48-45.056-45.056-45.056s-45.056 19.968-45.056 45.056zM793.088 528.896c0 25.088 20.48 45.056 45.056 45.056 25.088 0 45.056-20.48 45.056-45.056 0-25.088-20.48-45.056-45.056-45.056-24.576 0-45.056 20.48-45.056 45.056z"></path></svg>`,
        load: `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01-.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>`,
        play: `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M8 5v14l11-7L8 5z"/></svg>`,
        close: `<svg viewBox="0 0 24 24" width="32" height="32"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>`
    };

    // --- 核心逻辑 ---

    function updatePageContext() {
        const titleEl = document.querySelector(CONFIG.playlistTitleSelector);
        const amtEl = document.querySelector(CONFIG.amtSelector);
        const upEl = document.querySelector(CONFIG.upNameSelector);

        if (titleEl) {
            State.playlistName = titleEl.textContent.trim();
            const sidMatch = titleEl.href.match(/sid=(\d+)/);
            const newSid = sidMatch ? sidMatch[1] : 'default';
            if (State.sid !== newSid) { State.sid = newSid; loadData(); }
        }
        if (amtEl) {
            const match = amtEl.textContent.match(/\/(\d+)/);
            State.remoteTotal = match ? parseInt(match[1]) : 0;
        }
        if (upEl) State.upName = upEl.textContent.trim();
    }

    function loadData() {
        if (!State.sid) return;
        const saved = localStorage.getItem(`bili_rand_v3_${State.sid}`);
        if (saved) {
            State.data = JSON.parse(saved);
            if (!State.data.history) State.data.history = {};
        } else {
            State.data = { videos: [], played: [], history: {}, lastUpdate: '' };
        }
        recordCurrentPlay();
        updatePanelInfo();
    }

    function recordCurrentPlay() {
        const currentActive = document.querySelector(CONFIG.activeItemSelector);
        if (currentActive) {
            const bvid = currentActive.getAttribute('data-key');
            const title = currentActive.querySelector('.title-txt')?.textContent || '未知标题';
            if (bvid) {
                if (!State.data.history[bvid]) State.data.history[bvid] = { count: 0, last_at: '', title: title };
                if (!window._last_recorded_bvid || window._last_recorded_bvid !== bvid) {
                    State.data.history[bvid].count++;
                    State.data.history[bvid].last_at = new Date().toLocaleString();
                    State.data.history[bvid].title = title;
                    window._last_recorded_bvid = bvid;
                    if (!State.data.played.includes(bvid)) State.data.played.push(bvid);
                    saveData();
                }
            }
        }
    }

    function saveData() {
        if (!State.sid) return;
        State.data.upName = State.upName;
        State.data.playlistName = State.playlistName;
        State.data.lastUpdate = new Date().toLocaleString();
        localStorage.setItem(`bili_rand_v3_${State.sid}`, JSON.stringify(State.data));
    }

    function exportStats() {
        const historyMap = State.data.history;
        const bvidList = Object.keys(historyMap);
        if (bvidList.length === 0) return showToast('暂无播放统计', 'warning');

        let csvContent = "\ufeffBVID,视频标题,播放次数,最后播放时间\n";
        bvidList.sort((a, b) => (historyMap[b].count - historyMap[a].count));
        bvidList.forEach(id => {
            const item = historyMap[id];
            const cleanTitle = (item.title || '未知').replace(/"/g, '""');
            csvContent += `${id},"${cleanTitle}",${item.count},${item.last_at}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const fileName = `播放统计_${State.upName}_${State.playlistName}.csv`.replace(/[\\/:\*\?"<>\|]/g, "_");
        link.href = url;
        link.download = fileName;
        link.click();
        showToast('统计报表已导出', 'success');
    }

    function jumpRandom() {
        if (State.isJumping) return;
        loadData();
        const all = State.data.videos;
        if (all.length === 0) return showToast('请先同步列表', 'warning');
        let pool = all.filter(v => !State.data.played.includes(v.id));
        if (pool.length === 0) {
            showToast('本轮已随机完，重置历史', 'info');
            State.data.played = []; pool = all;
        }
        const target = pool[Math.floor(Math.random() * pool.length)];
        State.isJumping = true;
        showToast(`即将播放: ${target.title}`, 'success');
        setTimeout(() => { window.location.href = `https://www.bilibili.com/video/${target.id}/`; }, 500);
    }

    async function syncList() {
        if (State.isLoading) return;
        const container = document.querySelector(CONFIG.listContainerSelector);
        if (!container) return showToast('未找到容器', 'error');
        State.isLoading = true;
        updateUIStatus();
        showToast('同步中...', 'info');
        let lastCount = 0, retry = 0;
        while (retry < 5) {
            container.scrollTop = container.scrollHeight;
            container.dispatchEvent(new WheelEvent('wheel', { deltaY: 5000, bubbles: true }));
            await new Promise(r => setTimeout(r, 800));
            const items = document.querySelectorAll(CONFIG.videoItemSelector);
            if (items.length === lastCount && items.length >= State.remoteTotal) break;
            if (items.length === lastCount) retry++; else { lastCount = items.length; retry = 0; }
            State.data.videos = Array.from(items).map(el => ({
                id: el.getAttribute('data-key'),
                title: el.querySelector('.title-txt')?.textContent || '未知'
            }));
            updatePanelInfo();
        }
        saveData();
        State.isLoading = false;
        updateUIStatus();
        showToast(`同步成功 (${State.data.videos.length})`, 'success');
    }

    // --- UI 相关 ---

    function createUI() {
        if (document.getElementById('bili-rand-fab')) return;
        const style = document.createElement('style');
        style.innerHTML = `
            #bili-rand-fab { position: fixed; right: 25px; bottom: 80px; z-index: 1000000; display: flex; flex-direction: column; align-items: flex-end; font-family: sans-serif; }
            .rand-panel { background: rgba(255, 255, 255, 0.98); backdrop-filter: blur(25px); border-radius: 16px; width: 260px; padding: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.18); margin-bottom: 15px; border: 1px solid #fff; transform-origin: bottom right; transition: all 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28); display: none; opacity: 0; scale: 0.8; }
            .rand-panel.open { display: block; opacity: 1; scale: 1; }
            .panel-header { font-size: 18px; font-weight: bold; color: #18191c; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; border-left: 4px solid #fb7299; padding-left: 10px; height: 24px; }
            .fab-main { width: 60px; height: 60px; background: ${CONFIG.primaryColor}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 6px 20px rgba(251, 114, 153, 0.4); border: none; }
            .info-card { background: #f1f2f3; border-radius: 10px; padding: 12px; margin-bottom: 15px; font-size: 13px; color: #61666d; line-height: 1.5; }
            .info-card b { color: #18191c; }
            .btn-act { width: 100%; height: 38px; border: none; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 14px; cursor: pointer; margin-top: 8px; color: white; transition: 0.2s; }
            .btn-blue { background: #00aeec; }
            .btn-pink { background: #fb7299; }
            .switch-box { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e3e5e7; font-size: 12px; color: #61666d; }
            .export-link { font-size: 11px; color: #9499a0; cursor: pointer; text-decoration: none; margin-top: 15px; display: block; text-align: center; }
            .export-link:hover { color: #fb7299; text-decoration: underline; }
            .bili-toast { position: fixed; top: 12%; left: 50%; transform: translateX(-50%); padding: 10px 20px; border-radius: 50px; background: rgba(0,0,0,0.85); color: white; z-index: 2000000; font-size: 13px; pointer-events: none; }
        `;
        document.head.appendChild(style);

        const wrapper = document.createElement('div');
        wrapper.id = 'bili-rand-fab';
        wrapper.innerHTML = `
            <div class="rand-panel" id="randPanel">
                <div class="panel-header">随机播放助手</div>
                <div class="info-card">
                    <div style="font-size:12px; margin-bottom:6px; opacity:0.8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" id="ui-list-name">--</div>
                    已记: <b id="ui-total">0</b> | 已播: <b id="ui-played">0</b><br>
                    历史总计点火: <b id="ui-hist-sum">0</b> 次
                </div>
                <button class="btn-act btn-blue" id="btnSync">${ICONS.load} <span>同步列表数据</span></button>
                <button class="btn-act btn-pink" id="btnGo">${ICONS.play} <span>随机跳一集</span></button>
                <div class="switch-box">
                    <span>自动抢先连播 (1.5s)</span>
                    <input type="checkbox" id="ui-auto" ${State.autoNext ? 'checked' : ''}>
                </div>
                <div class="export-link" id="btnExport">导出详细播放统计 (CSV)</div>
            </div>
            <div class="fab-main" id="fabMain">${ICONS.shuffle}</div>
        `;
        document.body.appendChild(wrapper);

        document.getElementById('fabMain').onclick = () => {
            State.isMenuOpen = !State.isMenuOpen;
            document.getElementById('randPanel').classList.toggle('open', State.isMenuOpen);
            document.getElementById('fabMain').innerHTML = State.isMenuOpen ? ICONS.close : ICONS.shuffle;
            if(State.isMenuOpen) { updatePageContext(); updatePanelInfo(); }
        };
        document.getElementById('btnSync').onclick = syncList;
        document.getElementById('btnGo').onclick = jumpRandom;
        document.getElementById('btnExport').onclick = exportStats;
        document.getElementById('ui-auto').onchange = (e) => {
            State.autoNext = e.target.checked;
            localStorage.setItem('bili_rand_auto', State.autoNext);
        };
    }

    function updatePanelInfo() {
        if (!document.getElementById('ui-total')) return;
        document.getElementById('ui-list-name').textContent = `${State.upName} · ${State.playlistName}`;
        document.getElementById('ui-total').textContent = State.data.videos.length;
        document.getElementById('ui-played').textContent = State.data.played.length;
        const totalPlays = Object.values(State.data.history).reduce((sum, item) => sum + (item.count || 0), 0);
        document.getElementById('ui-hist-sum').textContent = totalPlays;
    }

    function updateUIStatus() {
        const btn = document.getElementById('btnSync');
        if (btn) {
            btn.disabled = State.isLoading;
            if (State.isLoading) btn.querySelector('span').textContent = '同步中...';
        }
    }

    function showToast(msg) {
        const t = document.createElement('div');
        t.className = 'bili-toast';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2500);
    }

    function checkAutoNext() {
        if (!location.pathname.startsWith('/video/') || !State.autoNext || State.isJumping) return;
        const video = document.querySelector('video');
        if (video && video.duration && (video.duration - video.currentTime < 1.5)) jumpRandom();
    }

    function init() {
        setInterval(() => {
            if (location.pathname.startsWith('/video/') && document.querySelector(CONFIG.listContainerSelector)) {
                if (!document.getElementById('bili-rand-fab')) createUI();
                updatePageContext();
                recordCurrentPlay();
            }
        }, 2000);
        setInterval(checkAutoNext, 800);
    }

    init();
})();
