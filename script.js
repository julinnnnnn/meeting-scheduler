const DAYS = [
    { id: 'mon', name: '週一' },
    { id: 'tue', name: '週二' },
    { id: 'wed', name: '週三' },
    { id: 'thu', name: '週四' },
    { id: 'fri', name: '週五' },
    { id: 'sat', name: '週六' },
    { id: 'sun', name: '週日' },
];

const firebaseConfig = {
    apiKey: "AIzaSyAKM6GJBAnm-ek0A59agFPf3IcwyPKzAm4",
    authDomain: "meeting-scheduler-7f482.firebaseapp.com",
    databaseURL: "https://meeting-scheduler-7f482-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "meeting-scheduler-7f482",
    storageBucket: "meeting-scheduler-7f482.appspot.com",
    messagingSenderId: "1095035578038",
    appId: "1:1095035578038:web:8b16a4ed4474a51c206817",
    measurementId: "G-N53Q8D3JBG"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

const timetableHeaderDays = document.getElementById('timetable-header-days');
const timetableGrid = document.getElementById('timetable-grid');
const views = document.querySelectorAll('.view');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const roomIdInput = document.getElementById('room-id-input');
const nameInput = document.getElementById('name-input');
const enterRoomBtn = document.getElementById('enter-room-btn');
const userList = document.getElementById('user-list');
const showIntersectionBtn = document.getElementById('show-intersection-btn');
const copyLinkBtn = document.getElementById('copy-link-btn'); // <-- 新增處
const modalContainer = document.getElementById('modal-container');
const closeModalBtn = document.querySelector('.close-btn');
const allAvailableResult = document.getElementById('all-available-result');
const maxAvailableResult = document.getElementById('max-available-result');
const clearMySelectionsBtn = document.getElementById('clear-my-selections-btn'); 

let currentRoomId = null;
let currentUserId = null;
let currentUserName = null;
let roomData = null;
let roomListener = null;

function showView(viewId) {
    views.forEach(view => {
        view.style.display = view.id === viewId ? 'block' : 'none';
    });
}

async function createRoom() {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const now = new Date().getTime();
    await database.ref('rooms/' + roomId).set({
        createdAt: now,
        users: {}
    });
    window.location.hash = roomId;
}

function joinRoom() {
    const roomId = roomIdInput.value.trim().toUpperCase();
    if (roomId.length === 6) {
        window.location.hash = roomId;
    } else {
        alert('請輸入有效的 6 位數房間號碼。');
    }
}

function loginUser() {
    const name = nameInput.value.trim();
    if (!name) {
        alert('請輸入您的名稱。');
        return;
    }
    currentUserName = name;
    
    let existingUser = null;
    if (roomData && roomData.users) {
        const found = Object.entries(roomData.users).find(([id, user]) => user.name === currentUserName);
        if (found) {
            existingUser = { id: found[0], ...found[1] };
        }
    }

    if (existingUser) {
        currentUserId = existingUser.id;
    } else {
        currentUserId = `user-${Date.now()}`;
        database.ref(`rooms/${currentRoomId}/users/${currentUserId}`).set({
            name: currentUserName,
            availableSlots: []
        });
    }

    localStorage.setItem(`user-id-${currentRoomId}`, currentUserId);
    localStorage.setItem(`user-name-${currentRoomId}`, currentUserName);
    
    // --- 修改處: 移除了 userRef.onDisconnect().remove(); ---

    document.getElementById('user-name-display').textContent = currentUserName;
    showView('app-container');
    renderUI();
}

function generateTimetable() {
    timetableHeaderDays.innerHTML = '';
    timetableGrid.innerHTML = '';

    timetableHeaderDays.appendChild(document.createElement('div'));
    DAYS.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        dayHeader.textContent = day.name;
        timetableHeaderDays.appendChild(dayHeader);
    });

    for (let hour = 8; hour < 21; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
            const timeRow = document.createElement('div');
            timeRow.className = 'time-row';
            
            const timeLabel = document.createElement('div');
            timeLabel.className = 'time-label';
            const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
            timeLabel.textContent = startTime;
            timeRow.appendChild(timeLabel);

            DAYS.forEach(day => {
                const timeSlot = document.createElement('div');
                timeSlot.className = 'time-slot';
                
                const endHour = minute === 30 ? hour + 1 : hour;
                const endMinute = minute === 30 ? 0 : 30;
                const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
                
                const timeSlotId = `${day.id}-${startTime}-${endTime}`;
                timeSlot.dataset.timeSlotId = timeSlotId;
                
                timeSlot.addEventListener('click', () => handleTimeSlotClick(timeSlotId));
                timeRow.appendChild(timeSlot);
            });
            
            timetableGrid.appendChild(timeRow);
        }
    }
}

