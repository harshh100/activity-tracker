document.addEventListener('DOMContentLoaded', function () {
    const usernameInput = document.getElementById('usernameInput');
    const addBtn = document.getElementById('addBtn');
    const userList = document.getElementById('userList');
    const logsContainer = document.getElementById('logsContainer');
    const exportBtn = document.getElementById('exportBtn');
    const clearBtn = document.getElementById('clearBtn');

    // Load tracked users and logs
    chrome.storage.sync.get(['trackedUsers', 'activityLogs'], function (data) {
        if (data.trackedUsers) {
            data.trackedUsers.forEach(user => {
                addUserToList(user);
            });
        }

        if (data.activityLogs) {
            data.activityLogs.forEach(log => {
                addLogToContainer(log);
            });
        }
    });

    // Add user to tracking list
    addBtn.addEventListener('click', function () {
        const username = usernameInput.value.trim();
        if (username) {
            chrome.storage.sync.get(['trackedUsers'], function (data) {
                const trackedUsers = data.trackedUsers || [];
                if (!trackedUsers.includes(username)) {
                    trackedUsers.push(username);
                    chrome.storage.sync.set({ trackedUsers }, function () {
                        addUserToList(username);
                        usernameInput.value = '';

                        // Send message to content script to start tracking
                        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                            chrome.tabs.sendMessage(tabs[0].id, {
                                action: 'startTracking',
                                username: username
                            });
                        });
                    });
                }
            });
        }
    });

    // Remove user from tracking list
    function addUserToList(username) {
        const li = document.createElement('li');
        li.innerHTML = `
        <span>${username}</span>
        <button class="remove-user" data-username="${username}">Remove</button>
      `;
        userList.appendChild(li);

        li.querySelector('.remove-user').addEventListener('click', function () {
            const username = this.getAttribute('data-username');
            chrome.storage.sync.get(['trackedUsers'], function (data) {
                const trackedUsers = data.trackedUsers || [];
                const updatedUsers = trackedUsers.filter(u => u !== username);
                chrome.storage.sync.set({ trackedUsers: updatedUsers }, function () {
                    li.remove();

                    // Send message to content script to stop tracking
                    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            action: 'stopTracking',
                            username: username
                        });
                    });
                });
            });
        });
    }

    // Add log entry to UI
    function addLogToContainer(log) {
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        logEntry.textContent = log;
        logsContainer.appendChild(logEntry);
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }

    // Export logs
    exportBtn.addEventListener('click', function () {
        chrome.storage.sync.get(['activityLogs'], function (data) {
            if (data.activityLogs && data.activityLogs.length > 0) {
                const logsText = data.activityLogs.join('\n');
                const blob = new Blob([logsText], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = url;
                a.download = `instagram_activity_logs_${new Date().toISOString().slice(0, 10)}.txt`;
                a.click();

                URL.revokeObjectURL(url);
            }
        });
    });

    // Clear logs
    clearBtn.addEventListener('click', function () {
        chrome.storage.sync.set({ activityLogs: [] }, function () {
            logsContainer.innerHTML = '';
        });
    });

    // Listen for new logs from background script
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.action === 'newLog') {
            addLogToContainer(request.log);
        }
    });
});