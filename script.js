document.addEventListener('DOMContentLoaded', () => {
    // --- Canvas and Context Setup ---
    const bgCanvas = document.getElementById("bgCanvas");
    const bgCtx = bgCanvas.getContext("2d");
    const drawCanvas = document.getElementById("drawCanvas");
    const drawCtx = drawCanvas.getContext("2d");

    // --- DOM Element References ---
    const sidebar = document.getElementById("sidebar");
    const toggleBtn = document.getElementById("toggleBtn");
    const controls = {
        sym: document.getElementById('sym'),
        symVal: document.getElementById('symVal'),
        size: document.getElementById('size'),
        sizeVal: document.getElementById('sizeVal'),
        glow: document.getElementById('glow'),
        glowVal: document.getElementById('glowVal'),
        fade: document.getElementById('fade'),
        fadeVal: document.getElementById('fadeVal'),
        gradSpeed: document.getElementById('gradSpeed'),
        gradVal: document.getElementById('gradVal'),
        color: document.getElementById('col'),
        preview: document.getElementById('brushPreview'),
        clearBtn: document.getElementById('clear'),
        undoBtn: document.getElementById('undo'),
        saveBtn: document.getElementById('save'),
        randomBtn: document.getElementById('random'),
        // Palettes removed
    };

    // --- Application State ---
    const state = {
        drawing: false,
        lastPoints: [],
        paths: [],
        dpr: window.devicePixelRatio || 1,
        gradShift: 0,
        neonPulse: 0, // New state for neon animation
        neonDirection: 1, // New state for neon animation direction
        settings: {
            symmetry: 6,
            size: 2,
            glow: 10,
            fadeAlpha: 0.0,
            color: '#00ffff',
            gradSpeed: 0.5,
        }
    };

    // --- Local Storage Functions ---
    const SETTINGS_KEY = 'mandalaSettings';

    function saveSettings() {
        try {
            // Remove rotationSpeed as it's no longer a control
            const settingsToSave = { ...state.settings };
            delete settingsToSave.rotationSpeed; 
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsToSave));
        } catch (e) {
            console.error("Could not save settings to localStorage.", e);
        }
    }

    function loadSettings() {
        try {
            const saved = localStorage.getItem(SETTINGS_KEY);
            if (saved) {
                const loadedSettings = JSON.parse(saved);
                Object.assign(state.settings, loadedSettings);
                // Clean up old rotationSpeed if it exists in loaded settings
                if (state.settings.rotationSpeed !== undefined) {
                    delete state.settings.rotationSpeed;
                }
            }
        } catch (e) {
            console.error("Could not load settings from localStorage.", e);
        }
    }
    
    // --- UI Update Function ---
    function updateUIFromState() {
        controls.sym.value = state.settings.symmetry;
        controls.size.value = state.settings.size;
        controls.glow.value = state.settings.glow;
        controls.fade.value = state.settings.fadeAlpha;
        controls.gradSpeed.value = state.settings.gradSpeed;
        controls.color.value = state.settings.color;

        controls.symVal.textContent = state.settings.symmetry;
        controls.sizeVal.textContent = state.settings.size.toFixed(1);
        controls.glowVal.textContent = state.settings.glow;
        controls.fadeVal.textContent = state.settings.fadeAlpha.toFixed(2);
        controls.gradVal.textContent = state.settings.gradSpeed.toFixed(1);
        controls.preview.style.background = state.settings.color;
    }
    
    // --- Canvas & Drawing Functions ---
    function resizeCanvas() {
        const r = drawCanvas.parentElement.getBoundingClientRect();
        [bgCanvas, drawCanvas].forEach(c => {
            c.width = r.width * state.dpr;
            c.height = r.height * state.dpr;
            c.style.width = `${r.width}px`;
            c.style.height = `${r.height}px`;
        });
        
        bgCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
        drawCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

        // Draw background gradient
        const g = bgCtx.createRadialGradient(r.width/2, r.height/2, 100, r.width/2, r.height/2, Math.max(r.width, r.height) / 1.5);
        g.addColorStop(0, "#222");
        g.addColorStop(1, "#000");
        bgCtx.fillStyle = g;
        bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

        redrawAll();
    }

    function drawSegment(points, settings, angle, mirror) {
        const w = drawCanvas.width / state.dpr;
        const h = drawCanvas.height / state.dpr;
        const cx = w / 2;
        const cy = h / 2;
        
        drawCtx.save();
        drawCtx.translate(cx, cy);
        drawCtx.rotate(angle);
        if (mirror) {
            drawCtx.scale(-1, 1);
        }
        drawCtx.translate(-cx, -cy);

        drawCtx.beginPath();
        drawCtx.moveTo(points[0].x, points[0].y);
        for (let j = 1; j < points.length; j++) {
            const midX = (points[j - 1].x + points[j].x) / 2;
            const midY = (points[j - 1].y + points[j].y) / 2;
            drawCtx.quadraticCurveTo(points[j - 1].x, points[j - 1].y, midX, midY);
        }
        drawCtx.stroke();
        drawCtx.restore();
    }
    
    function drawPath(points, s) {
        if (points.length < 2) return;
        
        const w = drawCanvas.width / state.dpr;
        
        // --- Setup drawing context ---
        drawCtx.lineCap = 'round';
        drawCtx.lineJoin = 'round';
        drawCtx.lineWidth = s.size;
        drawCtx.globalAlpha = 1 - s.fadeAlpha;
        drawCtx.globalCompositeOperation = 'lighter';

        // --- Handle color and gradients ---
        let color = s.color;
        if (s.gradSpeed > 0) {
            const g = drawCtx.createLinearGradient(0, 0, w, 0);
            g.addColorStop(0, `hsl(${ (state.gradShift) % 360 }, 100%, 60%)`);
            g.addColorStop(1, `hsl(${ (state.gradShift + 120) % 360 }, 100%, 60%)`);
            color = g;
        }
        drawCtx.strokeStyle = color;
        drawCtx.shadowColor = color;
        
        // Neon glow animation: shadowBlur pulses
        const animatedGlow = s.glow * (0.8 + Math.sin(state.neonPulse) * 0.2); // Glow pulses between 80% and 120% of set glow
        drawCtx.shadowBlur = animatedGlow;

        // --- Draw all symmetrical segments ---
        for (let i = 0; i < s.symmetry; i++) {
            const angle = i * 2 * Math.PI / s.symmetry;
            drawSegment(points, s, angle, false); // Main segment
            drawSegment(points, s, angle, true);  // Mirrored segment
        }

        // --- Reset context ---
        drawCtx.globalCompositeOperation = 'source-over';
        drawCtx.globalAlpha = 1;
        drawCtx.shadowBlur = 0;
    }

    function redrawAll() {
        const w = drawCanvas.width;
        const h = drawCanvas.height;

        drawCtx.save();
        drawCtx.clearRect(0, 0, w, h);
        
        // No global rotation as per request

        for (const p of state.paths) {
            drawPath(p.points, p.settings);
        }
        drawCtx.restore();
    }

    function mainLoop() {
        let shouldRedraw = false;
        
        if (state.settings.gradSpeed > 0) {
            state.gradShift += state.settings.gradSpeed;
            shouldRedraw = true;
        }

        // Animate neon pulse for glow
        state.neonPulse += 0.05 * state.neonDirection; // Adjust speed as needed
        if (state.neonPulse > Math.PI * 2) {
            state.neonPulse = 0; // Reset to loop smoothly
            // state.neonDirection *= -1; // Optionally reverse direction
        }
        shouldRedraw = true; // Always redraw for glow animation

        if (shouldRedraw) {
            redrawAll();
        }
        requestAnimationFrame(mainLoop);
    }
    
    // --- Event Handlers Setup ---
    function setupEventHandlers() {
        toggleBtn.onclick = () => {
            sidebar.classList.toggle("hidden");
            toggleBtn.classList.toggle("active");
        };

        // Handle all range input changes
        Object.keys(controls).forEach(key => {
            const el = controls[key];
            if (el && el.type === 'range') {
                el.oninput = e => {
                    const value = parseFloat(e.target.value);
                    const settingKey = e.target.id;
                    
                    if (settingKey === 'sym') state.settings.symmetry = parseInt(value);
                    else if (settingKey === 'fade') state.settings.fadeAlpha = value;
                    else state.settings[settingKey] = value;
                    
                    updateUIFromState();
                };
                el.onchange = saveSettings;
            }
        });
        
        controls.color.oninput = e => { 
            state.settings.color = e.target.value; 
            updateUIFromState();
        };
        controls.color.onchange = saveSettings;

        controls.clearBtn.onclick = () => {
            state.paths = [];
            redrawAll();
        };

        controls.undoBtn.onclick = () => {
            state.paths.pop();
            redrawAll();
        };

        controls.saveBtn.onclick = () => {
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = bgCanvas.width;
            tempCanvas.height = bgCanvas.height;
            const tempCtx = tempCanvas.getContext("2d");
            tempCtx.drawImage(bgCanvas, 0, 0);
            tempCtx.drawImage(drawCanvas, 0, 0);
            const link = document.createElement("a");
            link.download = `mandala-art-${Date.now()}.png`;
            link.href = tempCanvas.toDataURL("image/png");
            link.click();
        };

        controls.randomBtn.onclick = () => {
            const randomColor = `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
            state.settings.color = randomColor;
            updateUIFromState();
            saveSettings();
        };

        // Palettes removed, so no event listeners for them

        // --- Drawing Event Listeners ---
        function getPointerPos(e) {
            const r = drawCanvas.getBoundingClientRect();
            const event = e.touches ? e.touches[0] : e;
            return { x: event.clientX - r.left, y: event.clientY - r.top };
        }

        function startDraw(e) {
            if (e.target.closest('.controls')) return; // Don't draw if click is on controls
            e.preventDefault();
            state.drawing = true;
            state.lastPoints = [getPointerPos(e)];
            state.paths.push({ points: state.lastPoints, settings: { ...state.settings } });
        }

        function moveDraw(e) {
            if (!state.drawing) return;
            e.preventDefault();
            const newPoint = getPointerPos(e);
            state.lastPoints.push(newPoint);
            
            // Draw only the last segment for performance instead of redrawing all
            drawCtx.save();
            drawPath([state.lastPoints[state.lastPoints.length - 2], newPoint], state.settings);
            drawCtx.restore();
        }

        function endDraw() {
            state.drawing = false;
        }

        drawCanvas.addEventListener("mousedown", startDraw);
        drawCanvas.addEventListener("mousemove", moveDraw);
        window.addEventListener("mouseup", endDraw);

        drawCanvas.addEventListener("touchstart", startDraw, { passive: false });
        drawCanvas.addEventListener("touchmove", moveDraw, { passive: false });
        window.addEventListener("touchend", endDraw);
        
        window.addEventListener("resize", resizeCanvas);
    }

    // --- Initialization ---
    function init() {
        loadSettings();
        updateUIFromState();
        resizeCanvas();
        setupEventHandlers();
        mainLoop();
    }

    init();
});