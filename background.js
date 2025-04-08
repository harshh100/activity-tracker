// We don't need much background functionality for this extension
chrome.runtime.onInstalled.addListener(() => {
    console.log('Instagram Activity Logger installed');
});