function handleTimeSlotClick(timeSlotId) {
    if (!currentUserId || !roomData.users || !roomData.users[currentUserId]) return;
    const userSlots = roomData.users[currentUserId].availableSlots || [];
    const slotIndex = userSlots.indexOf(timeSlotId);
    if (slotIndex > -1) {
        userSlots.splice(slotIndex, 1);
    } else {
        userSlots.push(timeSlotId);
    }
    database.ref(`rooms/${currentRoomId}/users/${currentUserId}/availableSlots`).set(userSlots);
}

function renderUI() {
    if (!roomData) return;
    renderUserList();
    renderTimetableSelections();
}

function renderUserList() {
    userList.innerHTML = '';
    if (!roomData.users) return;
    Object.keys(roomData.users).forEach(userId => {
        const user = roomData.users[userId];
        const li = document.createElement('li');
        const colorDot = document.createElement('div');
        colorDot.className = 'color-dot';
        colorDot.style.backgroundColor = generateColorForUser(userId);
        li.appendChild(colorDot);
        li.appendChild(document.createTextNode(user.name));
        userList.appendChild(li);
    });
}

function renderTimetableSelections() {
    document.querySelectorAll('.time-slot').forEach(slot => {
        slot.innerHTML = '';
        slot.classList.remove('is-selected-by-user');
    });
    if (!roomData.users) return;
    const slotToUsersMap = {};
    Object.entries(roomData.users).forEach(([userId, user]) => {
        if (user.availableSlots && Array.isArray(user.availableSlots)) {
            user.availableSlots.forEach(slotId => {
                if (!slotToUsersMap[slotId]) {
                    slotToUsersMap[slotId] = [];
                }
                slotToUsersMap[slotId].push({ id: userId, ...user });
            });
        }
    });
    Object.entries(slotToUsersMap).forEach(([slotId, usersInSlot]) => {
        const slotElement = document.querySelector(`[data-time-slot-id="${slotId}"]`);
        if (!slotElement) return;
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'participant-tags-container';
        usersInSlot.forEach(user => {
            const selectionOverlay = document.createElement('div');
            selectionOverlay.className = 'selection-overlay';
            selectionOverlay.style.backgroundColor = generateColorForUser(user.id);
            slotElement.appendChild(selectionOverlay);
            const participantTag = document.createElement('span');
            participantTag.className = 'participant-tag';
            participantTag.textContent = user.name;
            tagsContainer.appendChild(participantTag);
            if (user.id === currentUserId) {
                slotElement.classList.add('is-selected-by-user');
            }
        });
        slotElement.appendChild(tagsContainer);
    });
}

function generateColorForUser(userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `hsl(${hash % 360}, 70%, 60%)`;
}

// --- 修改處 Start: 重構 calculateIntersection 函式邏輯 ---
function calculateIntersection() {
    // 獲取 Modal 中的區塊元素
    const allAvailableSection = document.getElementById('all-available-section');
    const maxAvailableSection = document.getElementById('max-available-section');

    if (!roomData || !roomData.users) {
        // 處理沒有使用者的情況
        allAvailableSection.style.display = 'block';
        maxAvailableSection.style.display = 'none';
        allAvailableResult.textContent = '目前沒有成員加入。';
        return;
    }

    const users = Object.values(roomData.users);
    const totalUsers = users.length;
    if (totalUsers === 0) {
        allAvailableSection.style.display = 'block';
        maxAvailableSection.style.display = 'none';
        allAvailableResult.textContent = '目前沒有成員加入。';
        return;
    }

    const slotCounts = {};
    let maxCount = 0;
    users.forEach(user => {
        if (user.availableSlots) {
            user.availableSlots.forEach(slot => {
                slotCounts[slot] = (slotCounts[slot] || 0) + 1;
                if (slotCounts[slot] > maxCount) {
                    maxCount = slotCounts[slot];
                }
            });
        }
    });

    const allAvailableSlots = Object.keys(slotCounts).filter(slot => slotCounts[slot] === totalUsers);

    if (allAvailableSlots.length > 0) {
        // 情況1: 存在全體交集，只顯示此區塊
        allAvailableResult.textContent = formatTimeSlots(allAvailableSlots);
        allAvailableSection.style.display = 'block';
        maxAvailableSection.style.display = 'none';
    } else {
        // 情況2: 不存在全體交集，顯示最佳推薦
        const maxAvailableSlots = Object.keys(slotCounts).filter(slot => slotCounts[slot] === maxCount);
        const maxResultText = `共有 ${maxCount} 人可參加：\n${formatTimeSlots(maxAvailableSlots)}`;
        maxAvailableResult.textContent = maxCount > 0 ? maxResultText : '沒有人選擇任何時段。';
        allAvailableSection.style.display = 'none';
        maxAvailableSection.style.display = 'block';
    }
}
// --- 修改處 End ---

