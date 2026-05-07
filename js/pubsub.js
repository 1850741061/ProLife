// 简单发布订阅系统

const _listeners = new Map();

function subscribe(key, callback) {
    if (!_listeners.has(key)) _listeners.set(key, []);
    _listeners.get(key).push(callback);
}

function publish(key, value) {
    const cbs = _listeners.get(key);
    if (cbs) cbs.forEach(cb => cb(value));
}

function unsubscribe(key, callback) {
    const cbs = _listeners.get(key);
    if (cbs) {
        const idx = cbs.indexOf(callback);
        if (idx !== -1) cbs.splice(idx, 1);
    }
}
