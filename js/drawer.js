/**
 * 増員 CONTROL HUB 2.0 - ドロワーUI制御
 */

// DOM要素
const drawer = document.getElementById('drawer');
const drawerOverlay = document.getElementById('drawerOverlay');
const drawerClose = document.getElementById('drawerClose');
const drawerInner = document.getElementById('drawerInner');
const drawerSectionLabel = document.getElementById('drawerSectionLabel');
const drawerHallName = document.getElementById('drawerHallName');
const drawerEventName = document.getElementById('drawerEventName');
const drawerDate = document.getElementById('drawerDate');
const drawerTime = document.getElementById('drawerTime');
const drawerStatus = document.getElementById('drawerStatus');
const drawerDescription = document.getElementById('drawerDescription');
const drawerNotice = document.getElementById('drawerNotice');
const noticeTitle = document.getElementById('noticeTitle');
const noticeMessage = document.getElementById('noticeMessage');
const applyForm = document.getElementById('applyForm');
const confirmDialog = document.getElementById('confirmDialog');
const confirmClose = document.getElementById('confirmClose');

// イベントモーダル
const eventModalOverlay = document.getElementById('eventModalOverlay');
const eventModal = document.getElementById('eventModal');
const eventModalTitle = document.getElementById('eventModalTitle');
const eventModalList = document.getElementById('eventModalList');
const eventModalClose = document.getElementById('eventModalClose');

// 現在の選択状態
let currentSelectedDate = null;
let currentSelectedEvent = null;
let selectedDates = []; // 選択された日付（連日イベント用）

// 日付選択関連のDOM要素
const dateSelectionGroup = document.getElementById('dateSelectionGroup');


/**
 * ドロワーを開く（イベントを選択して表示）
 */
function openDrawer(date, events) {
    currentSelectedDate = date;

    // イベントがない場合
    if (!events || events.length === 0) {
        return;
    }

    // 最初のイベントを表示
    const event = events[0];
    currentSelectedEvent = event;

    // セクション情報を取得
    const { sectionInfo, timeSlots, formatDateJP } = window.calendarApp;
    const section = sectionInfo[event.section];

    // ドロワーのセクションクラスを設定
    drawer.className = 'drawer active section-' + event.section;

    // ログイン名を応募フォームに自動セット（B列の名前を使用）
    const savedName = window.loggedInStaffName || localStorage.getItem('zouin_staff_display_name');
    if (savedName) {
        document.getElementById('userName').value = savedName;
    }

    // ヘッダー部分（セクション＋ホール名）
    if (event.section === 'multiple') {
        // 複数セクションの場合: descriptionから選ばれているセクションを抽出
        const selectedSections = [];
        if (event.parsedSections?.stage > 0 || event.description?.includes('舞台:')) {
            selectedSections.push('舞台');
        }
        if (event.parsedSections?.sound > 0 || event.description?.includes('音響:')) {
            selectedSections.push('音響');
        }
        if (event.parsedSections?.lighting > 0 || event.description?.includes('照明:')) {
            selectedSections.push('照明');
        }

        if (selectedSections.length > 0) {
            drawerSectionLabel.textContent = selectedSections.join('・') + ' 増員';
        } else {
            drawerSectionLabel.textContent = '増員';
        }
    } else {
        drawerSectionLabel.textContent = section.name + '増員';
    }
    drawerHallName.textContent = event.hall || '会場未定';

    // 催事名（増員内容またはタイトルから抽出）
    // descriptionから増員内容を抽出
    let eventNameText = '';
    const contentMatch = event.description?.match(/【増員内容】\n　(.+)/);
    if (contentMatch) {
        eventNameText = contentMatch[1].trim();
    } else {
        eventNameText = event.eventName || event.title;
    }
    drawerEventName.textContent = eventNameText;

    // 日付表示（連日対応 + グループイベント対応）
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);

    if (event.groupId && event.relatedDates && event.relatedDates.length > 1) {
        // グループイベント（飛び飛び）の場合: 全関連日付を表示
        let dateLines = event.relatedDates.map(dateStr => {
            const d = new Date(dateStr);
            return formatDateJP(d);
        });
        dateLines.push(`（${event.relatedDates.length}日間）`);
        drawerDate.innerHTML = dateLines.join('<br>');
    } else if (event.startDate !== event.endDate) {
        // 複数日の場合: 改行して各日を表示
        const dayDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

        // 各日の日付を生成
        let dateLines = [];
        for (let i = 0; i < dayDiff; i++) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            dateLines.push(formatDateJP(d));
        }
        dateLines.push(`（${dayDiff}日間）`);

        // HTMLで改行表示
        drawerDate.innerHTML = dateLines.join('<br>');
    } else {
        // 単日の場合
        drawerDate.textContent = formatDateJP(startDate);
    }

    // 区分表示
    const timeSlotText = timeSlots[event.timeSlot] || '全日';
    drawerTime.textContent = timeSlotText;

    // 募集状況
    drawerStatus.textContent = `${event.applied} / ${event.capacity}名`;

    // 説明文（GASからのdescriptionがある場合はそれを使用）
    if (event.description) {
        // GASからのフォーマット済み説明文を表示（改行を<br>に変換）
        drawerDescription.innerHTML = event.description.replace(/\n/g, '<br>');
    } else {
        drawerDescription.textContent = `${event.title}のスタッフを募集しています。経験者歓迎。`;
    }

    // 定員状況メッセージを設定
    const isFull = event.applied >= event.capacity;
    if (isFull) {
        noticeTitle.textContent = '定員に達しています';
        noticeMessage.textContent = '応募すると【キャンセル待ち / 選考対象】として登録されます。';
    } else {
        const remaining = event.capacity - event.applied;
        noticeTitle.textContent = '募集中です';
        noticeMessage.textContent = `残り${remaining}名の枠があります。ぜひご応募ください！`;
    }

    // 日付選択の表示/非表示を設定
    setupDateSelection(event);

    // オーバーレイを表示
    drawerOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

