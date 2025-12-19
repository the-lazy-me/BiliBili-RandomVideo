// ==UserScript==
// @name         B站播放列表随机播放
// @namespace    https://github.com/the-lazy-me/BiliBili-RandomVideo
// @version      1.0
// @description  基于 sid 唯一标识，支持记忆 UP 主、列表名，自动检测列表更新，1.5秒抢先跳转。作者：Lazy (https://space.bilibili.com/407410594)
// @author       Lazy
// @match        *://www.bilibili.com/video/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const ICONS = {
        shuffle: `<svg viewBox="0 0 24 24" width="32" height="32"><path fill="currentColor" d="M17 17h-1.55l-3.7-4.63 1.3-1.63L16.14 15H17v2m0-10h-1.55L10 13.73l-1.3-1.63L12.56 7H17v2M7.5 17h-1.3l2.8-3.5 1.3 1.63L7.5 17M6.2 7h1.3l8.7 10.87-1.3 1.63L6.2 7z"/></svg>`,
        load: `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01-.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>`,
        play: `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M8 5v14l11-7L8 5z"/></svg>`,
        export: `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`,
        close: `<svg viewBox="0 0 24 24" width="32" height="32"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>`
    };

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
        data: { videos: [], played: [], lastUpdate: '' }
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

            if (State.sid !== newSid) {
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
        const saved = localStorage.getItem(`bili_rand_v2_${State.sid}`);
        if (saved) {
            State.data = JSON.parse(saved);
        } else {
            State.data = { videos: [], played: [], lastUpdate: '' };
        }

        const currentActive = document.querySelector(CONFIG.activeItemSelector);
        if (currentActive) {
            const bvid = currentActive.getAttribute('data-key');
            if (bvid && !State.data.played.includes(bvid)) {
                State.data.played.push(bvid);
                saveData();
            }
        }
        updatePanelInfo();
    }

    function saveData() {
        if (!State.sid) return;
        State.data.upName = State.upName;
        State.data.playlistName = State.playlistName;
        State.data.lastUpdate = new Date().toLocaleString();
        localStorage.setItem(`bili_rand_v2_${State.sid}`, JSON.stringify(State.data));
    }

    function jumpRandom() {
        if (State.isJumping) return;

        loadData();
        const all = State.data.videos;
        if (all.length === 0) return showToast('请先同步列表数据', 'warning');

        let pool = all.filter(v => !State.data.played.includes(v.id));
        if (pool.length === 0) {
            showToast('本轮已全随机完，重置历史', 'info');
            State.data.played = [];
            pool = all;
        }

        const target = pool[Math.floor(Math.random() * pool.length)];
        State.data.played.push(target.id);
        saveData();

        State.isJumping = true;
        showToast(`即将播放: ${target.title}`, 'success');

        setTimeout(() => {
            window.location.href = `https://www.bilibili.com/video/${target.id}/`;
        }, 500);
    }

    function checkAutoNext() {
        // 增加路径安全检查
        if (!location.pathname.startsWith('/video/')) return;
        if (!State.autoNext || State.isJumping) return;

        const video = document.querySelector('video');
        if (!video || !video.duration) return;

        const timeLeft = video.duration - video.currentTime;
        if (video.duration > 5 && timeLeft > 0 && timeLeft < 1.5) {
            console.log(`[随机播放] 抢先跳转...`);
            jumpRandom();
        }
    }

    async function syncList() {
        if (State.isLoading) return;
        const container = document.querySelector(CONFIG.listContainerSelector);
        if (!container) return showToast('未找到列表容器', 'error');

        State.isLoading = true;
        updateUIStatus();
        showToast('开始抓取全量列表...', 'info');

        let lastCount = 0, retry = 0;
        while (retry < 5) {
            container.scrollTop = container.scrollHeight;
            container.dispatchEvent(new WheelEvent('wheel', { deltaY: 5000, bubbles: true }));
            await new Promise(r => setTimeout(r, 800));
            const items = document.querySelectorAll(CONFIG.videoItemSelector);
            if (items.length === lastCount && items.length >= State.remoteTotal) break;
            if (items.length === lastCount) retry++;
            else { lastCount = items.length; retry = 0; }

            State.data.videos = Array.from(items).map(el => ({
                id: el.getAttribute('data-key'),
                title: el.querySelector('.title-txt')?.textContent || '未知'
            }));
            updatePanelInfo();
        }

        saveData();
        State.isLoading = false;
        updateUIStatus();
        showToast(`同步成功，共记录 ${State.data.videos.length} 个视频`, 'success');
    }

    // --- UI 相关 ---

    function createUI() {
        if (document.getElementById('bili-rand-fab')) return;

        const style = document.createElement('style');
        style.id = 'bili-rand-style';
        style.innerHTML = `
            #bili-rand-fab { position: fixed; right: 25px; bottom: 80px; z-index: 1000000; display: flex; flex-direction: column; align-items: flex-end; font-family: sans-serif; }
            .rand-panel { background: rgba(255, 255, 255, 0.98); backdrop-filter: blur(20px); border-radius: 20px; width: 260px; padding: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); margin-bottom: 15px; border: 1px solid #fff; transform-origin: bottom right; transition: all 0.3s; display: none; opacity: 0; scale: 0.8; }
            .rand-panel.open { display: block; opacity: 1; scale: 1; }
            .fab-main { width: 60px; height: 60px; background: ${CONFIG.primaryColor}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 6px 20px rgba(251, 114, 153, 0.4); border: none; }
            .info-card { background: #f1f2f3; border-radius: 12px; padding: 12px; margin-bottom: 15px; font-size: 13px; color: #61666d; line-height: 1.6; }
            .info-card b { color: #18191c; }
            .btn-act { width: 100%; height: 42px; border: none; border-radius: 10px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px; cursor: pointer; margin-top: 8px; color: white; transition: 0.2s; }
            .btn-blue { background: #00aeec; }
            .btn-pink { background: #fb7299; }
            .btn-warn { background: #ff5c7c !important; animation: pulse 2s infinite; }
            @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.7; } 100% { opacity: 1; } }
            .switch-box { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e3e5e7; font-size: 13px; color: #61666d; }
            .bili-toast { position: fixed; top: 12%; left: 50%; transform: translateX(-50%); padding: 10px 20px; border-radius: 50px; background: rgba(0,0,0,0.8); color: white; z-index: 2000000; font-size: 13px; transition: 0.3s; pointer-events: none; }
        `;
        document.head.appendChild(style);

        const wrapper = document.createElement('div');
        wrapper.id = 'bili-rand-fab';
        wrapper.innerHTML = `
            <div class="rand-panel" id="randPanel">
                <div class="info-card">
                    <div>UP: <b id="ui-up">--</b></div>
                    <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">列表: <b id="ui-list">--</b></div>
                    <div style="margin-top:8px; border-top:1px dashed #ccc; padding-top:8px;">
                        页面总数: <b id="ui-remote">0</b><br>
                        记忆总数: <b id="ui-total">0</b><br>
                        已随机过: <b id="ui-played">0</b>
                    </div>
                </div>
                <button class="btn-act btn-blue" id="btnSync">${ICONS.load} <span>同步列表数据</span></button>
                <button class="btn-act btn-pink" id="btnGo">${ICONS.play} <span>随机跳一集</span></button>
                <div class="switch-box">
                    <span>自动抢先连播 (1.5s)</span>
                    <input type="checkbox" id="ui-auto" ${State.autoNext ? 'checked' : ''}>
                </div>
            </div>
            <div class="fab-main" id="fabMain">${ICONS.shuffle}</div>
        `;
        document.body.appendChild(wrapper);

        document.getElementById('fabMain').onclick = () => {
            State.isMenuOpen = !State.isMenuOpen;
            document.getElementById('randPanel').classList.toggle('open', State.isMenuOpen);
            document.getElementById('fabMain').innerHTML = State.isMenuOpen ? ICONS.close : ICONS.shuffle;
            if(State.isMenuOpen) {
                updatePageContext();
                updatePanelInfo();
            }
        };
        document.getElementById('btnSync').onclick = syncList;
        document.getElementById('btnGo').onclick = jumpRandom;
        document.getElementById('ui-auto').onchange = (e) => {
            State.autoNext = e.target.checked;
            localStorage.setItem('bili_rand_auto', State.autoNext);
        };
    }

    function updatePanelInfo() {
        if (!document.getElementById('ui-total')) return;
        document.getElementById('ui-up').textContent = State.upName;
        document.getElementById('ui-list').textContent = State.playlistName;
        document.getElementById('ui-remote').textContent = State.remoteTotal;
        document.getElementById('ui-total').textContent = State.data.videos.length;
        document.getElementById('ui-played').textContent = State.data.played.length;

        const btnSync = document.getElementById('btnSync');
        if (State.remoteTotal > State.data.videos.length) {
            btnSync.classList.add('btn-warn');
            btnSync.querySelector('span').textContent = '发现新视频，请同步';
        } else {
            btnSync.classList.remove('btn-warn');
            btnSync.querySelector('span').textContent = '同步列表数据';
        }
    }

    function updateUIStatus() {
        const btn = document.getElementById('btnSync');
        if (btn) {
            btn.disabled = State.isLoading;
            if (State.isLoading) btn.querySelector('span').textContent = '抓取中...';
        }
    }

    function showToast(msg) {
        const t = document.createElement('div');
        t.className = 'bili-toast';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2500);
    }

    function init() {
        setInterval(() => {
            // 关键：检查当前 URL 是否匹配视频播放页
            const isVideoPage = location.pathname.startsWith('/video/');
            const hasList = !!document.querySelector(CONFIG.listContainerSelector);
            const fab = document.getElementById('bili-rand-fab');

            if (isVideoPage && hasList) {
                if (!fab) createUI();
                updatePageContext();
            } else {
                // 如果不在视频页或列表页，移除 UI
                if (fab) fab.remove();
            }
        }, 2000);

        setInterval(checkAutoNext, 500);
    }

    init();
})();
