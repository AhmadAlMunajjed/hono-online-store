console.log('Main JavaScript loaded');
function renderHtml(fontName) {
    console.log('Rendering HTML with font:', fontName); 
    const styleElement = document.getElementById('dynamic-style');
    styleElement.innerHTML = `
        * {
            font-family: "${fontName}", sans-serif;
        }
    `;
}

// Use the fontName variable passed from Liquid
renderHtml(fontName);