/**
 * 日付選択UIを設定
 */
function setupDateSelection(event) {
    const { formatDateJP } = window.calendarApp;
    const dateTabs = document.getElementById('dateTabs');

    // 日付選択をリセット
    selectedDates = [];
    dateTabs.innerHTML = '';

    // relatedDates（グループ化された非連日イベント）があるか確認
    const relatedDates = event.relatedDates || event.extendedProps?.relatedDates || [];
    const hasRelatedDates = Array.isArray(relatedDates) && relatedDates.length > 0;

    // 連日イベントかつ通し希望が「はい」「あり」以外の場合に表示
    const isMultiDay = event.isMultiDay || event.extendedProps?.isMultiDay ||
        (event.startDate !== event.endDate) || hasRelatedDates;
    const pref = event.consecutivePreference || event.extendedProps?.consecutivePreference || '';

    // 「はい」「あり」の場合は個別選択不可（ただしrelatedDatesがある場合は選択可）
    const showDateSelection = isMultiDay && (pref !== 'はい' && pref !== 'あり' || hasRelatedDates);

    console.log('日付選択判定:', { isMultiDay, pref, showDateSelection, hasRelatedDates, event });

    if (!showDateSelection) {
        dateSelectionGroup.classList.add('hidden');
        return;
    }

    // 日付選択を表示
    dateSelectionGroup.classList.remove('hidden');

    // イベントオブジェクトの構造を確認
    console.log('イベントオブジェクト:', JSON.stringify(event, null, 2));

    let dates = [];

    if (hasRelatedDates) {
        // relatedDatesから日付を生成
        relatedDates.forEach(d => {
            const parsed = new Date(d);
            if (!isNaN(parsed.getTime())) {
                dates.push(parsed);
            }
        });
        console.log('relatedDatesから日付生成:', dates.length);
    } else {
        // startDateとendDateから日付を生成
        const startStr = event.startDate || event.start;
        const endStr = event.endDate || event.end || startStr;
        console.log('start/end:', startStr, endStr);

        const startDate = new Date(startStr);
        const endDate = new Date(endStr);

        if (isNaN(startDate.getTime())) {
            console.error('無効な開始日:', startStr);
            dateSelectionGroup.classList.add('hidden');
            return;
        }
        if (isNaN(endDate.getTime())) {
            console.error('無効な終了日:', endStr);
            dateSelectionGroup.classList.add('hidden');
            return;
        }

        // 日付リストを生成
        let currentDate = new Date(startDate);
        let loopCount = 0;
        while (currentDate <= endDate && loopCount < 10) {
            dates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
            loopCount++;
        }
    }

    console.log('生成された日付:', dates.length, '件');

    // 日付がない場合はエラー表示
    if (dates.length === 0) {
        console.error('日付リストが空です');
        dateSelectionGroup.classList.add('hidden');
        return;
    }

    // 個別日のタブを生成
    dates.forEach((d, index) => {
        const tab = createDateTab(d, `${index + 1}日目のみ`);
        dateTabs.appendChild(tab);
    });

    // 両日/全日タブを追加（2日以上の場合）
    if (dates.length >= 2) {
        const allDaysLabel = dates.length === 2 ? '両日' : `全${dates.length}日`;
        const allTab = document.createElement('div');
        allTab.className = 'date-tab date-tab-all';
        allTab.dataset.value = 'all';
        allTab.dataset.dates = dates.map(d => d.toISOString().split('T')[0]).join(',');
        allTab.innerHTML = `<span class="date-tab-all-label">${allDaysLabel}</span>`;
        allTab.addEventListener('click', () => handleTabClick(allTab, dates));
        dateTabs.appendChild(allTab);
    }
}

