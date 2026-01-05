let currentUser = null;
        const API_URL = 'https://script.google.com/macros/s/AKfycbw3yR9lZXmq9cxevh0J0z368JAH3GtW05er-T5ZtDWDKe7Wllegf-H9jraP4437CA/exec';
        // ✅ 新增：從 localStorage 還原登入者
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
        }

        const userDatabase = new Map();
        userDatabase.set("admin", { account: "admin", password: "123", name: "系統管理員", phone: "0912345678", email: "admin@example.com" });

        const orderList = [];
        let isEditing = false;

        // 儲存用戶加入的訂單紀錄 (joinedOrderEntries)
        const joinedOrderEntries = [];

        let selectedOrderForJoining = null;
        // 儲存目前在 OrderDetail 或 payment 頁面查看的訂單索引
        let currentViewingOrderIndex = -1;

        // ====== 上傳菜單 ======
        // 圖片預覽功能
        function previewMenuImage(event) {
            const reader = new FileReader();
            reader.onload = function () {
                const output = document.getElementById('menuImagePreview');
                output.src = reader.result;
                output.style.display = 'block';
            };
            if (event.target.files[0]) {
                reader.readAsDataURL(event.target.files[0]);
            }
        }

        function saveNewOrder() {
  if (!currentUser || !currentUser.name) {
    alert('請先登入');
    showPage('User');
    return;
  }

  const title = document.getElementById('newOrderTitle').value.trim();
  if (!title) {
    alert('請填寫訂單標題');
    return;
  }

  // 1. 優化：檢查預覽圖是否存在，如果 src 是空的或包含 "http" (代表沒換新圖)，就不要傳 Base64
  const previewImg = document.getElementById('menuImagePreview');
  let imageBase64 = null;
  
  // 只有當圖片顯示中，且 src 開頭是 data: (代表是新選的 Base64) 才抓取
  if (previewImg.style.display !== 'none' && previewImg.src.startsWith('data:')) {
    imageBase64 = previewImg.src;
  }

  const orderData = {
    id: Date.now(),
    title: title,
    hostName: currentUser.name,
    host: document.getElementById('newOrderHost').value || '',
    deadline: document.getElementById('newOrderDeadline').value || '',
    description: document.getElementById('newOrderDescription').value || '',
    contact: document.getElementById('newOrderContact').value || '',
    contact2: document.getElementById('newOrderContact2').value || '',
    contact3: document.getElementById('newOrderContact3').value || '',
    password: document.getElementById('newOrderPassword').value || '',
    menuImageBase64: imageBase64 // 這是要傳給後端存 Drive 的
  };

  // 2. 優化：增加按鈕讀取狀態，防止使用者連續點擊發布兩次
  const submitBtn = event.target; 
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = '處理中...';

  fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'createOrder',
      ...orderData
    })
  })
    .then(res => res.json())
    .then(result => {
      if (!result.success) {
        alert('建立失敗：' + (result.message || '未知錯誤'));
        return;
      }

      // 3. ✅ 關鍵：使用後端回傳的 Google Drive 永久網址
      orderData.menuImageUrl = result.imageUrl;
      // 移除巨大的 Base64 避免佔用瀏覽器記憶體
      delete orderData.menuImageBase64; 

      orderList.push(orderData);

      alert(`揪團「${title}」建立成功！`);
      resetFormFields();
      showPage('Order');
    })
    .catch(err => {
      console.error(err);
      alert('建立訂單發生錯誤，請檢查網路連線或後端設定。');
    })
    .finally(() => {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    });
}

        // 輔助清空函數
        function resetFormFields() {
            const ids = ['newOrderTitle', 'newOrderHost', 'newOrderDeadline', 'newOrderContact', 'newOrderContact2', 'newOrderContact3', 'newOrderPassword', 'newOrderDescription'];
            ids.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            const img = document.getElementById('menuImagePreview');
            if (img) { img.style.display = 'none'; img.src = ''; }
        }

        // ====== 輔助函數：檢查訂單是否已過期 ======
        function isOrderExpired(order) {
            if (!order.deadline) {
                return false;
            }
            const deadlineTime = new Date(order.deadline).getTime();
            const currentTime = new Date().getTime();
            return currentTime > deadlineTime;
        }

        // ====== 輔助函數：根據 ID 查找填單紀錄的 Index ======
        function getEntryIndexById(entryId) {
            return joinedOrderEntries.findIndex(entry => entry.entryData.id === entryId);
        }

        // ====== 函數：動態渲染「我加的單」頁面 ======
        function renderJoinedOrderList() {
            const listContainer = document.getElementById('myJoinedOrderList');
            listContainer.innerHTML = '';
            listContainer.className = 'list-grid';

            if (joinedOrderEntries.length === 0) {
                listContainer.innerHTML =
                    '<p style="color:#6c757d;">目前沒有加入任何訂單紀錄。</p>';
                return;
            }

            joinedOrderEntries.slice().reverse().forEach((entry) => {
                const order = entry.order;
                const entryData = entry.entryData;
                const expired = isOrderExpired(order);
                const statusText = expired ? '已結束' : '進行中';
                const canEdit = !expired;
                const entryId = entryData.id;

                const card = document.createElement('div');
                card.className = 'order-card';

                const noteDisplay = entryData.note
                    ? `<br><strong>備註：</strong>${entryData.note}`
                    : '';

                card.innerHTML = `
            <div>
                <h3>[${statusText}] ${order.title}</h3>
                <div class="order-meta">主揪：${order.hostName}</div>
                <div class="order-desc">
                    <strong>我的品項：</strong>${entryData.item}
                    （$${entryData.amount}）
                    ${noteDisplay}<br>
                    <strong>截止時間：</strong>
                    ${order.deadline ? new Date(order.deadline).toLocaleString() : '未設定'}
                </div>
            </div>

            <div class="card-actions">
                <button class="btn-detail"
                    onclick="alert(
                        '詳細內容\\n' +
                        '品項：${entryData.item}\\n' +
                        '金額：$${entryData.amount}\\n' +
                        '電話：${entryData.phone || '未填'}\\n' +
                        '備註：${entryData.note || '無'}'
                    )">
                    查看我的填單
                </button>

                ${canEdit
                        ? `<button class="btn-edit"
                        onclick="showEditJoinedEntryPage(${entryId})">
                        修改填單
                       </button>`
                        : `<button class="btn-edit" disabled style="opacity:.5;cursor:default;">
                        已結束
                       </button>`
                    }
            </div>
        `;

                listContainer.appendChild(card);
            });
        }

        // ====== 函數：顯示修改填單頁面 ======
        function showEditJoinedEntryPage(entryId) {
            const index = getEntryIndexById(entryId);
            const entry = joinedOrderEntries[index];

            if (index === -1 || !entry) {
                alert("錯誤：找不到該填單紀錄。");
                return;
            }

            // 將資料載入到編輯頁面
            document.getElementById('editEntryId').value = entryId;
            document.getElementById('editFillOrderTitle').textContent = entry.order.title;
            document.getElementById('editFillName').value = entry.entryData.name;
            document.getElementById('editFillPhone').value = entry.entryData.phone;
            document.getElementById('editFillItem').value = entry.entryData.item;
            document.getElementById('editFillAmount').value = entry.entryData.amount;
            document.getElementById('editFillNote').value = entry.entryData.note || '';

            showPage('SearchService5');
        }

        // ====== 函數：刪除加單紀錄 (新增) ======
        function deleteJoinedEntry(entryId) {
            const index = getEntryIndexById(entryId);

            if (index === -1 || !joinedOrderEntries[index]) {
                alert("錯誤：無效的填單紀錄 ID 或找不到紀錄。");
                showPage('JoinOrder');
                return;
            }

            const entry = joinedOrderEntries[index];
            const orderTitle = entry.order.title;

            if (!confirm(`您確定要刪除在訂單「${orderTitle}」中的這筆加單紀錄嗎？此操作無法復原。`)) {
                return;
            }

            // 1. 從 joinedOrderEntries (我加的單) 中刪除
            joinedOrderEntries.splice(index, 1);

            // 2. 同步從 orderList (我揪的單) 中對應的 members 陣列刪除
            const correspondingOrder = entry.order;
            if (correspondingOrder && correspondingOrder.members) {
                const memberIndex = correspondingOrder.members.findIndex(m => m.id === entryId);
                if (memberIndex !== -1) {
                    correspondingOrder.members.splice(memberIndex, 1);
                }
            }

            alert(`訂單「${orderTitle}」的填單紀錄已成功刪除！`);
            showPage('JoinOrder');
        }

        // ====== 函數：儲存已修改的填單資料 ======
        function submitEditedJoinedEntry() {
            const entryId = parseInt(document.getElementById('editEntryId').value);
            const index = getEntryIndexById(entryId);

            if (index === -1 || !joinedOrderEntries[index]) {
                alert("錯誤：無效的填單紀錄 ID 或找不到紀錄。");
                return;
            }

            const newPhone = document.getElementById('editFillPhone').value;
            const newItem = document.getElementById('editFillItem').value;
            const newAmount = document.getElementById('editFillAmount').value;
            const newNote = document.getElementById('editFillNote').value;

            if (!newItem || !newAmount) {
                alert("請填寫品項和金額才能儲存修改。");
                return;
            }

            // 1. 更新 joinedOrderEntries 中的數據 (我加的單)
            joinedOrderEntries[index].entryData.phone = newPhone;
            joinedOrderEntries[index].entryData.item = newItem;
            joinedOrderEntries[index].entryData.amount = parseFloat(newAmount) || 0;
            joinedOrderEntries[index].entryData.note = newNote;

            // 2. 同步更新到 orderList 中對應的團員數據 (我揪的單)
            const correspondingOrder = joinedOrderEntries[index].order;
            if (correspondingOrder && correspondingOrder.members) {
                const memberIndex = correspondingOrder.members.findIndex(m => m.id === entryId);
                if (memberIndex !== -1) {
                    correspondingOrder.members[memberIndex].item = newItem;
                    correspondingOrder.members[memberIndex].amount = parseFloat(newAmount) || 0;
                    correspondingOrder.members[memberIndex].phone = newPhone;
                    correspondingOrder.members[memberIndex].note = newNote;
                }
            }

            alert(`訂單「${joinedOrderEntries[index].order.title}」的填單資料已成功更新！`);

            showPage('JoinOrder');
        }

        // ====== 函數：動態渲染「我揪的單」頁面 ======
        function renderOrderList() {
            const container = document.getElementById('myOrderList');
            container.innerHTML = '';
            container.className = 'list-grid';


            const activeOrders = orderList.filter(o => !isOrderExpired(o));

            if (activeOrders.length === 0) {
                container.innerHTML =
                    '<p style="color:#6c757d;">目前沒有你建立的進行中訂單。</p>';
                return;
            }

            container.innerHTML = '';

            activeOrders.forEach(order => {
                const index = orderList.indexOf(order);

                const card = document.createElement('div');
                card.className = 'order-card';

                // 修改後的 renderOrderList 函數片段
                card.innerHTML = `
    <div>
        <h3>${order.title}</h3>
        <div class="order-meta">登記時間：${order.publishTime}</div>
        <div class="order-desc">
             主揪：${order.hostName}<br>
             截止：${new Date(order.deadline).toLocaleString()}
        </div>
    </div>
    <div class="card-actions">
      <button class="btn-detail" style="background-color: #2ecc71;" onclick="viewOrderMembers(${index})">團員資料</button>
      <button class="btn-edit" onclick="editOrder(${index})">修改</button>
      <button class="btn-edit" style="background-color: #e74c3c;" onclick="deleteOrder(${index})">刪除</button>
    </div>
`;
                container.appendChild(card);
            });
        }

        // 頁面切換邏輯
        function showPage(pageId) {
            document.querySelectorAll('.page').forEach(page => {
                page.classList.remove('active');
            });
            document.getElementById(pageId).classList.add('active');

            if (pageId === 'Order') {
                renderOrderList();
            } else if (pageId === 'JoinOrder') {
                renderJoinedOrderList();
            } else if (pageId === 'payment') {
                isEditing = false;
                renderPayList();
            } else if (pageId === 'HistoryRecord') {
                renderHistoryList();
            } else if (pageId === 'SearchService4') {
                // 進入填單頁面時，預填使用者名稱/電話
                if (currentUser) {
                    document.getElementById('fillName').value = currentUser.name || '';
                    document.getElementById('fillPhone').value = currentUser.phone || '';
                }
                if (selectedOrderForJoining) {
                    document.getElementById('fillOrderTitle').textContent = selectedOrderForJoining.title;
                }
            } else if (pageId === 'Page') {
                // 載入用戶資料
                if (currentUser) {
                    document.getElementById('userName').value = currentUser.name || '';
                    document.getElementById('userPhone').value = currentUser.phone || '';
                    document.getElementById('userEmail').value = currentUser.email || '';
                }
            }

            const isMainContent = ['MainPage', 'Order', 'JoinOrder', 'HistoryRecord', 'SearchService', 'Member', 'OrderDetail', 'payment', 'OrderDetail2', 'payment2', 'OrderDetail1', 'payment1', 'Page', 'SearchService1', 'SearchService2', 'SearchService3', 'SearchService4', 'NewOrderPage', 'SearchService5'].includes(pageId);
            document.getElementById('mainHeader').style.display = isMainContent ? 'flex' : 'none';

            const fabButton = document.getElementById('fabAddButton');
            const pagesToShowFab = ['MainPage', 'Order', 'JoinOrder', 'HistoryRecord', 'SearchService', 'SearchService1', 'OrderDetail', 'payment', 'OrderDetail2', 'payment2', 'OrderDetail1', 'payment1', 'Member', 'Page'];
            const showFab = currentUser && pagesToShowFab.includes(pageId);
            fabButton.style.display = showFab ? 'block' : 'none';

            if (!currentUser && pageId !== 'User' && pageId !== 'UserProfile') {
                showPage('User');
                alert('請先登入！');
            }
        }
        function login() {
            const account = document.getElementById('loginAccount').value;
            const password = document.getElementById('loginPassword').value;
            fetch(API_URL, {
                method: 'POST',

                body: JSON.stringify({
                    action: 'login',
                    account,
                    password
                })
            })
                .then(res => res.json())
                .then(result => {
                    if (!result.success) {
                        alert(result.message);
                        return;
                    }

                    // ✅ 登入成功，存目前使用者
                    currentUser = result.user;
                    alert('登入成功，歡迎 ' + currentUser.name);

                    // 例如切換頁面
                    showPage('MainPage');
                });
            /*if (!account || !password) {
                alert('請輸入帳號和密碼。');
                return;
            }
            if (!userDatabase.has(account)) {
                alert('登入失敗：帳號不存在。');
                return;
            }
            const userData = userDatabase.get(account);

            if (userData.password === password) {
                currentUser = userData;

                // ✅ 新增：存進 localStorage（關鍵）
                localStorage.setItem('currentUser', JSON.stringify(userData));

                alert(`登入成功！歡迎 ${userData.name}`);
                showPage('MainPage');
            }
            else {
                alert('登入失敗：密碼錯誤。');
            }*/
        }

        function register() {
            const newAccount = document.getElementById('registerAccount').value;
            const newPassword = document.getElementById('registerPassword').value;
            const newName = document.getElementById('registerName').value;
            const phone = document.querySelector('#UserProfile input[placeholder="電話: String"]').value;
            const email = document.querySelector('#UserProfile input[placeholder="電子郵件: String"]').value;

            if (!newAccount || !newPassword || !newName) {
                alert("註冊失敗：帳號、密碼和姓名都必須填寫。");
                return;
            }

            if (userDatabase.has(newAccount)) {
                alert("註冊失敗：此帳號已被註冊。");
                return;
            }
            userDatabase.set(newAccount,
                {
                    account: newAccount,
                    password: newPassword,
                    name: newName,
                    phone: phone,
                    email: email
                });

            alert(`註冊成功！帳號：${newAccount}`);
            showPage('User');
            fetch(API_URL, {
                method: 'POST',

                body: JSON.stringify({
                    action: 'register',
                    newAccount,
                    newPassword,
                    newName,
                    phone,
                    email
                })
            });

        }

        function saveUserProfile() {
            if (currentUser) {
                currentUser.name = document.getElementById('userName').value;
                currentUser.phone = document.getElementById('userPhone').value;
                currentUser.email = document.getElementById('userEmail').value;

                // 存回 userDatabase
                userDatabase.set(currentUser.account, currentUser);

                // ⭐ 一定要加：同步更新 localStorage（關鍵）
                localStorage.setItem('currentUser', JSON.stringify(currentUser));

                alert('個人資料已儲存！');
            }
        }

        function logout() {
            currentUser = null;

            // ✅ 新增：清除 localStorage 的登入者
            localStorage.removeItem('currentUser');

            alert('登出成功。');
            showPage('User');
        }

        // ====== 函數：搜尋訂單 (修正：只搜尋標題的連續子字串) ======
        function searchOrder() {
            const keyword = document.getElementById('searchKeyword').value.trim().toLowerCase();
            const resultList = document.getElementById('searchResultList');
            resultList.innerHTML = '';
            resultList.className = 'list-grid';

            if (keyword === '') {
                alert('請輸入搜尋關鍵字。');
                return;
            }

            const searchResults = orderList.filter(order =>
                order.title.toLowerCase().includes(keyword)
            );

            if (searchResults.length === 0) {
                resultList.innerHTML =
                    `<p style="color:#6c757d;">沒有找到與「${keyword}」相關的訂單。</p>`;
            } else {
                searchResults.forEach(order => {
                    const isExpired = isOrderExpired(order);
                    const statusText = isExpired ? '已結束' : '進行中';
                    const buttonText = isExpired ? '查看詳情' : '加入訂單';

                    const card = document.createElement('div');
                    card.className = 'order-card';

                    card.onclick = function () {
                        if (isExpired) {
                            showHistoryOrderDetail(orderList.indexOf(order));
                        } else {
                            selectedOrderForJoining = order;
                            document.getElementById('joinOrderTitle').textContent =
                                `訂單：${order.title}`;
                            document.getElementById('joinPasswordInput').value = '';
                            showPage('SearchService2');
                        }
                    };

                    card.innerHTML = `
                <div>
                    <h3>[${statusText}] ${order.title}</h3>
                    <div class="order-meta">
                        店家：${order.host}
                    </div>
                    <div class="order-desc">
                        截止時間：
                        ${order.deadline
                            ? new Date(order.deadline).toLocaleDateString()
                            : '未設定'}
                    </div>
                </div>

                <div class="card-actions">
                    <button class="btn-detail"
                        onclick="event.stopPropagation(); this.parentNode.parentNode.click();">
                        ${buttonText}
                    </button>
                </div>
            `;

                    resultList.appendChild(card);
                });
            }

            showPage('SearchService1');
        }

        function checkJoinPassword() {
            const pwdInput = document.getElementById('joinPasswordInput').value;

            // 1. 驗證密碼 (對比 order 物件中的 password)
            // 注意：請確保您的 saveNewOrder 有儲存 password 欄位
            if (pwdInput === selectedOrderForJoining.password || selectedOrderForJoining.password === "") {

                // 2. 填充文字資訊
                document.getElementById('infoTitle').textContent = selectedOrderForJoining.title;
                document.getElementById('infoHost').textContent = selectedOrderForJoining.host || '未填';
                document.getElementById('infoDeadline').textContent = selectedOrderForJoining.deadline ? new Date(selectedOrderForJoining.deadline).toLocaleString() : '未設定';
                document.getElementById('infoDescription').textContent = selectedOrderForJoining.description || '無備註';

                // 3. ⭐ 顯示圖片的核心邏輯 ⭐
                const infoImg = document.getElementById('infoMenuImage');

                if (selectedOrderForJoining.menuImageUrl) {
                    // 如果訂單有圖片數據 (Base64 或 URL)
                    infoImg.src = selectedOrderForJoining.menuImageUrl;
                    infoImg.style.display = 'block'; // 顯示圖片
                    infoImg.style.maxWidth = '100%'; // 確保不超出邊框
                    infoImg.style.marginTop = '15px';
                } else {
                    // 如果沒有圖片
                    infoImg.src = '';
                    infoImg.style.display = 'none'; // 隱藏圖片標籤
                }

                // 4. 切換頁面
                showPage('SearchService3');

            } else {
                alert("密碼錯誤，請重新輸入。");
            }
        }

        function showOrderInfo(order) {
            document.getElementById('infoTitle').textContent = order.title || '無';
            document.getElementById('infoHost').textContent = order.host || '無';
            document.getElementById('infoDeadline').textContent =
                order.deadline ? new Date(order.deadline).toLocaleString() : '未設定';

            document.getElementById('infoDescription').innerHTML =
                order.description ? order.description.replace(/\n/g, '<br>') : '無';

            // ⭐ 菜單圖片顯示（重點）
            const img = document.getElementById('infoMenuImage');
            if (order.menuImageUrl) {
                img.src = order.menuImageUrl;
                img.style.display = 'block';
            } else {
                img.style.display = 'none';
            }

            showPage('SearchService3');
        }

        // ====== 函數：送出加入訂單的資料 ======
        function submitJoinOrder() {
            if (!selectedOrderForJoining) {
                alert("錯誤：未選擇任何訂單，無法送出。");
                showPage('SearchService1');
                return;
            }

            const name = document.getElementById('fillName').value;
            const phone = document.getElementById('fillPhone').value;
            const item = document.getElementById('fillItem').value;
            const amount = document.getElementById('fillAmount').value;
            const note = document.getElementById('fillNote').value;

            if (!name || !item || !amount) {
                alert("請填寫姓名、品項和金額才能送出。");
                return;
            }

            const entryData = {
                id: Date.now(),
                name: name,
                phone: phone,
                item: item,
                amount: parseFloat(amount) || 0,
                note: note || '',
                isPaid: false,
                joinTime: new Date().toLocaleString()
            };

            // 1. 將填單資料推入到「訂單物件」自己的團員陣列中
            if (!selectedOrderForJoining.members) {
                selectedOrderForJoining.members = [];
            }
            selectedOrderForJoining.members.push(entryData);

            // 2. 將填單資料同步到 joinedOrderEntries (我加的單)
            joinedOrderEntries.push({
                order: selectedOrderForJoining,
                entryData: entryData
            });
            fetch(API_URL, {
                method: 'POST',

                body: JSON.stringify({
                    action: 'joinOrder',
                    name,
                    amount,
                    note
                })
            });

            console.log(`已將新團員資料提交給訂單: ${selectedOrderForJoining.title}`, entryData);

            // 清空欄位
            document.getElementById('fillItem').value = '';
            document.getElementById('fillAmount').value = '';
            document.getElementById('fillNote').value = '';

            alert(`成功加入訂單「${selectedOrderForJoining.title}」！您的填單紀錄已同步到「我加的單」。`);
            selectedOrderForJoining = null; // 清空選擇狀態
            showPage('JoinOrder');
        }

        function renderHistoryList() {
            const listContainer = document.getElementById('myHistoryOrderList');
            if (!listContainer) return; // 防呆：找不到容器就不執行

            listContainer.innerHTML = ''; // 清空內容
            listContainer.className = 'list-grid';

            // 1. 篩選出已結束的訂單
            const expiredOrders = orderList.filter(order => isOrderExpired(order));

            // 2. 如果沒有歷史紀錄，顯示提示文字
            if (expiredOrders.length === 0) {
                listContainer.innerHTML = '<p style="color:#6c757d; text-align:center; width:100%;">目前沒有已結束的歷史訂單紀錄。</p>';
                return;
            }

            // 3. 執行渲染 (使用 slice().reverse() 讓最新的歷史紀錄排在最前面)
            expiredOrders.slice().reverse().forEach((order) => {
                // 獲取該訂單在原始 orderList 中的索引，確保「查看」按鈕能抓到正確資料
                const originalIndex = orderList.indexOf(order);

                const card = document.createElement('div');
                card.className = 'order-card'; // 統一使用你的 order-card 樣式

                // 點擊整個卡片也能查看詳情
                card.onclick = function () { showHistoryOrderDetail(originalIndex); };

                card.innerHTML = `
            <div>
                <h3><span style="color:#e74c3c;">[已結束]</span> ${order.title}</h3>
                <div class="order-meta">
                    主揪：${order.hostName || '未知'} ｜ 店家：${order.host || '未填'}
                </div>
                <div class="order-desc">
                    截止時間：${order.deadline ? new Date(order.deadline).toLocaleString() : '未設定'}
                </div>
            </div>
            <div class="card-actions">
                <button class="btn-detail" 
                    onclick="event.stopPropagation(); showHistoryOrderDetail(${originalIndex})">
                    查看歷史詳情
                </button>
            </div>
        `;
                listContainer.appendChild(card);
            });
        }

        function showHistoryOrderDetail(index) {
            const order = orderList[index];
            const detailContainer = document.getElementById('historyOrderDetailContent');

            detailContainer.innerHTML = `
                <p><strong>標題:</strong> ${order.title}</p>
                <p><strong>主辦/店家:</strong> ${order.host}</p>
                <p><strong>發布時間:</strong> ${order.publishTime}</p>
                <p><strong>截止時間:</strong> ${order.deadline ? new Date(order.deadline).toLocaleString() : '未設定'}</p>
                <p><strong>聯絡電話:</strong> ${order.contact}</p>
                <p><strong>幫湊免運資訊:</strong> ${order.contact2}</p>
                <p><strong>其他聯絡方式:</strong> ${order.contact3}</p>
                <p><strong>菜單/備註:</strong> <br>${order.description.replace(/\n/g, '<br>')}</p>
                <hr>
                <p style="color: #dc3545; font-weight: bold;">此訂單已結束，無法加入或編輯。</p>
            `;
            showPage('OrderDetail1');
        }

        function showOrderDetail(index) {
            currentViewingOrderIndex = index;
            const order = orderList[index];
            const detailContainer = document.getElementById('orderDetailContent');

            if (!order) {
                detailContainer.innerHTML = '<p style="color:red;">找不到訂單資料</p>';
                showPage('OrderDetail');
                return;
            }

            const imageHtml = order.menuImageUrl
                ? `<div style="margin:15px 0;">
               <img src="${order.menuImageUrl}"
                    style="max-width:100%; border-radius:8px;">
           </div>`
                : '<p style="color:#888;">（無菜單圖片）</p>';

            const descriptionHtml = order.description
                ? order.description.replace(/\n/g, '<br>')
                : '無';

            detailContainer.innerHTML = `
        <p><strong>標題：</strong>${order.title || '無'}</p>
        <p><strong>主揪：${order.hostName}
        <p><strong>店家：</strong>${order.host || '無'}</p>
        <p><strong>發布時間：</strong>${order.publishTime || '無'}</p>
        <p><strong>截止時間：</strong>
            ${order.deadline ? new Date(order.deadline).toLocaleString() : '未設定'}
        </p>
        <p><strong>聯絡電話：</strong>${order.contact || '無'}</p>
        <p><strong>幫湊免運資訊：</strong>${order.contact2 || '無'}</p>
        <p><strong>其他聯絡方式：</strong>${order.contact3 || '無'}</p>
        <p><strong>加單密碼：</strong>${order.password || '無'}</p>

        <hr>

        <p><strong>菜單 / 備註：</strong><br>${descriptionHtml}</p>

        ${imageHtml}

        <hr>

        <button class="primary" onclick="showPage('payment')">
            查看揪團資料（團員 / 付款狀態）
        </button>
    `;

            showPage('OrderDetail');
        }

        // ====== 函數：渲染團員列表 (我揪的單) ======
        function renderPayList() {
            const container = document.getElementById('payListContainer');
            const order = orderList[currentViewingOrderIndex];
            if (!order) return;

            container.innerHTML = '';
            const readOnlyAttr = isEditing ? '' : 'readonly';

            order.members.forEach((member, idx) => {
                const row = document.createElement('div');
                row.className = 'paylist-row';
                row.innerHTML = `
            <div class="col-name">${member.name}</div>
            <div class="col-item">
                <input type="text" id="inputItem_${idx}" value="${member.item}" ${readOnlyAttr}>
            </div>
            <div class="col-amount">
                <input type="number" id="inputAmount_${idx}" value="${member.amount}" ${readOnlyAttr}>
            </div>
            <div class="col-paid">
                <input type="checkbox" id="inputPaid_${idx}" ${member.paid ? 'checked' : ''} ${isEditing ? '' : 'disabled'}>
            </div>
            <div class="col-note">
                <input type="text" id="inputNote_${idx}" value="${member.note || ''}" ${readOnlyAttr}>
            </div>
        `;
                container.appendChild(row);
            });
        }

        function toggleEditMode(enable) {
            isEditing = enable; // 更新全域變數

            // 1. 切換按鈕顯示
            document.getElementById('editPayListButton').style.display = enable ? 'none' : 'inline-block';
            document.getElementById('savePayListButton').style.display = enable ? 'inline-block' : 'none';

            // 2. 重新渲染列表（renderPayList 會根據 isEditing 決定是否加 readonly）
            renderPayList();
        }

        function updatePaymentButtons(hideAll = false, noMembers = false) {
            const editBtn = document.getElementById('editPayListButton');
            const saveBtn = document.getElementById('savePayListButton');

            if (hideAll || noMembers) {
                editBtn.style.display = 'none';
                saveBtn.style.display = 'none';
            } else {
                editBtn.style.display = isEditing ? 'none' : 'inline-block';
                saveBtn.style.display = isEditing ? 'inline-block' : 'none';
            }
        }

        function handlePaidChange(memberId, isChecked) {
            const currentOrder = orderList[currentViewingOrderIndex];
            if (!currentOrder || !currentOrder.members) return;

            const member = currentOrder.members.find(m => m.id === memberId);
            if (member) {
                member.isPaid = isChecked;

                // 同步更新到 joinedOrderEntries
                const joinedEntryIndex = getEntryIndexById(memberId);
                if (joinedEntryIndex !== -1) {
                    joinedOrderEntries[joinedEntryIndex].entryData.isPaid = isChecked;
                }
            }
        }

        // ====== 函數：儲存團員列表 (我揪的單) ======
        function savePayList() {
            const order = orderList[currentViewingOrderIndex];

            // 1. 循環所有團員並抓取新值
            order.members.forEach((member, idx) => {
                const newItem = document.getElementById(`inputItem_${idx}`).value;
                const newAmount = parseFloat(document.getElementById(`inputAmount_${idx}`).value) || 0;
                const newPaid = document.getElementById(`inputPaid_${idx}`).checked;
                const newNote = document.getElementById(`inputNote_${idx}`).value;

                // 2. 更新主揪看到的 order 物件
                member.item = newItem;
                member.amount = newAmount;
                member.paid = newPaid;
                member.note = newNote;

                // 3. ⭐ 同步更新「參加者」端的 joinedOrderEntries 資料 ⭐
                // 透過 member.id (在填單時產生的 Date.now()) 來尋找對應紀錄
                const entryIdx = joinedOrderEntries.findIndex(e => e.entryData.id === member.id);
                if (entryIdx !== -1) {
                    joinedOrderEntries[entryIdx].entryData.item = newItem;
                    joinedOrderEntries[entryIdx].entryData.amount = newAmount;
                    joinedOrderEntries[entryIdx].entryData.paid = newPaid;
                    joinedOrderEntries[entryIdx].entryData.note = newNote;
                }
            });

            alert("修改成功！所有團員資料已同步更新。");
            toggleEditMode(false); // 儲存完後回到只讀模式
        }

        function cancelNewOrder() {
            if (confirm("確定要取消並刪除所有已填寫的資訊嗎？")) {
                // 清空欄位
                document.getElementById('newOrderTitle').value = '';
                document.getElementById('newOrderHost').value = '';
                document.getElementById('newOrderDeadline').value = '';
                document.getElementById('newOrderContact').value = '';
                document.getElementById('newOrderContact2').value = '';
                document.getElementById('newOrderContact3').value = '';
                document.getElementById('newOrderPassword').value = '';
                document.getElementById('newOrderDescription').value = '';

                alert("已取消填單。");
                showPage('MainPage');
            }
        }

        // 初始載入：顯示登入頁面
        document.addEventListener('DOMContentLoaded', () => {
            console.log("系統已啟動。");
            showPage('User');
        });
        //頭貼功能
        function toggleUserMenu() {
            const menu = document.getElementById('userMenu');
            menu.classList.toggle('active');

            if (currentUser) {
                document.getElementById('userGreeting').textContent =
                    `${currentUser.name}，你好！`;
                document.getElementById('userAccount').textContent =
                    currentUser.account;
            }
        }

        function closeUserMenu() {
            document.getElementById('userMenu').classList.remove('active');
        }

        function deleteOrder(index) {
            const order = orderList[index];
            if (!order) return;

            if (!confirm(`確定要刪除訂單「${order.title}」？\n此動作會一併刪除所有填單資料，無法復原。`)) {
                return;
            }

            // 1. 刪除所有「我加的單」中屬於此訂單的資料
            for (let i = joinedOrderEntries.length - 1; i >= 0; i--) {
                if (joinedOrderEntries[i].order === order) {
                    joinedOrderEntries.splice(i, 1);
                }
            }
            // 2. 從訂單清單刪除
            orderList.splice(index, 1);

            alert(`訂單「${order.title}」已刪除`);
            renderOrderList();
        }

        function deleteMember(memberId) {
            const order = orderList[currentViewingOrderIndex];
            if (!order || !order.members) return;

            if (!confirm("確定要刪除此填單者？")) return;

            // 1. 從訂單的 members 移除
            order.members = order.members.filter(m => m.id !== memberId);

            // 2. 從「我加的單」同步刪除
            const index = joinedOrderEntries.findIndex(e => e.entryData.id === memberId);
            if (index !== -1) {
                joinedOrderEntries.splice(index, 1);
            }

            renderPayList();
        }
        //我啾的單修改按鈕
        function viewOrderMembers(orderIndex) {
            const order = orderList[orderIndex];
            currentViewingOrderIndex = orderIndex; // 紀錄目前正在看的訂單索引

            // 1. 從所有填單紀錄中，篩選出「屬於這筆訂單」的資料
            // 這裡假設您的 entry 物件結構中有存 order 的 id
            const members = joinedOrderEntries.filter(entry => entry.order.id === order.id);

            // 2. 將篩選出的成員暫存到該 order 物件中，以便 payment 頁面讀取
            // 這樣可以確保顯示的是最新搜尋加入的成員
            order.members = members.map(m => m.entryData);

            // 3. 切換到 payment 頁面
            showPage('payment');
        }
        function editOrder(index) {
            const order = orderList[index];
            currentViewingOrderIndex = index;

            document.getElementById('newOrderTitle').value = order.title || '';
            document.getElementById('newOrderHost').value = order.host || '';
            document.getElementById('newOrderDeadline').value = order.deadline || '';
            document.getElementById('newOrderContact').value = order.contact || '';
            document.getElementById('newOrderContact2').value = order.contact2 || '';
            document.getElementById('newOrderContact3').value = order.contact3 || '';
            document.getElementById('newOrderPassword').value = order.password || '';
            document.getElementById('newOrderDescription').value = order.description || '';

            // 圖片預覽（如果有）
            if (order.menuImageUrl) {
                const img = document.getElementById('menuImagePreview');
                img.src = order.menuImageUrl;
                img.style.display = 'block';
            }

            showPage('NewOrderPage');
        }
        function togglePasswordVisibility(inputId) {
            const passwordInput = document.getElementById(inputId);
            const toggleBtn = passwordInput.nextElementSibling;

            // 定義眼睛 SVG 路徑 (直接顯示圖案)
            const eyeOpen = `<svg class="eye-icon" viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`;
            const eyeClosed = `<svg class="eye-icon" viewBox="0 0 24 24"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.82l2.92 2.92c1.51-1.26 2.7-2.89 3.44-4.74-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>`;

            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggleBtn.innerHTML = eyeOpen;
            } else {
                passwordInput.type = 'password';
                toggleBtn.innerHTML = eyeClosed;
            }
        }
       
     

