// Instagram Activity Logger - Fully Working Version
let monitoringState = {
    isMonitoring: false,
    targetUsername: '',
    currentStatus: null,
    statusStartTime: null,
    checkInterval: null,
    lastLoggedMinute: null
};

// Initialize connection
if (window.location.hostname.includes('instagram.com')) {
    setupMessageListener();
    checkExistingSession();
}

function setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        switch (request.action) {
            case 'startMonitoring':
                if (!monitoringState.isMonitoring) {
                    startMonitoring(request.username);
                    sendResponse({ success: true });
                } else {
                    sendResponse({ success: false, message: 'Already monitoring' });
                }
                return true; // Keep channel open for async response

            case 'stopMonitoring':
                stopMonitoring();
                sendResponse({ success: true });
                return true;

            case 'getStatus':
                sendResponse({
                    ...monitoringState,
                    statusStartTime: monitoringState.statusStartTime?.toISOString()
                });
                return true;

            default:
                return false;
        }
    });
}

function checkExistingSession() {
    chrome.storage.sync.get(['isMonitoring', 'monitoringUsername'], (data) => {
        if (data.isMonitoring && data.monitoringUsername) {
            startMonitoring(data.monitoringUsername);
        }
    });
}

function startMonitoring(username) {
    // Initialize all state
    monitoringState = {
        isMonitoring: true,
        targetUsername: username.toLowerCase(),
        currentStatus: null,
        statusStartTime: null,
        checkInterval: null,
        lastLoggedMinute: null
    };

    // Store monitoring state
    chrome.storage.sync.set({
        isMonitoring: true,
        monitoringUsername: username
    });

    // Start checking immediately and every 5 seconds
    monitoringState.checkInterval = setInterval(() => {
        try {
            checkActiveStatus();
        } catch (error) {
            console.error('Monitoring error:', error);
        }
    }, 5000);

    // Initial check
    checkActiveStatus();

    console.log(`Started monitoring ${monitoringState.targetUsername}`);
    updatePopupStatus();
}

function stopMonitoring() {
    if (!monitoringState.isMonitoring) return;

    clearInterval(monitoringState.checkInterval);
    monitoringState.isMonitoring = false;
    chrome.storage.sync.set({ isMonitoring: false });
    console.log('Monitoring stopped');
    updatePopupStatus();
}

function checkActiveStatus() {
    if (!monitoringState.isMonitoring) return;

    const chatItems = document.querySelectorAll('[role="list"] [role="button"]');
    let foundUser = null;

    // Find target user
    for (const item of chatItems) {
        const usernameElement = item.querySelector('span[dir="auto"] span');
        if (usernameElement?.textContent?.toLowerCase() === monitoringState.targetUsername) {
            foundUser = item;
            break;
        }
    }

    if (!foundUser) {
        console.log(`User ${monitoringState.targetUsername} not found`);
        return;
    }

    // Method 1: Check for "Active now" or "Active Xm ago" text
    const activeStatusElement = Array.from(foundUser.querySelectorAll('span[dir="auto"]'))
        .find(el => el.textContent.includes('Active'));
    const activeText = activeStatusElement?.textContent?.toLowerCase() || '';
    const textActive = activeText.includes('active now');

    // Method 2: Check for green dot indicator
    const profilePhotoContainer = foundUser.querySelector('[style*="height: 56px"][style*="width: 56px"]');
    const greenDot = profilePhotoContainer?.querySelector('.x1wyv8x2, [class*="active"], .x13fuv20');
    const dotActive = !!greenDot;

    // User is active if either indicator is present
    // console.log("textActive : ", textActive);
    // console.log("dotActive : ", dotActive);
    const isActive = textActive || dotActive;

    // Rest of the status change handling remains the same...
    if (monitoringState.currentStatus !== isActive) {
        const now = new Date();

        if (isActive) {
            monitoringState.statusStartTime = now;
            const activeType = textActive ? "TEXT" : "GREEN_DOT";
            logActivity(`STATUS CHANGE: Became active (${activeType}) at ${formatTime(now)}`);
        } else if (monitoringState.statusStartTime) {
            const duration = (now - monitoringState.statusStartTime) / 1000;
            logActivity(`STATUS CHANGE: Went inactive after ${formatDuration(duration)}`);
        }

        monitoringState.currentStatus = isActive;
        updatePopupStatus();
    }

    // Minute logging remains the same...
    const currentMinute = new Date().getMinutes();
    if (monitoringState.lastLoggedMinute === null || currentMinute !== monitoringState.lastLoggedMinute) {
        monitoringState.lastLoggedMinute = currentMinute;
        logCurrentStatus();
    }
}

function logCurrentStatus() {
    const now = new Date();
    const status = monitoringState.currentStatus ? 'ACTIVE' : 'INACTIVE';
    let duration = '';

    if (monitoringState.currentStatus && monitoringState.statusStartTime) {
        duration = ` for ${formatDuration((now - monitoringState.statusStartTime) / 1000)}`;
    }

    logActivity(`STATUS UPDATE: ${status}${duration} at ${formatTime(now)}`);
}

function logActivity(message) {
    const timestamp = new Date().toISOString();
    const fullMessage = `[${timestamp}] ${monitoringState.targetUsername}: ${message}`;

    chrome.storage.sync.get(['activityLogs'], (data) => {
        const logs = data.activityLogs || [];
        logs.push(fullMessage);
        chrome.storage.sync.set({ activityLogs: logs });

        chrome.runtime.sendMessage({
            action: 'updateLogs',
            logs: logs
        }).catch(() => { });
    });

    console.log(fullMessage);
}

// Helper functions
function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return [
        hours > 0 ? `${hours}h` : '',
        minutes > 0 ? `${minutes}m` : '',
        `${secs}s`
    ].filter(Boolean).join(' ');
}

function updatePopupStatus() {
    chrome.runtime.sendMessage({
        action: 'updateStatus',
        status: {
            isMonitoring: monitoringState.isMonitoring,
            targetUsername: monitoringState.targetUsername,
            currentStatus: monitoringState.currentStatus,
            statusStartTime: monitoringState.statusStartTime?.toISOString(),
            lastUpdate: new Date().toISOString()
        }
    }).catch(() => { });
}