/**
 * 日付タブ要素を作成
 */
function createDateTab(date, label) {
    const tab = document.createElement('div');
    tab.className = 'date-tab';
    const dateStr = date.toISOString().split('T')[0];
    tab.dataset.value = dateStr;

    // 曜日と日付を抽出
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
    const month = date.getMonth() + 1;
    const day = date.getDate();

    tab.innerHTML = `
        <span class="date-tab-label">${label}</span>
        <span class="date-tab-date">${month}/${day}(${dayOfWeek})</span>
    `;
    tab.addEventListener('click', () => handleTabClick(tab, null));
    return tab;
}

/**
 * タブクリック時の処理
 */
function handleTabClick(tab, allDates) {
    const dateTabs = document.getElementById('dateTabs');

    if (tab.dataset.value === 'all') {
        // 全日タブがクリックされた場合
        const isActive = tab.classList.contains('active');

        // 全てのタブの状態を更新
        dateTabs.querySelectorAll('.date-tab').forEach(t => {
            if (isActive) {
                t.classList.remove('active');
            } else {
                t.classList.add('active');
            }
        });
    } else {
        // 個別タブがクリックされた場合
        tab.classList.toggle('active');

        // 全日タブの状態を更新
        const allTab = dateTabs.querySelector('[data-value="all"]');
        if (allTab) {
            const individualTabs = dateTabs.querySelectorAll('.date-tab:not([data-value="all"])');
            const activeTabs = dateTabs.querySelectorAll('.date-tab.active:not([data-value="all"])');
            if (activeTabs.length === individualTabs.length) {
                allTab.classList.add('active');
            } else {
                allTab.classList.remove('active');
            }
        }
    }

    // 選択状態を更新
    updateSelectedDates();
}

/**
 * 選択された日付を更新
 */
function updateSelectedDates() {
    const dateTabs = document.getElementById('dateTabs');
    selectedDates = [];

    dateTabs.querySelectorAll('.date-tab.active:not([data-value="all"])').forEach(tab => {
        selectedDates.push(tab.dataset.value);
    });

    console.log('選択された日付:', selectedDates);
}

/**
 * ドロワーを閉じる
 */
function closeDrawer() {
    drawer.classList.remove('active');
    drawerOverlay.classList.remove('active');
    document.body.style.overflow = '';

    // フォームをリセット
    applyForm.reset();
}

/**
 * 確認ダイアログを表示
 */