function formatTimeSlots(slots) {
    if (!slots || slots.length === 0) return '沒有找到對應的時段。';

    const groupedByDay = {};
    DAYS.forEach(day => { groupedByDay[day.id] = []; });

    slots.forEach(slot => {
        const dayId = slot.substring(0, 3);
        const timeRange = slot.substring(4);
        if (groupedByDay[dayId]) {
            groupedByDay[dayId].push(timeRange);
        }
    });

    let output = '';

    for (const day of DAYS) {
        const dayId = day.id;
        const timeRanges = groupedByDay[dayId].sort();

        if (timeRanges.length === 0) continue;

        output += `${day.name}:\n`;
        let merged = [];
        let currentMerge = null;

        for (const range of timeRanges) {
            const [start, end] = range.split('-');
            if (!currentMerge) {
                currentMerge = { start, end };
            } else if (start === currentMerge.end) {
                currentMerge.end = end;
            } else {
                merged.push(`${currentMerge.start}-${currentMerge.end}`);
                currentMerge = { start, end };
            }
        }
        if (currentMerge) {
            merged.push(`${currentMerge.start}-${currentMerge.end}`);
        }
        
        output += `  ${merged.join(', ')}\n`;
    }

    return output.trim() || '沒有找到對應的時段。';
}

function handleHashChange() {
    const roomId = window.location.hash.substring(1).toUpperCase();
    if (roomListener) {
        database.ref(`rooms/${currentRoomId}`).off('value', roomListener);
    }
    if (roomId.length === 6) {
        currentRoomId = roomId;
        const roomRef = database.ref('rooms/' + currentRoomId);
        roomRef.once('value', snapshot => {
            if (snapshot.exists()) {
                roomData = snapshot.val(); 
                const now = new Date().getTime();
                const oneDay = 24 * 60 * 60 * 1000;
                if (now - roomData.createdAt > oneDay) {
                    alert('此房間已過期 (超過24小時)。');
                    window.location.hash = '';
                    showView('home-container');
                    roomRef.remove();
                    return;
                }
                document.getElementById('app-room-id').textContent = currentRoomId;
                document.getElementById('login-room-id').textContent = `正在加入房間: ${currentRoomId}`;
                const savedName = localStorage.getItem(`user-name-${currentRoomId}`);
                nameInput.value = savedName || '';
                showView('login-container');
                
                roomListener = roomRef.on('value', (snapshot) => {
                    roomData = snapshot.val();
                    if (document.getElementById('app-container').style.display === 'block') {
                        renderUI();
                    }
                });
            } else {
                alert('找不到這個房間！');
                window.location.hash = '';
                showView('home-container');
            }
        });
    } else {
        showView('home-container');
    }
}

createRoomBtn.addEventListener('click', createRoom);
joinRoomBtn.addEventListener('click', joinRoom);
roomIdInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') joinRoom(); });
enterRoomBtn.addEventListener('click', loginUser);
nameInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') loginUser(); });
showIntersectionBtn.addEventListener('click', () => {
    calculateIntersection();
    modalContainer.style.display = 'flex';
});

// --- 新增處 Start: 複製按鈕的事件監聽器 ---
copyLinkBtn.addEventListener('click', () => {
    // 使用 navigator.clipboard API，這是現代、安全的方法
    navigator.clipboard.writeText(window.location.href).then(() => {
        // 複製成功的回饋
        const originalIcon = copyLinkBtn.innerHTML;
        copyLinkBtn.innerHTML = '✔️ 已複製!';
        copyLinkBtn.classList.add('copied');
        
        // 2秒後恢復原狀
        setTimeout(() => {
            copyLinkBtn.innerHTML = originalIcon;
            copyLinkBtn.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        // 處理複製失敗的情況
        console.error('無法複製連結: ', err);
        alert('複製連結失敗！');
    });
});
// --- 新增處 End ---

closeModalBtn.addEventListener('click', () => {
    modalContainer.style.display = 'none';
});
window.addEventListener('click', (e) => {
    if (e.target === modalContainer) {
        modalContainer.style.display = 'none';
    }
});
window.addEventListener('hashchange', handleHashChange);

// --- 新增處 Start: 清除按鈕的事件監聽器 ---
clearMySelectionsBtn.addEventListener('click', () => {
    if (confirm('您確定要清除您選擇的所有時段嗎？')) {
        if (currentUserId) {
            database.ref(`rooms/${currentRoomId}/users/${currentUserId}/availableSlots`).set([]);
        }
    }
});
// --- 新增處 End ---

generateTimetable();
handleHashChange();