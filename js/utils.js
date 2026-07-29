// 通用工具函数

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function animateValue(id, start, end, duration) {
    start = isNaN(start) ? 0 : start;
    end = isNaN(end) ? 0 : end;
    if (start === end) return;
    const obj = document.getElementById(id);
    const range = end - start;
    let current = start;
    const increment = end > start ? 1 : -1;
    const stepTime = Math.abs(Math.floor(duration / range));
    const timer = setInterval(function () {
        current += increment;
        obj.innerHTML = current;
        if (current === end) {
            clearInterval(timer);
        }
    }, Math.max(stepTime, 10));
}

function openModal(id) {
    const modal = document.getElementById(id);
    modal.classList.add('active');
    const modalContent = modal.querySelector('.modal');
    if (modalContent) {
        modalContent.classList.add('fade-in');
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    const modalContent = modal.querySelector('.modal');
    if (modalContent) {
        modalContent.classList.add('fade-out');
        setTimeout(() => {
            modal.classList.remove('active');
            modalContent.classList.remove('fade-out', 'fade-in');
        }, 200);
    } else {
        modal.classList.remove('active');
    }
}

let confirmResolve = null;

function showConfirm(title, message, options = ['取消', '确定']) {
    return new Promise((resolve) => {
        confirmResolve = resolve;
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        const buttonsContainer = document.getElementById('confirmButtons');
        const dialog = document.getElementById('confirmDialog');

        titleEl.textContent = title;
        messageEl.innerHTML = escapeHtml(message).replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
        buttonsContainer.innerHTML = '';

        options.forEach((optionText, index) => {
            const btn = document.createElement('button');
            btn.className = index === options.length - 1 ? 'btn btn-primary' : 'btn';
            btn.textContent = optionText;
            btn.style.width = '100%';
            btn.style.justifyContent = 'center';
            btn.style.marginBottom = index < options.length - 1 ? '10px' : '0';
            btn.onclick = () => {
                dialog.classList.remove('active');
                setTimeout(() => dialog.style.display = 'none', 300);
                resolve(index);
            };
            buttonsContainer.appendChild(btn);
        });

        dialog.style.display = 'flex';
        setTimeout(() => dialog.classList.add('active'), 10);
    });
}

function ensureSyncArray(value) {
    return Array.isArray(value) ? value : [];
}

function ensureSyncObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