function showConfirmDialog() {
    confirmDialog.classList.remove('hidden');
}

/**
 * 確認ダイアログを閉じる
 */
function hideConfirmDialog() {
    confirmDialog.classList.add('hidden');
    closeDrawer();
}

/**
 * フォーム送信処理
 */
async function handleFormSubmit(e) {
    e.preventDefault();

    // 申し込み前に権限チェック
    if (window.checkPermission) {
        const hasPermission = await window.checkPermission();
        if (!hasPermission) {
            return;
        }
    }

    // 日付選択の検証（表示されている場合）
    if (!dateSelectionGroup.classList.contains('hidden') && selectedDates.length === 0) {
        alert('応募する日程を選択してください');
        return;
    }

    const submitBtn = applyForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = '送信中...';
    submitBtn.disabled = true;

    try {
        const email = localStorage.getItem('zouin_staff_name') || '';
        const staffName = localStorage.getItem('zouin_staff_display_name') || document.getElementById('userName').value;
        const staffHall = document.getElementById('staffHall').value;
        const staffSection = document.getElementById('staffSection').value;
        const eventTitle = currentSelectedEvent?.title || '';
        const hall = currentSelectedEvent?.extendedProps?.hall || '';
        const dates = selectedDates.length > 0 ? selectedDates.join(', ') : currentSelectedDate;

        const data = {
            action: 'submitApplication',
            email: email,
            staffName: staffName,
            staffHall: staffHall,
            staffSection: staffSection,
            eventTitle: eventTitle,
            hall: hall,
            section: staffSection,
            date: currentSelectedDate,
            selectedDates: selectedDates.length > 0 ? selectedDates.join(',') : currentSelectedDate,
            sendLineNotification: true
        };

        console.log('応募データ:', data);

        // GASに送信（JSONP方式）
        const result = await submitToGAS(data);

        if (result.success) {
            // LINE公式アカウントにメッセージを送信するURLを生成
            const lineMessage = buildLineMessage(staffHall, staffName, staffSection, dates, hall);
            const lineUrl = 'https://line.me/R/oaMessage/@320ledlj/?' + encodeURIComponent(lineMessage);

            // 確認ダイアログ表示後にLINEを開く
            showConfirmDialogWithLine(lineUrl);
        } else {
            alert('送信に失敗しました: ' + (result.error || '不明なエラー'));
        }
    } catch (error) {
        console.error('送信エラー:', error);
        alert('送信に失敗しました。もう一度お試しください。');
    } finally {
        submitBtn.textContent = originalBtnText;
        submitBtn.disabled = false;
    }
}

/**
 * LINEプリセットメッセージを生成
 */
function buildLineMessage(staffHall, staffName, staffSection, dates, eventHall) {
    return `申し込み内容

【所属ホール名】${staffHall}
【お名前】${staffName}
【ご自身のセクション】${staffSection}
【増員希望の日にち】${dates}
【増員希望の事業所】${eventHall}`;
}

/**
 * LINE送信付き確認ダイアログを表示
 */
function showConfirmDialogWithLine(lineUrl) {
    const dialog = document.getElementById('confirmDialog');
    const messageEl = dialog.querySelector('.confirm-message');

    // メッセージを更新
    messageEl.innerHTML = `
        応募を受け付けました。<br><br>
        <strong>LINE公式に申し込み内容を送信してください。</strong><br>
        下のボタンを押すとLINEが開きます。<br>
        メッセージが入力された状態で開くので、<br>
        <strong>「送信」を押すだけ</strong>でOKです。
    `;

    // LINEボタンを追加
    let lineBtn = dialog.querySelector('.line-send-btn');
    if (!lineBtn) {
        lineBtn = document.createElement('a');
        lineBtn.className = 'line-send-btn';
        lineBtn.style.cssText = 'display:block;background:#06C755;color:#fff;text-align:center;padding:14px;border-radius:8px;font-weight:bold;font-size:16px;text-decoration:none;margin:12px 0 8px;';
        const closeBtn = dialog.querySelector('.confirm-btn');
        closeBtn.parentNode.insertBefore(lineBtn, closeBtn);
    }
    lineBtn.href = lineUrl;
    lineBtn.target = '_blank';
    lineBtn.textContent = '📱 LINEで送信する';

    dialog.classList.remove('hidden');
}

