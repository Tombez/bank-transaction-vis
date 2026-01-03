if (window.debugIphone) {
    const oldDebug = console.debug.bind(console);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const logToPage = msg => {
        const p = container.appendChild(document.createElement('p'));
        p.textContent = msg;
        p.className = 'console-output';
    };
    console.log = console.error = console.debug = console.warn = (...args) => {
        oldDebug.apply(console, args);
        let str = [...args].map(a => String(a)).join(', ');
        if (str.length > 200) str = str.slice(0,200) + '...' + str.length;
        logToPage(str);
    };
    window.addEventListener('error', (error) => {
        logToPage(error.message, Object.keys(error));
    });
}