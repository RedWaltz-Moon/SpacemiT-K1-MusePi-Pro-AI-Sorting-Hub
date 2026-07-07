// 深色 / 浅色主题切换 —— 共用脚本
(function () {
    const KEY = 'sd_theme';
    const saved = localStorage.getItem(KEY) || 'light';
    document.documentElement.setAttribute('data-theme', saved);

    function applyTheme(t) {
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem(KEY, t);
        const btn = document.getElementById('theme-toggle');
        if (btn) btn.textContent = t === 'dark' ? '☀' : '☾';
    }

    window.toggleTheme = function () {
        const cur = document.documentElement.getAttribute('data-theme') || 'light';
        applyTheme(cur === 'dark' ? 'light' : 'dark');
    };

    window.addEventListener('DOMContentLoaded', function () {
        if (document.getElementById('theme-toggle')) {
            applyTheme(saved);
            return;
        }
        const btn = document.createElement('button');
        btn.id = 'theme-toggle';
        btn.type = 'button';
        btn.setAttribute('aria-label', '切换主题');
        btn.title = '切换深色 / 浅色模式';
        btn.textContent = saved === 'dark' ? '☀' : '☾';
        btn.onclick = window.toggleTheme;
        btn.style.cssText =
            'position:fixed;right:18px;bottom:60px;z-index:9999;' +
            'width:38px;height:38px;border-radius:50%;border:1px solid var(--border,#e4e7ec);' +
            'background:var(--surface,#fff);color:var(--text-2,#475467);' +
            'font-size:16px;cursor:pointer;box-shadow:0 2px 8px rgba(16,24,40,.12);' +
            'display:flex;align-items:center;justify-content:center;font-family:inherit;' +
            'transition:transform .15s, background .15s;';
        btn.onmouseenter = () => btn.style.transform = 'scale(1.08)';
        btn.onmouseleave = () => btn.style.transform = 'scale(1)';
        document.body.appendChild(btn);
    });
})();