/**
 * GASに申し込みデータを送信（JSONP方式）
 */
function submitToGAS(data) {
    return new Promise((resolve) => {
        const GAS_URL = 'https://script.google.com/macros/s/AKfycbzfSgWz8ECzu5LYj6ImAQ9pLPwSTTnkv0Mw3BGdF7PDQuSbiTMcEdAtp2JBrG6Fd7mCiQ/exec';
        const callbackName = 'submitCallback_' + Date.now();

        const params = new URLSearchParams(data);
        params.append('callback', callbackName);

        window[callbackName] = function (response) {
            delete window[callbackName];
            document.body.removeChild(script);
            resolve(response);
        };

        const script = document.createElement('script');
        script.src = `${GAS_URL}?${params.toString()}`;
        script.onerror = function () {
            delete window[callbackName];
            document.body.removeChild(script);
            resolve({ success: false, error: 'ネットワークエラー' });
        };

        setTimeout(() => {
            if (window[callbackName]) {
                delete window[callbackName];
                if (script.parentNode) document.body.removeChild(script);
                resolve({ success: false, error: 'タイムアウト' });
            }
        }, 15000);

        document.body.appendChild(script);
    });
}

// イベントリスナー
drawerOverlay.addEventListener('click', closeDrawer);
drawerClose.addEventListener('click', closeDrawer);
applyForm.addEventListener('submit', handleFormSubmit);
confirmClose.addEventListener('click', hideConfirmDialog);

// ドラッグでドロワーを閉じる
let isDragging = false;
let startY = 0;
let currentY = 0;

drawerInner.addEventListener('touchstart', (e) => {
    // スクロール位置が一番上の時のみドラッグを有効にする
    if (drawerInner.scrollTop === 0) {
        isDragging = true;
        startY = e.touches[0].clientY;
    }
}, { passive: true });

drawerInner.addEventListener('touchmove', (e) => {
    if (!isDragging) return;

    currentY = e.touches[0].clientY;
    const diff = currentY - startY;

    if (diff > 0) {
        drawer.style.transform = `translateY(${diff}px)`;
    }
}, { passive: true });

drawerInner.addEventListener('touchend', () => {
    if (!isDragging) return;

    isDragging = false;
    const diff = currentY - startY;

    if (diff > 100) {
        closeDrawer();
    }

    drawer.style.transform = '';
}, { passive: true });

/**
 * イベント選択モーダルを開く
 */
function showEventModal(date, events) {
    const { sectionInfo, formatDateJP } = window.calendarApp;

    // タイトルを設定
    eventModalTitle.textContent = `${formatDateJP(date)}のイベント`;

    // イベントリストを生成
    eventModalList.innerHTML = '';
    events.forEach(event => {
        const section = sectionInfo[event.section];
        const item = document.createElement('div');
        item.className = `event-modal-item section-${event.section}`;
        item.innerHTML = `
            <span class="event-modal-section">${section.name}</span>
            <span class="event-modal-name">${event.hall || '会場未定'}</span>
            <span class="event-modal-status">${event.applied}/${event.capacity}</span>
        `;
        item.addEventListener('click', () => {
            closeEventModal();
            openDrawer(date, [event]);
        });
        eventModalList.appendChild(item);
    });

    // モーダルを表示
    eventModalOverlay.classList.add('active');
    eventModal.classList.add('active');
}

/**
 * イベント選択モーダルを閉じる
 */
function closeEventModal() {
    eventModalOverlay.classList.remove('active');
    eventModal.classList.remove('active');
}

// イベントモーダルのイベントリスナー
eventModalOverlay.addEventListener('click', closeEventModal);
eventModalClose.addEventListener('click', closeEventModal);

// calendar.jsから呼び出せるようにグローバルに公開
window.openDrawer = openDrawer;
window.showEventModal = showEventModal;
