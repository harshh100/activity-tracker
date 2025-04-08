document.addEventListener('DOMContentLoaded', function () {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const clearLogsBtn = document.getElementById('clearLogs');
    const downloadLogsBtn = document.getElementById('downloadLogs');
    const usernameInput = document.getElementById('username');
    const logsDiv = document.getElementById('logs');
    const statusText = document.getElementById('statusText');
    const statusIndicator = document.getElementById('statusIndicator');

    // Load saved username and logs
    chrome.storage.sync.get(['monitoringUsername', 'activityLogs', 'isMonitoring'], function (data) {
        if (data.monitoringUsername) {
            usernameInput.value = data.monitoringUsername;
        }
        if (data.activityLogs) {
            displayLogs(data.activityLogs);
        }
        updateMonitoringStatus(data.isMonitoring || false);
    });

    startBtn.addEventListener('click', async function () {
        const username = usernameInput.value.trim();
        if (username) {
            try {
                // Save state first
                await chrome.storage.sync.set({
                    monitoringUsername: username,
                    isMonitoring: true
                });

                // Send message to content script
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab) {
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'startMonitoring',
                        username: username
                    });
                    updateMonitoringStatus(true);
                } else {
                    throw new Error('No active tab found');
                }
            } catch (error) {
                console.error('Error starting monitoring:', error);
                alert('Error starting monitoring. Make sure you\'re on Instagram.com');
                chrome.storage.sync.set({ isMonitoring: false });
                updateMonitoringStatus(false);
            }
        } else {
            alert('Please enter a username');
        }
    });

    stopBtn.addEventListener('click', async function () {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                await chrome.tabs.sendMessage(tab.id, { action: 'stopMonitoring' });
            }
            await chrome.storage.sync.set({ isMonitoring: false });
            updateMonitoringStatus(false);
        } catch (error) {
            console.error('Error stopping monitoring:', error);
        }
    });


    clearLogsBtn.addEventListener('click', function () {
        chrome.storage.sync.set({ activityLogs: [] });
        logsDiv.innerHTML = '';
    });

    downloadLogsBtn.addEventListener('click', function () {
        chrome.storage.sync.get(['activityLogs'], function (data) {
            if (data.activityLogs && data.activityLogs.length > 0) {
                const logsText = data.activityLogs.join('\n');
                const blob = new Blob([logsText], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = url;
                a.download = `instagram_activity_log_${new Date().toISOString().slice(0, 10)}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } else {
                alert('No logs to download');
            }
        });
    });

    // Listen for log updates
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.action === 'updateLogs') {
            displayLogs(request.logs);
            sendResponse({ success: true });
        } else if (request.action === 'updateStatus') {
            updateMonitoringStatus(request.isMonitoring);
            sendResponse({ success: true });
        }
        return true; // Keep the message channel open for sendResponse
    });

    function displayLogs(logs) {
        logsDiv.innerHTML = '';
        logs.forEach(log => {
            const logEntry = document.createElement('div');
            logEntry.className = 'log-entry';
            logEntry.textContent = log;
            logsDiv.appendChild(logEntry);
        });
        logsDiv.scrollTop = logsDiv.scrollHeight;
    }

    function updateMonitoringStatus(isMonitoring) {
        if (isMonitoring) {
            statusText.textContent = 'Monitoring ' + usernameInput.value;
            statusIndicator.className = 'status-indicator active';
        } else {
            statusText.textContent = 'Not monitoring';
            statusIndicator.className = 'status-indicator inactive';
        }
    }
});