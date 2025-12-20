// ==UserScript==
// @name         B站播放列表随机播放
// @namespace    https://github.com/the-lazy-me/BiliBili-RandomVideo
// @version      2.1
// @description  支持获取列表所有视频，自动随机播放下一集，支持记忆播放统计，导出统计报表 (CSV)。
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
        activeItemSelector: '.pod-item.active', 
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
            // 兼容 sid= 和 list=
            const sidMatch = titleEl.href.match(/[?&](sid|list)=(\d+)/);
            const newSid = sidMatch ? sidMatch[2] : 'default';
            if (State.sid !== newSid) {
                console.log("[RandVideo] 切换 SID:", newSid);
                State.sid = newSid;
                loadData();
            }
        }
        if (amtEl) {
            const match = amtEl.textContent.match(/\/(\d+)/);
            State.remoteTotal = match ? parseInt(match[1]) : 0;
        }
        if (upEl) State.upName = upEl.textContent.trim();
    }

    function loadData() {
        if (!State.sid) return;
        const key = `bili_rand_v3_${State.sid}`;
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                State.data = JSON.parse(saved);
                if (!State.data.history) State.data.history = {};
                if (!State.data.played) State.data.played = [];
                if (!State.data.videos) State.data.videos = [];
            } catch (e) { console.error("解析存档失败", e); }
        } else {
            State.data = { videos: [], played: [], history: {}, lastUpdate: '' };
        }
        updatePanelInfo();
    }

    function recordCurrentPlay() {
        if (!State.sid) return;

        // 获取当前 BVID 的多种途径
        let bvid = null;
        // 1. 从 URL 抓取 (最可靠)
        const urlMatch = window.location.pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/);
        if (urlMatch) bvid = urlMatch[1];

        if (!bvid) {
            // 2. 从列表中抓取 active
            const activeEl = document.querySelector(CONFIG.activeItemSelector);
            bvid = activeEl?.getAttribute('data-key');
        }

        if (bvid) {
            // 只有当 BVID 改变时才记录，防止重复点火
            if (window._last_recorded_bvid !== bvid) {
                if (!State.data.history[bvid]) {
                    State.data.history[bvid] = { count: 0, last_at: '', title: '' };
                }

                // 尝试更新标题
                const activeEl = document.querySelector(CONFIG.activeItemSelector);
                const title = activeEl?.querySelector('.title-txt')?.textContent || document.title.replace('_哔哩哔哩_bilibili', '');

                State.data.history[bvid].count++;
                State.data.history[bvid].last_at = new Date().toLocaleString();
                State.data.history[bvid].title = title;

                // 加入已播列表（用于去重随机）
                if (!State.data.played.includes(bvid)) {
                    State.data.played.push(bvid);
                }

                window._last_recorded_bvid = bvid;
                console.log(`[RandVideo] 成功记录播放: ${bvid}, 次数: ${State.data.history[bvid].count}`);
                saveData();
                updatePanelInfo();
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
        if (bvidList.length === 0) return showToast('暂无播放统计');

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
        const fileName = `统计_${State.upName}_${State.playlistName}.csv`.replace(/[\\/:\*\?"<>\|]/g, "_");
        link.href = url;
        link.download = fileName;
        link.click();
    }

    function jumpRandom() {
        if (State.isJumping) return;
        loadData();
        const all = State.data.videos;
        if (all.length === 0) return showToast('请先点击同步列表');

        // 过滤掉本轮已播的
        let pool = all.filter(v => !State.data.played.includes(v.id));

        // 如果全部播完了，清空已播记录，重新开始一轮
        if (pool.length === 0) {
            showToast('本轮已全部随机完，重置进度');
            State.data.played = [];
            pool = all;
            saveData();
        }

        const target = pool[Math.floor(Math.random() * pool.length)];
        State.isJumping = true;
        showToast(`随机跳转: ${target.title}`);
        setTimeout(() => { window.location.href = `https://www.bilibili.com/video/${target.id}/`; }, 800);
    }

    async function syncList() {
        if (State.isLoading) return;
        const container = document.querySelector(CONFIG.listContainerSelector);
        if (!container) return showToast('未找到播放列表容器');

        State.isLoading = true;
        updateUIStatus();
        showToast('正在抓取完整列表...');

        let lastCount = 0, retry = 0;
        while (retry < 5) {
            // 滚动到最底部以加载 Vue 列表
            container.scrollTop = container.scrollHeight;
            container.dispatchEvent(new WheelEvent('wheel', { deltaY: 5000, bubbles: true }));

            await new Promise(r => setTimeout(r, 1000));
            const items = document.querySelectorAll(CONFIG.videoItemSelector);

            if (items.length === lastCount && items.length >= State.remoteTotal) break;
            if (items.length === lastCount) retry++; else { lastCount = items.length; retry = 0; }

            State.data.videos = Array.from(items).map(el => ({
                id: el.getAttribute('data-key'),
                title: el.querySelector('.title-txt')?.textContent || '未知'
            })).filter(v => v.id);

            updatePanelInfo();
        }

        saveData();
        State.isLoading = false;
        updateUIStatus();
        showToast(`同步成功: 共 ${State.data.videos.length} 个视频`);
    }

    // --- UI 系统 ---

    function createUI() {
        if (document.getElementById('bili-rand-fab')) return;
        const style = document.createElement('style');
        style.innerHTML = `
            #bili-rand-fab { position: fixed; right: 25px; bottom: 80px; z-index: 1000000; font-family: sans-serif; display: flex; flex-direction: column; align-items: flex-end; }
            .rand-panel { background: rgba(255, 255, 255, 0.98); backdrop-filter: blur(20px); border-radius: 12px; width: 240px; padding: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.15); margin-bottom: 12px; border: 1px solid #eee; display: none; }
            .rand-panel.open { display: block; }
            .panel-header { font-size: 16px; font-weight: bold; margin-bottom: 12px; border-left: 4px solid ${CONFIG.primaryColor}; padding-left: 8px; }
            .fab-main { width: 50px; height: 50px; background: ${CONFIG.primaryColor}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 15px rgba(251, 114, 153, 0.4); }
            .info-card { background: #f4f4f4; border-radius: 8px; padding: 10px; margin-bottom: 12px; font-size: 12px; color: #666; }
            .btn-act { width: 100%; padding: 8px; border: none; border-radius: 6px; cursor: pointer; margin-top: 6px; color: white; display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 13px; }
            .btn-blue { background: #00aeec; }
            .btn-pink { background: #fb7299; }
            .switch-box { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; font-size: 12px; border-top: 1px solid #eee; padding-top: 8px; }
            .bili-toast { position: fixed; top: 10%; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: white; padding: 8px 16px; border-radius: 20px; z-index: 2000001; font-size: 12px; }
        `;
        document.head.appendChild(style);

        const wrapper = document.createElement('div');
        wrapper.id = 'bili-rand-fab';
        wrapper.innerHTML = `
            <div class="rand-panel" id="randPanel">
                <div class="panel-header">随机播放助手</div>
                <div class="info-card">
                    <div id="ui-list-name" style="font-weight:bold; margin-bottom:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">加载中...</div>
                    已抓取: <b id="ui-total">0</b><br>
                    本轮已播: <b id="ui-played">0</b><br>
                    历史总点火: <b id="ui-hist-sum">0</b> 次
                </div>
                <button class="btn-act btn-blue" id="btnSync">${ICONS.load} <span>同步列表数据</span></button>
                <button class="btn-act btn-pink" id="btnGo">${ICONS.play} <span>随机跳一集</span></button>
                <div class="switch-box">
                    <span>自动随机下一集</span>
                    <input type="checkbox" id="ui-auto" ${State.autoNext ? 'checked' : ''}>
                </div>
                <div id="btnExport" style="font-size:11px; color:#999; text-align:center; margin-top:10px; cursor:pointer;">导出播放统计 (CSV)</div>
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
        document.getElementById('ui-list-name').textContent = State.playlistName;
        document.getElementById('ui-total').textContent = State.data.videos?.length || 0;
        document.getElementById('ui-played').textContent = State.data.played?.length || 0;
        const totalPlays = Object.values(State.data.history || {}).reduce((sum, item) => sum + (item.count || 0), 0);
        document.getElementById('ui-hist-sum').textContent = totalPlays;
    }

    function updateUIStatus() {
        const btn = document.getElementById('btnSync');
        if (btn) btn.disabled = State.isLoading;
    }

    function showToast(msg) {
        const t = document.createElement('div');
        t.className = 'bili-toast';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.remove(); }, 2000);
    }

    function init() {
        // 每 2 秒同步一次页面状态和记录播放
        setInterval(() => {
            if (location.pathname.startsWith('/video/')) {
                updatePageContext();
                recordCurrentPlay();
                if (!document.getElementById('bili-rand-fab') && document.querySelector(CONFIG.listContainerSelector)) {
                    createUI();
                }
            }
        }, 2000);

        // 自动播放下一集检测
        setInterval(() => {
            if (!State.autoNext || State.isJumping) return;
            const video = document.querySelector('video');
            if (video && video.duration && (video.duration - video.currentTime < 1.5)) {
                console.log("[RandVideo] 视频即将结束，执行随机跳转...");
                jumpRandom();
            }
        }, 1000);
    }

    init();
})();
